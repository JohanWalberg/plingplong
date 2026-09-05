/**
 * Every source adapter produces RawListing[]; a shared normaliser turns them
 * into canonical listing fields. Adapters know nothing about the database.
 */
export type RawListing = {
  externalId: string;
  url?: string;
  address?: string;
  area?: string;
  municipality?: string;
  postcode?: string;
  rent?: string | number | null;
  rooms?: string | number | null;
  size?: string | number | null;
  floor?: string | number | null;
  floorsTotal?: string | number | null;
  moveIn?: string | null;
  deadline?: string | null;
  queue?: string | null;
  segment?: string | null;
  contract?: string | null;
  description?: string | null;
  image?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** The original item, stored as raw_payload for debugging and backfills. */
  raw: unknown;
};

/** Canonical field keys a source can map. `externalId` and `address` are required. */
export const CANONICAL_FIELDS = [
  "externalId",
  "url",
  "address",
  "area",
  "municipality",
  "postcode",
  "rent",
  "rooms",
  "size",
  "floor",
  "moveIn",
  "deadline",
  "queue",
  "segment",
  "contract",
  "description",
  "image",
  "lat",
  "lon",
] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const REQUIRED_FIELDS: CanonicalField[] = ["externalId", "address"];
/** Fields whose absence is worth warning about in the mapping test. */
export const IMPORTANT_FIELDS: CanonicalField[] = ["rent", "rooms", "size", "deadline", "queue", "url", "municipality"];

export type FieldMapping = Partial<Record<CanonicalField, string>>;

export type SourceConfig = {
  /** Dot path to the array of items inside the parsed document (feeds/APIs). */
  itemsPath?: string;
  /** Canonical field → path in the item (feeds/APIs) or CSS selector (HTML). */
  fields?: FieldMapping;
  /** HTML adapter: selector for one listing element. */
  listSelector?: string;
  /** HTML adapter: attribute to read for a field, e.g. { url: "href", image: "src" }. */
  attributes?: Partial<Record<CanonicalField, string>>;
  /** Optional bearer token for API sources. */
  apiKey?: string;
  /** Extra headers. */
  headers?: Record<string, string>;
};

export type FetchContext = {
  fetchText: (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; text: string; contentType: string | null }>;
};

export type AdapterResult = {
  listings: RawListing[];
  /** Mapping actually used (auto-detected merged with configured). */
  mapping: FieldMapping;
  /** Fields that could not be mapped. */
  missing: CanonicalField[];
  /** Number of items in the document before filtering. */
  itemCount: number;
};

export interface Adapter {
  id: string;
  kind: "feed" | "api" | "html";
  fetch(url: string, config: SourceConfig, ctx: FetchContext): Promise<AdapterResult>;
  /** Parse a document already in hand (used by tests and the connection test). */
  parse(text: string, config: SourceConfig): AdapterResult;
}

export class AdapterError extends Error {
  constructor(
    public readonly errorClass: "unreachable" | "http_error" | "parse_error" | "empty" | "robots" | "auth",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}
