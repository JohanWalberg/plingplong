import * as cheerio from "cheerio";
import { AdapterError, CANONICAL_FIELDS, type Adapter, type AdapterResult, type CanonicalField, type RawListing, type SourceConfig } from "./types";

/**
 * Cheerio-based HTML list adapter for static pages. Configuration:
 *   listSelector: selector matching one listing element
 *   fields: canonical field → selector relative to the listing element
 *   attributes: canonical field → attribute name (default: text content;
 *               url defaults to href, image to src)
 * JS-rendered sites need the Playwright adapter (not included yet); they are
 * set up by staff after approval.
 */
const DEFAULT_ATTRS: Partial<Record<CanonicalField, string>> = { url: "href", image: "src" };

const HEURISTIC_SELECTORS: Partial<Record<CanonicalField, string[]>> = {
  address: ["[itemprop=streetAddress]", ".address", ".adress", ".street", "h2 a", "h3 a", "h2", "h3"],
  area: ["[itemprop=addressLocality]", ".area", ".district", ".omrade", ".stadsdel"],
  rent: ["[itemprop=price]", ".rent", ".hyra", ".price"],
  rooms: [".rooms", ".rum", ".rok"],
  size: [".size", ".yta", ".area-sqm", ".sqm", ".boarea"],
  deadline: [".deadline", ".sista-ansokningsdag", ".apply-by", "time"],
  url: ["a[href]"],
  image: ["img"],
  queue: [".queue", ".kokrav", ".ko"],
  municipality: [".municipality", ".kommun", ".city"],
  moveIn: [".move-in", ".inflyttning", ".tilltrade"],
  floor: [".floor", ".vaning"],
  externalId: ["[data-id]", "[data-object-id]", "[id]"],
};

export const htmlAdapter: Adapter = {
  id: "html-list",
  kind: "html",
  parse(text, config): AdapterResult {
    const $ = cheerio.load(text);
    const listSelector = config.listSelector ?? "[data-listing], .listing, .listing-card, article, li.apartment, .apartment";
    const nodes = $(listSelector).toArray();
    if (!nodes.length) throw new AdapterError("parse_error", `expected ${listSelector}, found 0 elements`);

    const mapping: Partial<Record<CanonicalField, string>> = { ...(config.fields ?? {}) };
    // Heuristic detection on the first few nodes.
    for (const field of CANONICAL_FIELDS) {
      if (mapping[field]) continue;
      for (const sel of HEURISTIC_SELECTORS[field] ?? []) {
        const hits = nodes.slice(0, 5).filter((n) => $(n).find(sel).length || $(n).is(sel)).length;
        if (hits >= Math.ceil(Math.min(nodes.length, 5) / 2)) {
          mapping[field] = sel;
          break;
        }
      }
    }
    const missing = CANONICAL_FIELDS.filter((f) => !mapping[f]);

    const listings: RawListing[] = [];
    for (const n of nodes) {
      const el = $(n);
      const read = (field: CanonicalField): string | undefined => {
        const sel = mapping[field];
        if (!sel) return undefined;
        const target = el.is(sel) ? el : el.find(sel).first();
        if (!target.length) return undefined;
        const attr = config.attributes?.[field] ?? DEFAULT_ATTRS[field];
        if (field === "externalId") {
          const v = target.attr("data-id") ?? target.attr("data-object-id") ?? target.attr("id");
          return v?.trim() || undefined;
        }
        const v = attr ? target.attr(attr) : target.text();
        return v?.replace(/\s+/g, " ").trim() || undefined;
      };
      const address = read("address");
      let url = read("url");
      if (url && config.headers?.["x-base-url"]) url = new URL(url, config.headers["x-base-url"]).toString();
      const externalId = read("externalId") ?? el.attr("data-id") ?? url;
      if (!address || !externalId) continue;
      listings.push({
        externalId,
        url,
        address,
        area: read("area"),
        municipality: read("municipality"),
        postcode: read("postcode"),
        rent: read("rent") ?? null,
        rooms: read("rooms") ?? null,
        size: read("size") ?? null,
        floor: read("floor") ?? null,
        moveIn: read("moveIn") ?? null,
        deadline: read("deadline") ?? null,
        queue: read("queue") ?? null,
        segment: read("segment") ?? null,
        contract: read("contract") ?? null,
        description: read("description") ?? null,
        image: read("image") ?? null,
        raw: el.html(),
      });
    }
    return { listings, mapping, missing, itemCount: nodes.length };
  },
  async fetch(url, config, ctx) {
    const res = await ctx.fetchText(url, { headers: config.headers });
    if (res.status >= 400) throw new AdapterError("http_error", `HTTP ${res.status}`, res.status);
    const base = new URL(url);
    return this.parse(res.text, { ...config, headers: { ...(config.headers ?? {}), "x-base-url": `${base.protocol}//${base.host}${base.pathname}` } });
  },
};
