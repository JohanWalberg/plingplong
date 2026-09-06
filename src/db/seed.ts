/**
 * Development seed. Real municipalities of Stockholm County (plus the three
 * other "popular search" cities), a set of real landlords, and synthetic
 * listings covering every edge case the design handles.
 *
 * Run with `pnpm db:seed` (after `pnpm db:migrate`). Clears existing rows.
 */
import { sql } from "drizzle-orm";
import { db, schema } from "./index";
import { auth } from "@/lib/auth";
import { listingSlug, slugify } from "@/lib/slug";

const {
  municipality,
  area,
  landlord,
  landlordMunicipality,
  source,
  sourceRun,
  listing,
  listingSource,
  listingRevision,
  listingMetricDaily,
  duplicateCandidate,
  landlordApplication,
  landlordApplicationEvent,
  landlordMember,
  staffUser,
  user,
} = schema;

export const DEV_PASSWORD = "hyrabostad-dev-1234";

const now = new Date();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const daysFromNow = (d: number) => {
  const x = new Date(now);
  x.setDate(x.getDate() + d);
  return x;
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const dateIn = (days: number) => isoDate(daysFromNow(days));

// ---------------------------------------------------------------------------
// Municipalities
// ---------------------------------------------------------------------------

type Muni = [code: string, sv: string, en: string, lat: number, lon: number, county?: [string, string, string]];
const STOCKHOLM_COUNTY: [string, string, string] = ["01", "Stockholms län", "Stockholm County"];
const MUNIS: Muni[] = [
  ["0114", "Upplands Väsby", "Upplands Väsby", 59.518, 17.911],
  ["0115", "Vallentuna", "Vallentuna", 59.535, 18.078],
  ["0117", "Österåker", "Österåker", 59.479, 18.3],
  ["0120", "Värmdö", "Värmdö", 59.318, 18.55],
  ["0123", "Järfälla", "Järfälla", 59.423, 17.836],
  ["0125", "Ekerö", "Ekerö", 59.291, 17.809],
  ["0126", "Huddinge", "Huddinge", 59.237, 17.982],
  ["0127", "Botkyrka", "Botkyrka", 59.2, 17.831],
  ["0128", "Salem", "Salem", 59.205, 17.77],
  ["0136", "Haninge", "Haninge", 59.168, 18.145],
  ["0138", "Tyresö", "Tyresö", 59.244, 18.288],
  ["0139", "Upplands-Bro", "Upplands-Bro", 59.52, 17.64],
  ["0140", "Nykvarn", "Nykvarn", 59.18, 17.43],
  ["0160", "Täby", "Täby", 59.444, 18.069],
  ["0162", "Danderyd", "Danderyd", 59.4, 18.04],
  ["0163", "Sollentuna", "Sollentuna", 59.428, 17.951],
  ["0180", "Stockholm", "Stockholm", 59.329, 18.069],
  ["0181", "Södertälje", "Södertälje", 59.195, 17.626],
  ["0182", "Nacka", "Nacka", 59.31, 18.164],
  ["0183", "Sundbyberg", "Sundbyberg", 59.361, 17.971],
  ["0184", "Solna", "Solna", 59.36, 18.0],
  ["0186", "Lidingö", "Lidingö", 59.364, 18.15],
  ["0187", "Vaxholm", "Vaxholm", 59.403, 18.35],
  ["0188", "Norrtälje", "Norrtälje", 59.758, 18.7],
  ["0191", "Sigtuna", "Sigtuna", 59.617, 17.72],
  ["0192", "Nynäshamn", "Nynäshamn", 58.903, 17.948],
  ["1480", "Göteborg", "Gothenburg", 57.709, 11.975, ["14", "Västra Götalands län", "Västra Götaland County"]],
  ["1280", "Malmö", "Malmö", 55.605, 13.003, ["12", "Skåne län", "Skåne County"]],
  ["0380", "Uppsala", "Uppsala", 59.858, 17.639, ["03", "Uppsala län", "Uppsala County"]],
];

const AREAS: Record<string, Array<[name: string, lat: number, lon: number]>> = {
  Solna: [
    ["Arenastaden", 59.371, 18.004],
    ["Hagalund", 59.358, 17.996],
    ["Råsunda", 59.365, 17.99],
    ["Bergshamra", 59.381, 18.04],
    ["Huvudsta", 59.35, 17.98],
    ["Frösunda", 59.376, 18.01],
  ],
  Stockholm: [
    ["Södermalm", 59.315, 18.07],
    ["Norrmalm", 59.335, 18.06],
    ["Kungsholmen", 59.332, 18.03],
    ["Östermalm", 59.338, 18.09],
    ["Vasastan", 59.343, 18.05],
    ["Hammarby sjöstad", 59.303, 18.1],
    ["Bromma", 59.34, 17.94],
    ["Farsta", 59.243, 18.093],
    ["Kista", 59.403, 17.944],
  ],
  Sundbyberg: [
    ["Centrala Sundbyberg", 59.361, 17.971],
    ["Hallonbergen", 59.376, 17.967],
    ["Rissne", 59.377, 17.94],
  ],
  Nacka: [
    ["Sickla", 59.306, 18.12],
    ["Saltsjö-Boo", 59.33, 18.27],
    ["Nacka strand", 59.318, 18.16],
  ],
};

// ---------------------------------------------------------------------------
// Landlords
// ---------------------------------------------------------------------------

type LL = {
  key: string;
  name: string;
  org?: string;
  type: "municipal" | "private" | "agency" | "foundation";
  queue: "none" | "queue" | "points" | "unknown";
  website?: string;
  queueInfoUrl?: string;
  munis: string[];
  monitored: boolean;
  descSv?: string;
  descEn?: string;
  approved?: boolean;
};

const LANDLORDS: LL[] = [
  {
    key: "signalisten",
    name: "AB Bostadsstiftelsen Signalisten i Solna",
    org: "556075-2200",
    type: "foundation",
    queue: "points",
    website: "signalisten.se",
    queueInfoUrl: "https://www.signalisten.se/bostadskö",
    munis: ["Solna"],
    monitored: true,
    approved: true,
    descSv: "Kommunalt bostadsföretag i Solna med cirka 4 000 hyreslägenheter. Bostäderna förmedlas via egen bostadskö.",
    descEn: "Municipal housing company in Solna with roughly 4,000 rental apartments, allocated through its own housing queue.",
  },
  { key: "stockholmshem", name: "AB Stockholmshem", org: "556035-9555", type: "municipal", queue: "queue", website: "stockholmshem.se", queueInfoUrl: "https://bostad.stockholm.se", munis: ["Stockholm"], monitored: true },
  { key: "forvaltaren", name: "Fastighets AB Förvaltaren", org: "556050-2683", type: "municipal", queue: "queue", website: "forvaltaren.se", munis: ["Sundbyberg"], monitored: true },
  { key: "heimstaden", name: "Heimstaden Sverige", org: "556632-5900", type: "private", queue: "none", website: "heimstaden.com", munis: ["Stockholm", "Nacka", "Solna"], monitored: true },
  { key: "rikshem", name: "Rikshem Bostadsförvaltning", org: "556709-9667", type: "private", queue: "queue", website: "rikshem.se", munis: ["Stockholm", "Solna"], monitored: true },
  { key: "wallenstam", name: "Wallenstam", org: "556072-1523", type: "private", queue: "points", website: "wallenstam.se", munis: ["Solna", "Stockholm"], monitored: true },
  { key: "balder", name: "Fastighets AB Balder", org: "556525-6905", type: "private", queue: "unknown", website: "balder.se", munis: ["Solna", "Stockholm"], monitored: true },
  { key: "willhem", name: "Willhem Stockholm", org: "556797-1295", type: "private", queue: "queue", website: "willhem.se", munis: ["Stockholm"], monitored: true },
  { key: "stadshus", name: "Stockholms Stadshus AB", org: "556415-1727", type: "municipal", queue: "queue", website: "stockholm.se", munis: ["Stockholm"], monitored: true },
  { key: "bostadsformedlingen", name: "Bostadsförmedlingen i Stockholm AB", org: "556057-8303", type: "agency", queue: "points", website: "bostad.stockholm.se", queueInfoUrl: "https://bostad.stockholm.se/sa-fungerar-det/", munis: ["Stockholm", "Solna", "Sundbyberg", "Nacka", "Huddinge", "Botkyrka", "Haninge", "Täby", "Sollentuna"], monitored: true },
  { key: "familjebostader", name: "AB Familjebostäder", org: "556035-0067", type: "municipal", queue: "queue", website: "familjebostader.com", munis: ["Stockholm"], monitored: false },
  { key: "svenskabostader", name: "AB Svenska Bostäder", org: "556043-6429", type: "municipal", queue: "queue", website: "svenskabostader.se", munis: ["Stockholm"], monitored: false },
  { key: "einarmattsson", name: "Einar Mattsson", org: "556002-8005", type: "private", queue: "unknown", website: "einarmattsson.se", munis: ["Stockholm", "Solna"], monitored: false },
  { key: "huge", name: "Huge Bostäder AB", org: "556149-8121", type: "municipal", queue: "queue", website: "huge.se", munis: ["Huddinge"], monitored: false },
  { key: "botkyrkabyggen", name: "AB Botkyrkabyggen", org: "556050-8878", type: "municipal", queue: "queue", website: "botkyrkabyggen.se", munis: ["Botkyrka"], monitored: false },
  { key: "sollentunahem", name: "AB Sollentunahem", org: "556071-5011", type: "municipal", queue: "queue", website: "sollentunahem.se", munis: ["Sollentuna"], monitored: false },
  { key: "vasbyhem", name: "AB Väsbyhem", org: "556025-2380", type: "municipal", queue: "queue", website: "vasbyhem.se", munis: ["Upplands Väsby"], monitored: false },
  { key: "telge", name: "Telge Bostäder AB", org: "556054-5478", type: "municipal", queue: "queue", website: "telge.se", munis: ["Södertälje"], monitored: false },
  { key: "haningebostader", name: "Haninge Bostäder AB", org: "556549-2131", type: "municipal", queue: "queue", website: "haningebostader.se", munis: ["Haninge"], monitored: false },
  { key: "tyresobostader", name: "Tyresö Bostäder AB", org: "556057-3081", type: "municipal", queue: "queue", website: "tyresobostader.se", munis: ["Tyresö"], monitored: false },
  { key: "jarfallahus", name: "Järfällahus AB", org: "556044-9391", type: "municipal", queue: "queue", website: "jarfallahus.se", munis: ["Järfälla"], monitored: false },
  { key: "armada", name: "Armada Bostäder AB", org: "556374-8908", type: "municipal", queue: "queue", website: "armadafast.se", munis: ["Österåker"], monitored: false },
  { key: "sigtunahem", name: "AB Sigtunahem", org: "556039-8508", type: "municipal", queue: "queue", website: "sigtunahem.se", munis: ["Sigtuna"], monitored: false },
  { key: "lidingohem", name: "Lidingöhem AB", org: "556001-4211", type: "municipal", queue: "queue", website: "lidingohem.se", munis: ["Lidingö"], monitored: false },
  { key: "nackavatten", name: "Nacka Bostäder", type: "private", queue: "unknown", munis: ["Nacka"], monitored: false },
  { key: "solnabostader", name: "Solna Bostäder AB", type: "private", queue: "unknown", munis: ["Solna"], monitored: false },
  { key: "sundbybergsbo", name: "Sundbybergs Bostads AB", type: "private", queue: "unknown", munis: ["Sundbyberg"], monitored: false },
  { key: "poseidon", name: "Bostads AB Poseidon", org: "556120-3398", type: "municipal", queue: "queue", website: "poseidon.goteborg.se", munis: ["Göteborg"], monitored: false },
  { key: "mkb", name: "MKB Fastighets AB", org: "556049-1432", type: "municipal", queue: "queue", website: "mkbfastighet.se", munis: ["Malmö"], monitored: false },
  { key: "uppsalahem", name: "Uppsalahem AB", org: "556137-3589", type: "municipal", queue: "queue", website: "uppsalahem.se", munis: ["Uppsala"], monitored: false },
  // Very long landlord name: exercises card and table layouts.
  {
    key: "longname",
    name: "Stiftelsen Stockholms Studentbostäder och Ungdomsbostäder i Norra Storstockholm",
    org: "802003-0140",
    type: "foundation",
    queue: "points",
    website: "sssb.se",
    munis: ["Stockholm", "Solna"],
    monitored: true,
  },
];

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

type Src = {
  key: string;
  landlord: string;
  kind: "feed" | "api" | "html";
  adapter: string;
  url: string;
  status: "active" | "degraded" | "failed" | "needs_review" | "disabled" | "pending";
  failures?: number;
  lastRunMin: number;
  lastSuccessMin?: number;
  lastError?: string;
  runs: Array<[minutesAgo: number, ok: boolean, found: number, fresh: number, gone: number, err?: string]>;
  queueDefault?: "none" | "queue" | "points" | "unknown";
};

const SOURCES: Src[] = [
  { key: "signalisten", landlord: "signalisten", kind: "feed", adapter: "generic-xml", url: "https://signalisten.se/feeds/vacancies.xml", status: "active", lastRunMin: 6, runs: [[6, true, 14, 0, 0], [66, true, 14, 1, 0], [126, true, 13, 0, 1], [186, true, 14, 0, 0], [1446, true, 14, 2, 1]] },
  { key: "stockholmshem", landlord: "stockholmshem", kind: "html", adapter: "html-list", url: "https://www.stockholmshem.se/ledigt", status: "active", lastRunMin: 14, runs: [[14, true, 31, 2, 1], [74, true, 30, 0, 0], [134, true, 30, 1, 2]] },
  { key: "forvaltaren", landlord: "forvaltaren", kind: "feed", adapter: "generic-json", url: "https://www.forvaltaren.se/api/lediga-bostader.json", status: "active", lastRunMin: 2, runs: [[2, true, 9, 0, 0], [62, true, 9, 1, 0]] },
  { key: "heimstaden", landlord: "heimstaden", kind: "api", adapter: "generic-json", url: "https://api.heimstaden.com/v2/listings?country=se", status: "needs_review", lastRunMin: 38, runs: [[38, true, 4, 0, 0, undefined], [98, true, 96, 3, 1], [158, true, 95, 1, 0]] },
  { key: "rikshem", landlord: "rikshem", kind: "feed", adapter: "generic-xml", url: "https://www.rikshem.se/feed/vacancies.xml", status: "active", lastRunMin: 61, runs: [[61, true, 27, 1, 0], [121, true, 26, 0, 0]] },
  { key: "wallenstam", landlord: "wallenstam", kind: "html", adapter: "html-list", url: "https://www.wallenstam.se/sv/lediga-bostader/", status: "active", lastRunMin: 41, runs: [[41, true, 12, 0, 0], [101, true, 12, 0, 0]] },
  { key: "balder", landlord: "balder", kind: "html", adapter: "html-list", url: "https://www.balder.se/lediga-lagenheter", status: "degraded", failures: 1, lastRunMin: 22, lastSuccessMin: 82, lastError: "HTTP 503 Service Unavailable", runs: [[22, false, 0, 0, 0, "http_error: 503"], [82, true, 8, 0, 0], [142, true, 8, 0, 0]] },
  { key: "willhem", landlord: "willhem", kind: "api", adapter: "generic-json", url: "https://api.willhem.se/vacancies", status: "active", lastRunMin: 180, runs: [[180, true, 19, 0, 0], [240, true, 19, 0, 0]] },
  { key: "stadshus", landlord: "stadshus", kind: "html", adapter: "html-list", url: "https://bostad.stockholm.se/lediga-bostader", status: "failed", failures: 3, lastRunMin: 12, lastSuccessMin: 192, lastError: "parse_error: expected .listing-card, found 0 elements", runs: [[12, false, 0, 0, 0, "parse_error: expected .listing-card, found 0 elements"], [72, false, 0, 0, 0, "parse_error: expected .listing-card, found 0 elements"], [132, false, 0, 0, 0, "parse_error: expected .listing-card, found 0 elements"], [192, true, 44, 2, 1]] },
  { key: "bostadsformedlingen", landlord: "bostadsformedlingen", kind: "api", adapter: "generic-json", url: "https://bostad.stockholm.se/api/vacancies", status: "active", lastRunMin: 22, runs: [[22, true, 212, 6, 4], [82, true, 210, 5, 3], [142, true, 208, 2, 2]] },
  { key: "longname", landlord: "longname", kind: "feed", adapter: "generic-xml", url: "https://sssb.se/feed/ledigt.xml", status: "active", lastRunMin: 8, runs: [[8, true, 6, 0, 0]] },
];

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

type L = {
  addr: string;
  muni: string;
  area?: string;
  postcode?: string;
  ll: string;
  rent: number | null;
  rooms: number | null;
  size: number | null;
  floor?: number;
  floorsTotal?: number;
  queue: "none" | "queue" | "points" | "unknown";
  seg?: "none" | "student" | "youth" | "senior" | "accessible";
  deadlineDays?: number | null; // undefined => rolling (null)
  moveInDays?: number;
  checkedMin: number;
  firstSeenDays?: number;
  img?: boolean;
  sources: Array<[sourceKey: string, externalId: string]>; // empty => direct
  status?: "draft" | "active" | "unpublished" | "expired" | "removed";
  removedDays?: number;
  desc?: string;
  applyContact?: string;
  lat?: number;
  lon?: number;
  externalId?: string;
};

const LISTINGS: L[] = [
  // --- Prototype fixtures ---------------------------------------------------
  { addr: "Gustav III:s Boulevard 46", muni: "Solna", area: "Arenastaden", postcode: "169 73", ll: "signalisten", rent: 9340, rooms: 2, size: 54, floor: 4, floorsTotal: 7, queue: "points", deadlineDays: 4, moveInDays: 57, checkedMin: 6, firstSeenDays: 0.3, img: true, sources: [["signalisten", "SIG-2026-04412"], ["bostadsformedlingen", "BF-771230"]], desc: "Ljus tvåa med balkong mot innergården. Hiss finns. Nyrenoverat kök 2024.", lat: 59.372, lon: 18.006 },
  { addr: "Ringvägen 125", muni: "Stockholm", area: "Södermalm", postcode: "116 61", ll: "stockholmshem", rent: 7120, rooms: 1, size: 38, floor: 2, floorsTotal: 5, queue: "queue", deadlineDays: 1, moveInDays: 30, checkedMin: 14, firstSeenDays: 3, sources: [["stockholmshem", "STH-88213"]], lat: 59.312, lon: 18.076 },
  { addr: "Sturegatan 26", muni: "Sundbyberg", area: "Centrala Sundbyberg", postcode: "172 31", ll: "forvaltaren", rent: 12450, rooms: 3, size: 78, floor: 3, floorsTotal: 6, queue: "queue", deadlineDays: 0, moveInDays: 26, checkedMin: 2, firstSeenDays: 6, img: true, sources: [["forvaltaren", "FV-2211"]], lat: 59.362, lon: 17.972 },
  { addr: "Vasavägen 8", muni: "Nacka", area: "Sickla", postcode: "131 40", ll: "heimstaden", rent: 16800, rooms: 4, size: 96, floor: 1, floorsTotal: 4, queue: "none", deadlineDays: 10, moveInDays: 40, checkedMin: 41, firstSeenDays: 2, img: true, sources: [["heimstaden", "HS-SE-40021"]], lat: 59.307, lon: 18.123 },
  // Missing rent, missing size, unknown queue, rolling deadline, no image.
  { addr: "Klarabergsgatan 33", muni: "Stockholm", area: "Norrmalm", postcode: "111 21", ll: "willhem", rent: null, rooms: 2, size: null, queue: "unknown", deadlineDays: null, checkedMin: 95, firstSeenDays: 5, sources: [["willhem", "WH-1093"]], lat: 59.331, lon: 18.06 },
  { addr: "Studentbacken 21", muni: "Stockholm", area: "Östermalm", postcode: "115 57", ll: "longname", rent: 4980, rooms: 1, size: 24, floor: 5, floorsTotal: 8, queue: "points", seg: "student", deadlineDays: null, moveInDays: 14, checkedMin: 8, firstSeenDays: 1, sources: [["longname", "SSSB-7781"]], lat: 59.347, lon: 18.11 },
  // Very long address, very high rent, checked yesterday.
  { addr: "Professorsslingan 12, lägenhet 1402, uppgång B", muni: "Stockholm", area: "Östermalm", postcode: "114 18", ll: "heimstaden", rent: 34900, rooms: 5, size: 148, floor: 14, floorsTotal: 16, queue: "none", deadlineDays: 17, moveInDays: 60, checkedMin: 1440, firstSeenDays: 9, img: true, sources: [["heimstaden", "HS-SE-40388"]], lat: 59.35, lon: 18.104 },
  { addr: "Torsgatan 4", muni: "Stockholm", area: "Vasastan", postcode: "111 23", ll: "rikshem", rent: 11890, rooms: 2, size: 61, floor: 3, floorsTotal: 5, queue: "points", seg: "senior", deadlineDays: 7, moveInDays: 45, checkedMin: 22, firstSeenDays: 4, sources: [["rikshem", "RH-2026-5581"]], lat: 59.339, lon: 18.05 },
  // Duplicate candidate of the one above, listed by the agency with size 62.
  { addr: "Torsgatan 4", muni: "Stockholm", area: "Vasastan", postcode: "111 23", ll: "bostadsformedlingen", rent: 11890, rooms: 2, size: 62, floor: 3, queue: "points", seg: "senior", deadlineDays: 7, moveInDays: 45, checkedMin: 22, firstSeenDays: 4, sources: [["bostadsformedlingen", "BF-771902"]], lat: 59.339, lon: 18.05 },

  // --- Signalisten portal dashboard fixtures ------------------------------
  { addr: "Hagalundsgatan 17", muni: "Solna", area: "Hagalund", postcode: "169 63", ll: "signalisten", rent: 7890, rooms: 1, size: 41, floor: 6, floorsTotal: 9, queue: "points", deadlineDays: 7, moveInDays: 35, checkedMin: 6, firstSeenDays: 2, sources: [["signalisten", "SIG-2026-04401"]], lat: 59.358, lon: 17.997 },
  { addr: "Råsundavägen 102", muni: "Solna", area: "Råsunda", postcode: "169 57", ll: "signalisten", rent: 12100, rooms: 3, size: 76, floor: 2, floorsTotal: 4, queue: "points", deadlineDays: 10, moveInDays: 50, checkedMin: 6, firstSeenDays: 1.5, img: true, sources: [["signalisten", "SIG-2026-04418"]], lat: 59.366, lon: 17.992 },
  { addr: "Bergshamravägen 4", muni: "Solna", area: "Bergshamra", postcode: "170 77", ll: "signalisten", rent: 15400, rooms: 4, size: 98, floor: 1, queue: "points", deadlineDays: null, checkedMin: 0, sources: [], status: "draft", lat: 59.382, lon: 18.041 },
  { addr: "Frösundaleden 28", muni: "Solna", area: "Frösunda", postcode: "169 70", ll: "signalisten", rent: 10250, rooms: 2, size: 58, floor: 3, queue: "points", deadlineDays: 20, checkedMin: 0, sources: [], status: "draft", lat: 59.377, lon: 18.012 },
  { addr: "Huvudstagatan 9", muni: "Solna", area: "Huvudsta", postcode: "171 58", ll: "signalisten", rent: 8640, rooms: 2, size: 49, floor: 2, queue: "points", deadlineDays: -8, moveInDays: 10, checkedMin: 0, firstSeenDays: 30, sources: [], status: "expired", lat: 59.351, lon: 17.98 },
  // Direct (portal) listing, published, with contact route instead of URL.
  { addr: "Solnavägen 51", muni: "Solna", area: "Hagalund", postcode: "169 54", ll: "signalisten", rent: 9950, rooms: 2, size: 56, floor: 1, floorsTotal: 3, queue: "points", deadlineDays: 12, moveInDays: 40, checkedMin: 0, firstSeenDays: 1, sources: [], applyContact: "uthyrning@signalisten.se", desc: "Markplan med uteplats. Passar den som vill slippa trappor.", lat: 59.361, lon: 17.999 },
  { addr: "Ekensbergsvägen 3", muni: "Solna", area: "Huvudsta", postcode: "171 41", ll: "signalisten", rent: 11300, rooms: 3, size: 71, queue: "points", deadlineDays: 5, checkedMin: 0, firstSeenDays: 12, sources: [], status: "unpublished", lat: 59.349, lon: 17.985 },

  // --- More Solna listings so the municipality page has volume ------------
  { addr: "Kolonnvägen 22", muni: "Solna", area: "Arenastaden", postcode: "169 71", ll: "wallenstam", rent: 13900, rooms: 3, size: 74, floor: 8, floorsTotal: 12, queue: "points", deadlineDays: 3, moveInDays: 30, checkedMin: 41, firstSeenDays: 0.5, img: true, sources: [["wallenstam", "WS-9902"]], lat: 59.37, lon: 18.002 },
  { addr: "Ankdammsgatan 15", muni: "Solna", area: "Huvudsta", postcode: "171 43", ll: "balder", rent: 8790, rooms: 1, size: 36, floor: 4, floorsTotal: 6, queue: "unknown", deadlineDays: 9, checkedMin: 82, firstSeenDays: 7, sources: [["balder", "BLD-3310"]], lat: 59.352, lon: 17.978 },
  { addr: "Björnstigen 44", muni: "Solna", area: "Bergshamra", postcode: "170 73", ll: "rikshem", rent: 10480, rooms: 2, size: 60, floor: 2, floorsTotal: 3, queue: "queue", seg: "senior", deadlineDays: 6, moveInDays: 28, checkedMin: 61, firstSeenDays: 3, sources: [["rikshem", "RH-2026-5610"]], lat: 59.383, lon: 18.038 },
  { addr: "Tottvägen 8", muni: "Solna", area: "Råsunda", postcode: "169 54", ll: "heimstaden", rent: 14200, rooms: 3, size: 82, floor: 1, floorsTotal: 5, queue: "none", seg: "accessible", deadlineDays: null, moveInDays: 21, checkedMin: 38, firstSeenDays: 11, img: true, sources: [["heimstaden", "HS-SE-40510"]], lat: 59.364, lon: 17.988 },
  { addr: "Fridensborgsvägen 2", muni: "Solna", area: "Frösunda", postcode: "169 70", ll: "bostadsformedlingen", rent: 9100, rooms: 2, size: 52, floor: 5, floorsTotal: 6, queue: "points", deadlineDays: 2, moveInDays: 33, checkedMin: 22, firstSeenDays: 2.5, sources: [["bostadsformedlingen", "BF-772001"]], lat: 59.378, lon: 18.014 },
  { addr: "Stråkvägen 5", muni: "Solna", area: "Råsunda", postcode: "169 51", ll: "longname", rent: 5320, rooms: 1, size: 27, floor: 3, queue: "points", seg: "youth", deadlineDays: 15, moveInDays: 20, checkedMin: 8, firstSeenDays: 0.2, sources: [["longname", "SSSB-7790"]], lat: 59.366, lon: 17.994 },
  { addr: "Vireberg 3", muni: "Solna", area: "Hagalund", postcode: "169 65", ll: "balder", rent: 12750, rooms: 3, size: 70, queue: "unknown", deadlineDays: 8, checkedMin: 82, firstSeenDays: 4, sources: [["balder", "BLD-3322"]], lat: 59.356, lon: 17.994 },

  // --- Stockholm and neighbours ------------------------------------------
  { addr: "Hornsgatan 152", muni: "Stockholm", area: "Södermalm", postcode: "117 28", ll: "stockholmshem", rent: 9870, rooms: 2, size: 55, floor: 4, floorsTotal: 6, queue: "queue", deadlineDays: 5, moveInDays: 30, checkedMin: 14, firstSeenDays: 1, img: true, sources: [["stockholmshem", "STH-88250"]], lat: 59.317, lon: 18.04 },
  { addr: "Fleminggatan 61", muni: "Stockholm", area: "Kungsholmen", postcode: "112 32", ll: "familjebostader", rent: 11200, rooms: 2, size: 63, floor: 2, floorsTotal: 5, queue: "queue", deadlineDays: 6, checkedMin: 22, firstSeenDays: 2, sources: [["bostadsformedlingen", "BF-772115"]], lat: 59.334, lon: 18.035 },
  { addr: "Lidingövägen 74", muni: "Stockholm", area: "Östermalm", postcode: "115 41", ll: "willhem", rent: 15900, rooms: 3, size: 88, floor: 6, floorsTotal: 8, queue: "queue", deadlineDays: 11, moveInDays: 45, checkedMin: 180, firstSeenDays: 6, sources: [["willhem", "WH-1120"]], lat: 59.345, lon: 18.1 },
  { addr: "Hammarby allé 120", muni: "Stockholm", area: "Hammarby sjöstad", postcode: "120 66", ll: "heimstaden", rent: 13650, rooms: 3, size: 79, floor: 3, floorsTotal: 7, queue: "none", deadlineDays: null, moveInDays: 15, checkedMin: 38, firstSeenDays: 8, img: true, sources: [["heimstaden", "HS-SE-40777"]], lat: 59.304, lon: 18.104 },
  { addr: "Kista Torg 5", muni: "Stockholm", area: "Kista", postcode: "164 40", ll: "rikshem", rent: 8250, rooms: 1, size: 34, floor: 9, floorsTotal: 14, queue: "queue", seg: "youth", deadlineDays: 4, moveInDays: 25, checkedMin: 61, firstSeenDays: 3, sources: [["rikshem", "RH-2026-5640"]], lat: 59.403, lon: 17.945 },
  { addr: "Farstavägen 3", muni: "Stockholm", area: "Farsta", postcode: "123 47", ll: "stadshus", rent: 7690, rooms: 2, size: 51, floor: 1, floorsTotal: 3, queue: "queue", deadlineDays: 3, moveInDays: 20, checkedMin: 192, firstSeenDays: 5, sources: [["stadshus", "STO-2098"]], lat: 59.243, lon: 18.095 },
  { addr: "Drottningholmsvägen 310", muni: "Stockholm", area: "Bromma", postcode: "167 62", ll: "willhem", rent: null, rooms: 3, size: 74, floor: 2, queue: "queue", deadlineDays: 9, checkedMin: 180, firstSeenDays: 2, sources: [["willhem", "WH-1131"]], lat: 59.34, lon: 17.94 },
  { addr: "Upplandsgatan 92", muni: "Stockholm", area: "Vasastan", postcode: "113 44", ll: "einarmattsson", rent: 12900, rooms: 2, size: 66, floor: 5, floorsTotal: 6, queue: "unknown", deadlineDays: 14, moveInDays: 50, checkedMin: 22, firstSeenDays: 1, sources: [["bostadsformedlingen", "BF-772140"]], lat: 59.344, lon: 18.05 },
  { addr: "Sickla Kanalgata 12", muni: "Nacka", area: "Sickla", postcode: "120 68", ll: "heimstaden", rent: 15100, rooms: 3, size: 85, floor: 4, floorsTotal: 6, queue: "none", deadlineDays: 16, moveInDays: 35, checkedMin: 38, firstSeenDays: 4, img: true, sources: [["heimstaden", "HS-SE-40801"]], lat: 59.306, lon: 18.118 },
  { addr: "Värmdövägen 200", muni: "Nacka", area: "Saltsjö-Boo", postcode: "131 37", ll: "bostadsformedlingen", rent: 9450, rooms: 2, size: 57, floor: 1, queue: "points", deadlineDays: 5, checkedMin: 22, firstSeenDays: 6, sources: [["bostadsformedlingen", "BF-772201"]], lat: 59.32, lon: 18.24 },
  { addr: "Landsvägen 40", muni: "Sundbyberg", area: "Centrala Sundbyberg", postcode: "172 63", ll: "forvaltaren", rent: 8990, rooms: 2, size: 50, floor: 3, floorsTotal: 5, queue: "queue", deadlineDays: 8, moveInDays: 30, checkedMin: 2, firstSeenDays: 0.8, sources: [["forvaltaren", "FV-2230"]], lat: 59.363, lon: 17.968 },
  { addr: "Rissneleden 118", muni: "Sundbyberg", area: "Rissne", postcode: "174 57", ll: "forvaltaren", rent: 10700, rooms: 3, size: 77, floor: 2, floorsTotal: 8, queue: "queue", seg: "accessible", deadlineDays: 12, moveInDays: 45, checkedMin: 2, firstSeenDays: 3, sources: [["forvaltaren", "FV-2236"]], lat: 59.377, lon: 17.942 },
  { addr: "Hallonbergsplan 8", muni: "Sundbyberg", area: "Hallonbergen", postcode: "174 52", ll: "bostadsformedlingen", rent: 7450, rooms: 1, size: 39, floor: 7, floorsTotal: 10, queue: "points", deadlineDays: 1, moveInDays: 22, checkedMin: 22, firstSeenDays: 9, sources: [["bostadsformedlingen", "BF-772230"]], lat: 59.376, lon: 17.966 },
  { addr: "Sjödalsvägen 23", muni: "Huddinge", postcode: "141 47", ll: "bostadsformedlingen", rent: 8600, rooms: 2, size: 58, floor: 2, queue: "points", deadlineDays: 6, checkedMin: 22, firstSeenDays: 2, sources: [["bostadsformedlingen", "BF-772310"]], lat: 59.237, lon: 17.98 },
  { addr: "Grindtorpsvägen 15", muni: "Täby", postcode: "183 47", ll: "bostadsformedlingen", rent: 11450, rooms: 3, size: 80, floor: 5, floorsTotal: 9, queue: "points", deadlineDays: 10, moveInDays: 40, checkedMin: 22, firstSeenDays: 5, sources: [["bostadsformedlingen", "BF-772402"]], lat: 59.443, lon: 18.06 },
  { addr: "Malmvägen 6", muni: "Sollentuna", postcode: "191 61", ll: "bostadsformedlingen", rent: 9300, rooms: 2, size: 61, queue: "points", deadlineDays: 13, checkedMin: 22, firstSeenDays: 1, sources: [["bostadsformedlingen", "BF-772450"]], lat: 59.43, lon: 17.95 },
  // Removed at source: keeps its page.
  { addr: "Skolgatan 3", muni: "Solna", area: "Huvudsta", postcode: "171 63", ll: "signalisten", rent: 8100, rooms: 2, size: 47, floor: 1, queue: "points", deadlineDays: -2, checkedMin: 6, firstSeenDays: 14, sources: [["signalisten", "SIG-2026-04390"]], status: "removed", removedDays: 2, lat: 59.353, lon: 17.983 },
  { addr: "Ringvägen 8", muni: "Solna", area: "Råsunda", postcode: "169 50", ll: "wallenstam", rent: 11900, rooms: 2, size: 64, floor: 2, queue: "points", deadlineDays: -1, checkedMin: 41, firstSeenDays: 20, sources: [["wallenstam", "WS-9880"]], status: "removed", removedDays: 1, lat: 59.367, lon: 17.99 },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function clear() {
  const tables = [
    "duplicate_candidate",
    "listing_metric_daily",
    "listing_image",
    "listing_revision",
    "listing_source",
    "listing",
    "source_run",
    "source",
    "landlord_application_event",
    "landlord_application",
    "landlord_invitation",
    "landlord_member",
    "landlord_municipality",
    "landlord",
    "area",
    "municipality",
    "staff_user",
    "session",
    "account",
    "verification",
    '"user"',
  ];
  await db.execute(sql.raw(`TRUNCATE ${tables.join(", ")} CASCADE`));
}

async function createUser(email: string, name: string, locale: "sv" | "en" = "sv") {
  const res = await auth.api.signUpEmail({
    body: { email, password: DEV_PASSWORD, name, locale },
  });
  if (!res?.user) throw new Error(`could not create user ${email}`);
  await db.update(user).set({ emailVerified: true }).where(sql`${user.id} = ${res.user.id}`);
  return res.user.id;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function main() {
  console.log("clearing…");
  await clear();

  console.log("municipalities…");
  const muniByName = new Map<string, string>();
  for (const [code, sv, en, lat, lon, county = STOCKHOLM_COUNTY] of MUNIS) {
    const [row] = await db
      .insert(municipality)
      .values({
        code,
        nameSv: sv,
        nameEn: en,
        slugSv: slugify(sv),
        slugEn: slugify(en),
        county: county[0],
        countySv: county[1],
        countyEn: county[2],
        centroid: { x: lon, y: lat },
      })
      .returning({ id: municipality.id });
    muniByName.set(sv, row.id);
  }

  console.log("areas…");
  const areaByKey = new Map<string, string>();
  for (const [muniName, areas] of Object.entries(AREAS)) {
    const municipalityId = muniByName.get(muniName)!;
    for (const [name, lat, lon] of areas) {
      const [row] = await db
        .insert(area)
        .values({ municipalityId, name, slug: slugify(name), centroid: { x: lon, y: lat } })
        .returning({ id: area.id });
      areaByKey.set(`${muniName}/${name}`, row.id);
    }
  }

  console.log("landlords…");
  const llByKey = new Map<string, string>();
  for (const l of LANDLORDS) {
    const [row] = await db
      .insert(landlord)
      .values({
        name: l.name,
        slug: slugify(l.name),
        orgNumber: l.org,
        website: l.website,
        type: l.type,
        queueType: l.queue,
        queueInfoUrl: l.queueInfoUrl,
        descriptionSv: l.descSv,
        descriptionEn: l.descEn,
        isKnown: true,
        isMonitored: l.monitored,
        approvedAt: l.approved ? daysFromNow(-120) : null,
      })
      .returning({ id: landlord.id });
    llByKey.set(l.key, row.id);
    await db.insert(landlordMunicipality).values(
      l.munis.map((m) => ({ landlordId: row.id, municipalityId: muniByName.get(m)! })),
    );
  }

  console.log("sources…");
  const srcByKey = new Map<string, string>();
  for (const s of SOURCES) {
    const [row] = await db
      .insert(source)
      .values({
        landlordId: llByKey.get(s.landlord)!,
        kind: s.kind,
        adapter: s.adapter,
        url: s.url,
        status: s.status,
        consent: s.landlord === "signalisten" ? "consented" : "silent",
        techContactEmail: s.landlord === "signalisten" ? "drift@signalisten.se" : null,
        fetchIntervalMinutes: 60,
        consecutiveFailures: s.failures ?? 0,
        lastRunAt: minutesAgo(s.lastRunMin),
        lastSuccessAt: minutesAgo(s.lastSuccessMin ?? s.lastRunMin),
        nextRunAt: minutesAgo(s.lastRunMin - 60),
        lastError: s.lastError,
        queueDefault: s.queueDefault,
        config: s.adapter === "html-list" ? { listSelector: ".listing-card", fields: {} } : { fields: {} },
      })
      .returning({ id: source.id });
    srcByKey.set(s.key, row.id);
    for (const [min, ok, found, fresh, gone, err] of s.runs) {
      const prev = s.runs.find((r) => r[0] > min && r[1]);
      await db.insert(sourceRun).values({
        sourceId: row.id,
        startedAt: minutesAgo(min + 1),
        finishedAt: minutesAgo(min),
        ok,
        listingsFound: ok ? found : null,
        listingsNew: ok ? fresh : null,
        listingsUpdated: ok ? 0 : null,
        listingsGone: ok ? gone : null,
        errorClass: err?.split(":")[0],
        errorDetail: err,
        anomaly: ok && prev !== undefined && found < prev[2] * 0.4,
      });
    }
  }

  console.log("listings…");
  const listingIdByAddr = new Map<string, string>();
  const rnd = seededRandom(42);
  for (const l of LISTINGS) {
    const direct = l.sources.length === 0;
    const status = l.status ?? "active";
    const firstSeen = daysFromNow(-(l.firstSeenDays ?? 1));
    const checked = direct ? firstSeen : minutesAgo(l.checkedMin);
    const deadline = l.deadlineDays === undefined || l.deadlineDays === null ? null : dateIn(l.deadlineDays);
    const primarySource = l.sources[0] ? SOURCES.find((s) => s.key === l.sources[0][0]) : undefined;
    const primaryLandlord = LANDLORDS.find((x) => x.key === l.ll)!;
    const [row] = await db
      .insert(listing)
      .values({
        slug: listingSlug(l.addr, l.muni) + (l.ll === "bostadsformedlingen" && l.addr === "Torsgatan 4" ? "-2" : ""),
        landlordId: llByKey.get(l.ll)!,
        municipalityId: muniByName.get(l.muni)!,
        areaId: l.area ? areaByKey.get(`${l.muni}/${l.area}`) : null,
        address: l.addr,
        postcode: l.postcode,
        areaName: l.area,
        location: l.lat && l.lon ? { x: l.lon, y: l.lat } : null,
        rentMonthly: l.rent,
        rooms: l.rooms,
        sizeSqm: l.size,
        floor: l.floor,
        floorsTotal: l.floorsTotal,
        contractType: "first_hand",
        moveInDate: l.moveInDays ? dateIn(l.moveInDays) : null,
        applicationDeadline: deadline,
        queueRequirement: l.queue,
        segment: l.seg ?? "none",
        applyRoute: l.applyContact ? "contact" : "url",
        applicationUrl: l.applyContact
          ? null
          : `https://${primaryLandlord.website ?? "example.se"}/ledigt/${l.externalId ?? slugify(l.addr)}`,
        applicationContact: l.applyContact ?? null,
        description: l.desc,
        imageUrl: l.img ? `https://picsum.photos/seed/${slugify(l.addr)}/1200/800` : null,
        externalId: l.sources[0]?.[1] ?? null,
        status,
        publishedDirectly: direct,
        firstSeenAt: firstSeen,
        lastSeenAt: status === "removed" ? daysFromNow(-(l.removedDays ?? 1)) : checked,
        lastCheckedAt: checked,
        removedAt: status === "removed" ? daysFromNow(-(l.removedDays ?? 1)) : null,
        publishedAt: direct && status !== "draft" ? firstSeen : status === "active" ? firstSeen : null,
        unpublishedAt: status === "unpublished" ? daysFromNow(-1) : status === "expired" ? daysFromNow(-1) : null,
        reviewedAt: direct && status === "active" ? new Date(firstSeen.getTime() + 48 * 60_000) : null,
      })
      .returning({ id: listing.id });
    listingIdByAddr.set(`${l.ll}/${l.addr}`, row.id);

    for (const [srcKey, externalId] of l.sources) {
      const s = SOURCES.find((x) => x.key === srcKey)!;
      const ll = LANDLORDS.find((x) => x.key === s.landlord)!;
      await db.insert(listingSource).values({
        listingId: row.id,
        sourceId: srcByKey.get(srcKey)!,
        externalId,
        sourceUrl: `https://${ll.website}/ledigt/${externalId}`,
        firstSeenAt: firstSeen,
        lastSeenAt: status === "removed" ? daysFromNow(-(l.removedDays ?? 1)) : minutesAgo(s.lastRunMin),
        lastCheckedAt: minutesAgo(s.lastRunMin),
        presentAtLastCheck: status !== "removed",
        rawPayload: { address: l.addr, rent: l.rent, rooms: l.rooms, size: l.size, id: externalId },
        rawPayloadAt: minutesAgo(s.lastRunMin),
      });
    }

    // Metrics for the last 30 days on published listings.
    if (status === "active" || status === "expired" || status === "unpublished") {
      const base = l.ll === "signalisten" ? 20 : 8;
      const rows = [];
      for (let d = 29; d >= 0; d--) {
        const views = Math.round(base + rnd() * base * 2.5);
        rows.push({
          listingId: row.id,
          day: dateIn(-d),
          views,
          outboundClicks: Math.round(views * (0.1 + rnd() * 0.12)),
          saves: Math.round(views * rnd() * 0.08),
        });
      }
      await db.insert(listingMetricDaily).values(rows);
    }
    void primarySource;
  }

  console.log("revisions…");
  const gustav = listingIdByAddr.get("signalisten/Gustav III:s Boulevard 46")!;
  await db.insert(listingRevision).values([
    { listingId: gustav, field: "rent_monthly", oldValue: "9240", newValue: "9340", changedAt: daysFromNow(-2), origin: "crawl" },
  ]);
  const solnav = listingIdByAddr.get("signalisten/Solnavägen 51")!;
  await db.insert(listingRevision).values([
    { listingId: solnav, field: "status", oldValue: "draft", newValue: "active", changedAt: daysFromNow(-1), origin: "portal" },
  ]);

  console.log("duplicates…");
  await db.insert(duplicateCandidate).values([
    {
      listingAId: listingIdByAddr.get("rikshem/Torsgatan 4")!,
      listingBId: listingIdByAddr.get("bostadsformedlingen/Torsgatan 4")!,
      score: "0.940",
      features: { address: 1, rent: 1, rooms: 1, size: 0.9, distanceM: 12, sameLandlord: false },
    },
    {
      listingAId: listingIdByAddr.get("rikshem/Björnstigen 44")!,
      listingBId: listingIdByAddr.get("bostadsformedlingen/Fridensborgsvägen 2")!,
      score: "0.610",
      features: { address: 0.3, rent: 0.8, rooms: 1, size: 0.7, distanceM: 640, sameLandlord: false },
    },
    {
      listingAId: listingIdByAddr.get("familjebostader/Fleminggatan 61")!,
      listingBId: listingIdByAddr.get("einarmattsson/Upplandsgatan 92")!,
      score: "0.520",
      features: { address: 0.2, rent: 0.7, rooms: 1, size: 0.8, distanceM: 1500, sameLandlord: false },
      decision: "not_duplicate",
      decidedAt: daysFromNow(-3),
    },
  ]);

  console.log("users…");
  const leadId = await createUser("lead@hyrabostad.se", "Lea Ansvarig");
  const supportId = await createUser("support@hyrabostad.se", "Sam Support");
  const engineerId = await createUser("engineer@hyrabostad.se", "Elin Utvecklare", "en");
  await db.insert(staffUser).values([
    { userId: leadId, role: "lead" },
    { userId: supportId, role: "support" },
    { userId: engineerId, role: "engineer" },
  ]);
  const annaId = await createUser("anna.lindqvist@signalisten.se", "Anna Lindqvist");
  const editorId = await createUser("redaktor@signalisten.se", "Erik Redaktör");
  const signalistenId = llByKey.get("signalisten")!;
  await db.insert(landlordMember).values([
    { userId: annaId, landlordId: signalistenId, role: "owner" },
    { userId: editorId, landlordId: signalistenId, role: "editor" },
  ]);
  await db
    .update(listing)
    .set({ createdBy: annaId })
    .where(sql`${listing.landlordId} = ${signalistenId} AND ${listing.publishedDirectly} = true`);
  await db
    .update(listing)
    .set({ reviewedBy: supportId })
    .where(sql`${listing.landlordId} = ${signalistenId} AND ${listing.reviewedAt} IS NOT NULL`);

  console.log("applications…");
  const apps = [
    {
      orgNumber: "556075-2200",
      companyName: "AB Bostadsstiftelsen Signalisten i Solna",
      website: "signalisten.se",
      contactName: "Anna Lindqvist, uthyrningschef",
      contactEmail: "anna.lindqvist@signalisten.se",
      contactPhone: "08-475 24 00",
      publishingRoute: "source" as const,
      sourceUrl: "https://signalisten.se/feeds/vacancies.xml",
      status: "approved" as const,
      userId: annaId,
      landlordId: signalistenId,
      reviewedBy: leadId,
      reviewedAt: daysFromNow(-120),
      createdAt: daysFromNow(-121),
      automatedChecks: [
        { key: "org_format", status: "done" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "done" as const },
        { key: "feed", status: "done" as const, detail: { count: 14 } },
        { key: "feed_queue", status: "warn" as const },
      ],
    },
    {
      orgNumber: "556797-1234",
      companyName: "Fastighets AB Norrporten Sundbyberg",
      website: "norrporten.se",
      contactName: "Jonas Berg, förvaltare",
      contactEmail: "jonas.berg@norrporten.se",
      contactPhone: "08-410 300 00",
      publishingRoute: "source" as const,
      sourceUrl: "https://www.norrporten.se/ledigt.xml",
      status: "pending" as const,
      createdAt: minutesAgo(120),
      automatedChecks: [
        { key: "org_format", status: "done" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "done" as const },
        { key: "feed", status: "fail" as const, detail: { error: "unreachable" } },
      ],
    },
    {
      orgNumber: "769606-4412",
      companyName: "Brf Hagalunds Fastighetsförvaltning",
      website: null,
      contactName: "Maria Ek, ordförande",
      contactEmail: "maria.ek@gmail.com",
      contactPhone: null,
      publishingRoute: "manual" as const,
      sourceUrl: null,
      status: "pending" as const,
      createdAt: daysFromNow(-1),
      automatedChecks: [
        { key: "org_format", status: "done" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "na" as const },
        { key: "feed", status: "na" as const },
      ],
    },
    {
      orgNumber: "559102-8871",
      companyName: "Vasastadens Hyreshus AB",
      website: "vasastadenshyreshus.se",
      contactName: "Per Vasa, VD",
      contactEmail: "per@vasastadenshyreshus.se",
      contactPhone: "070-123 45 67",
      publishingRoute: "manual" as const,
      sourceUrl: null,
      status: "pending" as const,
      createdAt: daysFromNow(-2),
      automatedChecks: [
        { key: "org_format", status: "done" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "done" as const },
        { key: "feed", status: "na" as const },
      ],
    },
    {
      orgNumber: "556123-4567",
      companyName: "Kungsholmens Fastigheter AB",
      website: "kungsholmensfast.se",
      contactName: "Lisa Holm",
      contactEmail: "lisa@hotmail.com",
      contactPhone: null,
      publishingRoute: "manual" as const,
      sourceUrl: null,
      status: "needs_info" as const,
      createdAt: daysFromNow(-4),
      automatedChecks: [
        { key: "org_format", status: "done" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "fail" as const },
        { key: "feed", status: "na" as const },
      ],
    },
    {
      orgNumber: "556999-0001",
      companyName: "Snabba Hyror HB",
      website: "snabbahyror.example",
      contactName: "Okänd",
      contactEmail: "kontakt@snabbahyror.example",
      contactPhone: null,
      publishingRoute: "manual" as const,
      sourceUrl: null,
      status: "rejected" as const,
      reviewedBy: leadId,
      reviewedAt: daysFromNow(-6),
      decisionNote: "Organisationsnumret finns inte i något register och webbplatsen svarar inte.",
      createdAt: daysFromNow(-7),
      automatedChecks: [
        { key: "org_format", status: "fail" as const },
        { key: "org_registry", status: "warn" as const },
        { key: "email_domain", status: "done" as const },
        { key: "feed", status: "na" as const },
      ],
    },
  ];
  for (const a of apps) {
    const [row] = await db.insert(landlordApplication).values(a).returning({ id: landlordApplication.id });
    await db.insert(landlordApplicationEvent).values({ applicationId: row.id, kind: "submitted", createdAt: a.createdAt });
    if (a.status === "needs_info")
      await db.insert(landlordApplicationEvent).values({
        applicationId: row.id,
        kind: "needs_info",
        actorId: leadId,
        message: "E-postadressen ligger inte på företagets domän. Kan ni ansöka igen från en adress på kungsholmensfast.se?",
        createdAt: daysFromNow(-3),
      });
    if (a.status === "rejected")
      await db.insert(landlordApplicationEvent).values({ applicationId: row.id, kind: "rejected", actorId: leadId, message: a.decisionNote, createdAt: a.reviewedAt });
    if (a.status === "approved")
      await db.insert(landlordApplicationEvent).values({ applicationId: row.id, kind: "approved", actorId: leadId, createdAt: a.reviewedAt });
  }

  console.log(`seeded. dev password for all users: ${DEV_PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
