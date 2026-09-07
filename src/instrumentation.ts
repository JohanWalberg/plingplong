import { assertProductionConfig } from "@/lib/env-check";

/** Runs once per server instance, before requests are served. */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") assertProductionConfig();
}
