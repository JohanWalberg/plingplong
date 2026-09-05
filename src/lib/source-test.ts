import { AdapterError, IMPORTANT_FIELDS, REQUIRED_FIELDS, getAdapter, sniffFeedAdapter, type CanonicalField, type FieldMapping, type SourceConfig } from "@/worker/adapters";
import { politeFetch } from "@/worker/fetch";

export type SourceTestResult =
  | { ok: true; count: number; itemCount: number; mapping: FieldMapping; missing: CanonicalField[]; warnings: CanonicalField[]; sample: Record<string, unknown> | null }
  | { ok: false; errorClass: AdapterError["errorClass"]; message: string; status?: number };

/**
 * Connection test used by the portal's "Testa anslutning" and the approval
 * queue's automated checks: fetches, parses, reports the detected mapping and
 * what is missing. Never writes anything.
 */
export async function testSource(kind: "feed" | "api" | "html", url: string, config: SourceConfig = {}): Promise<SourceTestResult> {
  try {
    let result;
    if (kind === "html") {
      result = await getAdapter("html-list").fetch(url, config, politeFetch);
    } else {
      const res = await politeFetch.fetchText(url, { headers: { ...(config.headers ?? {}), ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) } });
      if (res.status >= 400) throw new AdapterError(res.status === 401 || res.status === 403 ? "auth" : "http_error", `HTTP ${res.status}`, res.status);
      result = sniffFeedAdapter(res.text, res.contentType).parse(res.text, config);
    }
    const missing = result.missing.filter((m) => !REQUIRED_FIELDS.includes(m) || !result.mapping[m]);
    const warnings = missing.filter((m) => IMPORTANT_FIELDS.includes(m));
    const first = result.listings[0];
    return {
      ok: true,
      count: result.listings.length,
      itemCount: result.itemCount,
      mapping: result.mapping,
      missing,
      warnings,
      sample: first ? { address: first.address, rent: first.rent, rooms: first.rooms, size: first.size, deadline: first.deadline, url: first.url } : null,
    };
  } catch (e) {
    if (e instanceof AdapterError) return { ok: false, errorClass: e.errorClass, message: e.message, status: e.status };
    return { ok: false, errorClass: "unreachable", message: (e as Error).message };
  }
}

export function adapterForKind(kind: "feed" | "api" | "html", contentHint?: "json" | "xml"): string {
  if (kind === "html") return "html-list";
  return contentHint === "json" ? "generic-json" : "generic-xml";
}
