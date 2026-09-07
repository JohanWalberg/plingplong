import type { Instrumentation } from "next";
import { assertProductionConfig } from "@/lib/env-check";
import { initErrorReporting, reportError } from "@/lib/observability";

/** Runs once per server instance, before requests are served. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  assertProductionConfig();
  await initErrorReporting("web");
}

/** Every server error Next catches: a page, a route handler or a server action. */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  reportError(err, {
    path: request.path,
    method: request.method,
    router: context.routerKind,
    route: context.routePath,
    routeType: context.routeType,
    // Production redacts the message and shows this instead; it is the only way to tie the two together.
    digest: typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
  });
};
