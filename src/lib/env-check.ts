/**
 * Production configuration check, run once at server start (instrumentation
 * register) and at worker start, never at build time or module import: a
 * `next build` collects page data with NODE_ENV=production and must not need
 * the deploy secrets.
 *
 * A production build served from http://localhost (CI's end-to-end run, a
 * local `pnpm start`) is a test server: it keeps the secret check but may
 * run without https and without an email provider.
 */
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/;

export function productionConfigProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const authUrl = env.BETTER_AUTH_URL ?? siteUrl;
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (!siteUrl) problems.push("NEXT_PUBLIC_SITE_URL must be set (canonicals, hreflang, sitemap and share cards use it)");
  if (secret.length < 32 || /change-me/i.test(secret)) problems.push("BETTER_AUTH_SECRET must be a random string of at least 32 characters");
  if (authUrl && LOCAL.test(authUrl)) return problems;
  if (!authUrl?.startsWith("https://")) problems.push("BETTER_AUTH_URL must be the https origin (it decides Secure cookies and the origin check)");
  if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY must be set: without it emails, including reset links, would be written to the log");
  return problems;
}

export function assertProductionConfig(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return;
  const problems = productionConfigProblems(env);
  if (problems.length) throw new Error(`refusing to start in production:\n- ${problems.join("\n- ")}`);
}
