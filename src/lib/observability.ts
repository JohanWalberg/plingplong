/**
 * Error reporting for the web server and the worker.
 *
 * Everything here is a no-op without SENTRY_DSN, so development, tests and CI
 * behave exactly as before. Reporting must never be the reason a request or a
 * job fails, so every call is guarded: a broken reporter stays a log line.
 *
 * Source health (failed crawls, degraded sources) deliberately stays in the
 * database where the brief puts it. This is for the exceptions nobody sees.
 */
type Sentry = typeof import("@sentry/node");

let sentry: Sentry | null = null;
let started = false;

export function errorReportingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SENTRY_DSN);
}

/** Called once per process: the Next server through instrumentation, the worker at start. */
export async function initErrorReporting(component: "web" | "worker"): Promise<boolean> {
  if (started || !errorReportingEnabled()) return false;
  started = true;
  try {
    const mod = await import("@sentry/node");
    mod.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE,
      // Errors only for now; tracing is a separate decision with its own cost.
      tracesSampleRate: 0,
      initialScope: { tags: { component } },
    });
    sentry = mod;
    return true;
  } catch (e) {
    console.error("[observability] could not start error reporting", e);
    return false;
  }
}

/** Reports an exception and always logs it, so a machine without a DSN still shows the failure. */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  const where = Object.entries(context)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  console.error(`[error]${where ? ` ${where}` : ""}`, error);
  if (!sentry) return;
  try {
    sentry.captureException(error, { extra: context });
  } catch (e) {
    console.error("[observability] could not report", e);
  }
}

/**
 * Invitation tokens travel in the path (/portal/invite/<token>) and password
 * reset tokens in the query. An error on either page would otherwise ship a
 * live credential to the error tracker and the log line beside it.
 */
export function redactedPath(path: string): string {
  const [pathname, query] = path.split("?", 2);
  const p = pathname.replace(/(\/(?:invite|inbjudan)\/)[^/]+/, "$1[redacted]");
  if (!query) return p;
  const q = new URLSearchParams(query);
  for (const key of [...q.keys()]) if (/token|secret|key|password/i.test(key)) q.set(key, "[redacted]");
  return `${p}?${q}`;
}

