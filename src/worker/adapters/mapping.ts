import { CANONICAL_FIELDS, type CanonicalField, type FieldMapping } from "./types";

/**
 * Field name synonyms used to auto-detect a mapping from a sample item. Swedish
 * and English, plus the dotted paths shown in the design ("address.street").
 * Order matters: earlier candidates win.
 */
const SYNONYMS: Record<CanonicalField, string[]> = {
  externalId: ["id", "externalId", "external_id", "objectId", "object_id", "objektnummer", "objektsnummer", "listingId", "listing_id", "reference", "ref", "guid", "nr"],
  url: ["url", "link", "application.url", "applicationUrl", "application_url", "href", "ansokningslank", "ansökningslänk", "webbadress"],
  address: ["address.street", "address", "adress", "street", "gatuadress", "streetAddress", "street_address", "gata"],
  area: ["address.district", "district", "area", "omrade", "område", "stadsdel", "neighbourhood", "neighborhood", "address.area"],
  municipality: ["address.municipality", "municipality", "kommun", "address.city", "city", "ort", "town"],
  postcode: ["address.postcode", "postcode", "postalCode", "postal_code", "postnummer", "zip", "address.zip"],
  rent: ["rent.monthly", "rent", "hyra", "monthlyRent", "monthly_rent", "manadshyra", "månadshyra", "price", "pris"],
  rooms: ["rooms", "rum", "antalRum", "antal_rum", "numberOfRooms", "number_of_rooms", "rok"],
  size: ["area_sqm", "size", "yta", "boarea", "sqm", "livingArea", "living_area", "kvm", "size_sqm", "areaSqm"],
  floor: ["floor", "vaning", "våning", "level"],
  moveIn: ["moveIn", "move_in", "moveInDate", "move_in_date", "inflyttning", "inflyttningsdatum", "availableFrom", "available_from", "tilltrade", "tillträde"],
  deadline: ["application.deadline", "deadline", "applicationDeadline", "application_deadline", "sistaAnsokningsdag", "sista_ansokningsdag", "ansokSenast", "ansök senast", "applyBy", "apply_by"],
  queue: ["queue", "queueRequirement", "queue_requirement", "kokrav", "kökrav", "ko", "kö", "queueType", "queue_type"],
  segment: ["segment", "malgrupp", "målgrupp", "housingType", "housing_type", "category", "kategori", "type", "typ"],
  contract: ["contract", "contractType", "contract_type", "kontrakt", "kontraktstyp", "tenure"],
  description: ["description", "beskrivning", "text", "body", "summary"],
  image: ["image", "imageUrl", "image_url", "bild", "photo", "picture", "images.0", "images.0.url", "images.image", "images.image.0", "bilder.0", "bilder.bild"],
  lat: ["lat", "latitude", "location.lat", "coordinates.lat", "position.lat", "geo.lat"],
  lon: ["lon", "lng", "longitude", "location.lon", "location.lng", "coordinates.lon", "coordinates.lng", "position.lon", "geo.lon"],
};

export function getPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      // Case-insensitive key match so "Address" and "address" both work.
      const key = part in o ? part : Object.keys(o).find((k) => k.toLowerCase() === part.toLowerCase());
      cur = key === undefined ? undefined : o[key];
    } else return undefined;
  }
  return cur;
}

/** Flatten a value to a string for text fields; objects with #text (XML) unwrap. */
export function asText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return asText(o["#text"]);
    if ("_text" in o) return asText(o["_text"]);
    if ("value" in o) return asText(o["value"]);
    if ("url" in o) return asText(o["url"]);
    if ("href" in o) return asText(o["href"]);
  }
  return undefined;
}

/**
 * Detect a mapping from a sample of items: for each canonical field take the
 * first synonym that resolves to a non-empty value on most samples.
 */
export function detectMapping(samples: unknown[], configured: FieldMapping = {}): { mapping: FieldMapping; missing: CanonicalField[] } {
  const mapping: FieldMapping = { ...configured };
  const missing: CanonicalField[] = [];
  const probe = samples.slice(0, 10);
  for (const field of CANONICAL_FIELDS) {
    if (mapping[field]) continue;
    let found: string | undefined;
    // Required fields must resolve on most items; optional fields on at least one.
    const needed = field === "externalId" || field === "address" ? Math.ceil(probe.length / 2) : 1;
    for (const candidate of SYNONYMS[field]) {
      const hits = probe.filter((s) => asText(getPath(s, candidate)) !== undefined).length;
      if (hits >= needed) {
        found = candidate;
        break;
      }
    }
    if (found) mapping[field] = found;
    else missing.push(field);
  }
  return { mapping, missing };
}

/** Find the items array in a parsed document: configured path, or the largest array of objects. */
export function findItems(doc: unknown, itemsPath?: string): unknown[] {
  if (itemsPath) {
    const v = getPath(doc, itemsPath);
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return [v]; // single item
    return [];
  }
  if (Array.isArray(doc)) return doc;
  let best: unknown[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      const objs = node.filter((x) => x && typeof x === "object" && !Array.isArray(x));
      if (objs.length > best.length) best = objs;
      for (const x of node.slice(0, 3)) visit(x, depth + 1);
      return;
    }
    for (const v of Object.values(node as Record<string, unknown>)) visit(v, depth + 1);
  };
  visit(doc, 0);
  return best;
}
