import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { renderEmail } from "./email-templates";

const PROD = process.env.NODE_ENV === "production";
if (PROD) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32 || /change-me/i.test(secret)) throw new Error("BETTER_AUTH_SECRET must be a random string of at least 32 characters in production");
  if (!process.env.BETTER_AUTH_URL?.startsWith("https://")) throw new Error("BETTER_AUTH_URL must be the https origin in production (it decides Secure cookies and the origin check)");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  hooks: {
    // Accounts are created only by the application form and by invitations,
    // both server-side. The public sign-up endpoint would otherwise let anyone
    // pre-register a colleague's address and inherit their invitation.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.request) throw new APIError("FORBIDDEN", { message: "Sign-up is by application or invitation" });
    }),
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: false,
    // A reset is what people do after a suspected compromise: drop every other session.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const locale = (user as { locale?: string }).locale === "en" ? "en" : "sv";
      const mail = await renderEmail(locale, "reset", { url });
      await sendEmail({ to: user.email, ...mail });
    },
  },
  user: {
    additionalFields: {
      locale: { type: "string", defaultValue: "sv", input: true },
    },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "on",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/reset-password": { window: 3600, max: 5 },
    },
  },
  session: {
    // Landlord sessions: seven days, refreshed daily. Staff sessions are cut
    // to eight hours by the staff guard (see src/lib/access.ts).
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
  },
  // BankID (OIDC broker) and staff SSO providers are added here later.
});

export type Session = typeof auth.$Infer.Session;
