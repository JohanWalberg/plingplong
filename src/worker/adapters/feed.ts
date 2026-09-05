import { XMLParser } from "fast-xml-parser";
import { AdapterError, CANONICAL_FIELDS, REQUIRED_FIELDS, type Adapter, type AdapterResult, type CanonicalField, type FetchContext, type RawListing, type SourceConfig } from "./types";
import { asText, detectMapping, findItems, getPath } from "./mapping";

function itemsToListings(items: unknown[], config: SourceConfig): AdapterResult {
  const { mapping, missing } = detectMapping(items, config.fields);
  const listings: RawListing[] = [];
  for (const item of items) {
    const get = (f: CanonicalField) => (mapping[f] ? getPath(item, mapping[f]!) : undefined);
    const externalId = asText(get("externalId")) ?? asText(get("url"));
    const address = asText(get("address"));
    if (!externalId || !address) continue; // required fields
    const num = (v: unknown) => {
      const t = asText(v);
      if (t === undefined) return undefined;
      const n = Number(t.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    listings.push({
      externalId,
      url: asText(get("url")),
      address,
      area: asText(get("area")),
      municipality: asText(get("municipality")),
      postcode: asText(get("postcode")),
      rent: asText(get("rent")) ?? null,
      rooms: asText(get("rooms")) ?? null,
      size: asText(get("size")) ?? null,
      floor: asText(get("floor")) ?? null,
      moveIn: asText(get("moveIn")) ?? null,
      deadline: asText(get("deadline")) ?? null,
      queue: asText(get("queue")) ?? null,
      segment: asText(get("segment")) ?? null,
      contract: asText(get("contract")) ?? null,
      description: asText(get("description")) ?? null,
      image: asText(get("image")) ?? null,
      lat: num(get("lat")) ?? null,
      lon: num(get("lon")) ?? null,
      raw: item,
    });
  }
  return { listings, mapping, missing: missing.filter((m) => !REQUIRED_FIELDS.includes(m) || !mapping[m]), itemCount: items.length };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => /^(items?|listings?|bostad|bostader|objekt|entry|apartment|apartments|vacancy|vacancies|lagenhet|lagenheter)$/i.test(name),
});

export const xmlAdapter: Adapter = {
  id: "generic-xml",
  kind: "feed",
  parse(text, config) {
    let doc: unknown;
    try {
      doc = xmlParser.parse(text);
    } catch (e) {
      throw new AdapterError("parse_error", `XML parse failed: ${(e as Error).message}`);
    }
    if (!doc || typeof doc !== "object" || !Object.keys(doc as object).length) throw new AdapterError("parse_error", "Document is not XML");
    const items = findItems(doc, config.itemsPath);
    if (!items.length) throw new AdapterError("empty", "No items found in feed");
    return itemsToListings(items, config);
  },
  async fetch(url, config, ctx) {
    const res = await ctx.fetchText(url, { headers: authHeaders(config) });
    if (res.status >= 400) throw new AdapterError(res.status === 401 || res.status === 403 ? "auth" : "http_error", `HTTP ${res.status}`, res.status);
    return this.parse(res.text, config);
  },
};

export const jsonAdapter: Adapter = {
  id: "generic-json",
  kind: "feed",
  parse(text, config) {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch (e) {
      throw new AdapterError("parse_error", `JSON parse failed: ${(e as Error).message}`);
    }
    const items = findItems(doc, config.itemsPath);
    if (!items.length) throw new AdapterError("empty", "No items found in document");
    return itemsToListings(items, config);
  },
  async fetch(url, config, ctx) {
    const res = await ctx.fetchText(url, { headers: { accept: "application/json", ...authHeaders(config) } });
    if (res.status >= 400) throw new AdapterError(res.status === 401 || res.status === 403 ? "auth" : "http_error", `HTTP ${res.status}`, res.status);
    return this.parse(res.text, config);
  },
};

export function authHeaders(config: SourceConfig): Record<string, string> {
  const h: Record<string, string> = { ...(config.headers ?? {}) };
  if (config.apiKey) h.authorization = `Bearer ${config.apiKey}`;
  return h;
}

/** Pick the feed adapter from the content: JSON if it parses, else XML. */
export function sniffFeedAdapter(text: string, contentType: string | null): Adapter {
  const t = text.trimStart();
  if (contentType?.includes("json") || t.startsWith("{") || t.startsWith("[")) return jsonAdapter;
  return xmlAdapter;
}

export { CANONICAL_FIELDS };
export type { FetchContext };
