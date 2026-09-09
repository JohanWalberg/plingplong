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

/**
 * A production build answering on http://localhost: CI's end-to-end run, or a
 * local `pnpm start`. It is the artefact we ship, exercised as a test server,
 * and a few production rules are relaxed for it — see the callers.
 */
export function isLocalTestServer(env: Record<string, string | undefined> = process.env): boolean {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const authUrl = env.BETTER_AUTH_URL ?? siteUrl;
  return Boolean(siteUrl && authUrl && LOCAL.test(siteUrl) && LOCAL.test(authUrl));
}

export function productionConfigProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const authUrl = env.BETTER_AUTH_URL ?? siteUrl;
  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (!siteUrl) problems.push("NEXT_PUBLIC_SITE_URL must be set (canonicals, hreflang, sitemap and share cards use it)");
  if (secret.length < 32 || /change-me/i.test(secret)) problems.push("BETTER_AUTH_SECRET must be a random string of at least 32 characters");
  // Both URLs have to say localhost. A real site URL beside a leftover localhost
  // auth URL is a misconfigured deploy, not a test server, and skipping the rest
  // of these checks for it would hide a missing email key that logs reset links.
  if (isLocalTestServer(env)) return problems;
  if (!authUrl?.startsWith("https://")) problems.push("BETTER_AUTH_URL must be the https origin (it decides Secure cookies and the origin check)");
  if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY must be set: without it emails, including reset links, would be written to the log");
  // Uploads on local disk do not survive a redeploy on most hosts, so the choice has to be deliberate.
  if (env.STORAGE_DRIVER !== "disk" && env.STORAGE_DRIVER !== "s3") problems.push('STORAGE_DRIVER must be "s3" (a bucket) or "disk" (only with a persistent volume mounted at UPLOAD_DIR)');
  if (env.STORAGE_DRIVER === "s3" && !env.S3_BUCKET) problems.push("S3_BUCKET must be set when STORAGE_DRIVER=s3");
  // Every rate limit is keyed on the caller's address, and the only way to know
  // it behind a proxy is to know how many hops to trust. Guessing it wrong
  // either lets one caller pose as thousands or makes thousands share one
  // bucket, so the deploy has to say. Render, Fly and Vercel are 1.
  const hops = env.TRUSTED_PROXY_HOPS;
  if (hops === undefined || !/^\d+$/.test(hops)) problems.push('TRUSTED_PROXY_HOPS must be the number of proxies in front of the app ("1" on Render, Fly or Vercel; "0" if it is reached directly): every rate limit is keyed on the address it resolves');
  return problems;
}

export function assertProductionConfig(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.NEXT_PHASE === "phase-production-build") return;
  const problems = productionConfigProblems(env);
  if (problems.length) throw new Error(`refusing to start in production:\n- ${problems.join("\n- ")}`);
}
