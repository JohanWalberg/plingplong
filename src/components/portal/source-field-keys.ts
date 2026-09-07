import { CANONICAL_FIELDS, type CanonicalField } from "@/worker/adapters/types";

/** Catalogue key (portal.source) for each canonical feed field; a map so a missing key is a type error, not a runtime one. */
export const SOURCE_FIELD_KEYS = {
  externalId: "fieldExternalId",
  url: "fieldUrl",
  address: "fieldAddress",
  area: "fieldArea",
  municipality: "fieldMunicipality",
  postcode: "fieldPostcode",
  rent: "fieldRent",
  rooms: "fieldRooms",
  size: "fieldSize",
  floor: "fieldFloor",
  moveIn: "fieldMoveIn",
  deadline: "fieldDeadline",
  queue: "fieldQueue",
  segment: "fieldSegment",
  contract: "fieldContract",
  description: "fieldDescription",
  image: "fieldImage",
  lat: "fieldLat",
  lon: "fieldLon",
} as const satisfies Record<CanonicalField, string>;

export function isCanonicalField(k: string): k is CanonicalField {
  return (CANONICAL_FIELDS as readonly string[]).includes(k);
}
