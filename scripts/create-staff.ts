/**
 * Creates the first staff account, which nothing else can do on a fresh
 * database: the seed is the only other route and it refuses to run in
 * production, `addStaffByEmail` needs a lead to already exist, and public
 * sign-up is closed. Without this a new deploy has no way in.
 *
 *   pnpm staff:add lead@example.se lead
 *
 * Idempotent: run it again to change someone's role, or to grant staff to an
 * account that already exists. The password comes from STAFF_PASSWORD, or one
 * is generated and printed once — change it after signing in.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";

const ROLES = ["support", "lead", "engineer"] as const;
type Role = (typeof ROLES)[number];

const [emailArg, roleArg = "lead", ...rest] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const name = rest.join(" ").trim() || email?.split("@")[0] || "Staff";

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die("usage: pnpm staff:add <email> [support|lead|engineer] [name]");
if (!ROLES.includes(roleArg as Role)) die(`role must be one of: ${ROLES.join(", ")}`);
const role = roleArg as Role;

const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
let userId: string;
let generated: string | null = null;

if (existing) {
  userId = existing.id;
  console.log(`user ${email} already exists; granting staff only (password unchanged)`);
} else {
  const password = process.env.STAFF_PASSWORD || (generated = randomBytes(18).toString("base64url"));
  if (password.length < 10) die("STAFF_PASSWORD must be at least 10 characters");
  // Better Auth's public sign-up endpoint is closed by a hook that only fires
  // for HTTP calls, so this server-side one is allowed through.
  const res = await auth.api.signUpEmail({ body: { email, password, name, locale: "sv" } });
  userId = res.user.id;
  // No verification email is sent for an account created from the console.
  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, userId));
}

await db
  .insert(schema.staffUser)
  .values({ userId, role })
  .onConflictDoUpdate({ target: schema.staffUser.userId, set: { role } });

console.log(`${email} is now staff with role "${role}"`);
if (generated) console.log(`generated password: ${generated}\nSign in at /sv/admin/logga-in and change it from the account page.`);
process.exit(0);
