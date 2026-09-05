import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  geometry,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** PostGIS polygon/multipolygon column, kept generic; read via ST_AsGeoJSON. */
const geomArea = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(MultiPolygon, 4326)";
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const landlordTypeEnum = pgEnum("landlord_type", ["municipal", "private", "agency", "foundation"]);
export const queueRequirementEnum = pgEnum("queue_requirement", ["none", "queue", "points", "unknown"]);
export const segmentEnum = pgEnum("segment", ["none", "student", "youth", "senior", "accessible"]);
export const contractTypeEnum = pgEnum("contract_type", ["first_hand", "sublet"]);
export const sourceKindEnum = pgEnum("source_kind", ["feed", "api", "html", "manual"]);
export const sourceStatusEnum = pgEnum("source_status", [
  "pending",
  "active",
  "degraded",
  "failed",
  "disabled",
  "needs_review",
]);
export const consentEnum = pgEnum("source_consent", ["unknown", "consented", "objected", "silent"]);
export const listingStatusEnum = pgEnum("listing_status", [
  "draft", // portal only, never public
  "active", // visible in search
  "unpublished", // landlord removed it in the portal
  "expired", // auto-unpublished 7 days after deadline (direct listings)
  "removed", // gone at the source
  "unknown",
]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "needs_info", "approved", "rejected"]);
export const landlordRoleEnum = pgEnum("landlord_role", ["owner", "editor"]);
export const staffRoleEnum = pgEnum("staff_role", ["support", "lead", "engineer"]);
export const duplicateDecisionEnum = pgEnum("duplicate_decision", ["pending", "merged", "not_duplicate", "ignored"]);
export const applyRouteEnum = pgEnum("apply_route", ["url", "contact"]);
export const publishingRouteEnum = pgEnum("publishing_route", ["source", "manual"]);

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export const municipality = pgTable(
  "municipality",
  {
    id: id(),
    code: text("code").notNull().unique(), // SCB municipality code, e.g. 0184 for Solna
    nameSv: text("name_sv").notNull(),
    nameEn: text("name_en").notNull(),
    slugSv: text("slug_sv").notNull().unique(),
    slugEn: text("slug_en").notNull().unique(),
    county: text("county").notNull(),
    countySv: text("county_sv").notNull(),
    countyEn: text("county_en").notNull(),
    centroid: geometry("centroid", { type: "point", mode: "xy", srid: 4326 }),
    geom: geomArea("geom"),
    createdAt: createdAt(),
  },
  (t) => [index("municipality_centroid_gix").using("gist", t.centroid)],
);

export const area = pgTable(
  "area",
  {
    id: id(),
    municipalityId: text("municipality_id")
      .notNull()
      .references(() => municipality.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    centroid: geometry("centroid", { type: "point", mode: "xy", srid: 4326 }),
    geom: geomArea("geom"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("area_muni_slug_uq").on(t.municipalityId, t.slug)],
);

// ---------------------------------------------------------------------------
// Landlords and sources
// ---------------------------------------------------------------------------

export const landlord = pgTable(
  "landlord",
  {
    id: id(),
    orgNumber: text("org_number").unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    website: text("website"),
    type: landlordTypeEnum("type").notNull().default("private"),
    queueType: queueRequirementEnum("queue_type").notNull().default("unknown"),
    queueInfoUrl: text("queue_info_url"),
    descriptionSv: text("description_sv"),
    descriptionEn: text("description_en"),
    logoUrl: text("logo_url"),
    approvedAt: ts("approved_at"),
    isKnown: boolean("is_known").notNull().default(true),
    isMonitored: boolean("is_monitored").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("landlord_monitored_idx").on(t.isMonitored)],
);

/** Which municipalities a landlord is known to operate in (drives coverage). */
export const landlordMunicipality = pgTable(
  "landlord_municipality",
  {
    landlordId: text("landlord_id")
      .notNull()
      .references(() => landlord.id, { onDelete: "cascade" }),
    municipalityId: text("municipality_id")
      .notNull()
      .references(() => municipality.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.landlordId, t.municipalityId] })],
);

export const source = pgTable(
  "source",
  {
    id: id(),
    landlordId: text("landlord_id")
      .notNull()
      .references(() => landlord.id, { onDelete: "cascade" }),
    kind: sourceKindEnum("kind").notNull(),
    /** Adapter id, e.g. "generic-xml", "generic-json", "html-list". */
    adapter: text("adapter").notNull().default("generic-xml"),
    url: text("url"),
    /** Adapter-specific configuration: field mapping, selectors, auth. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    fetchIntervalMinutes: integer("fetch_interval_minutes").notNull().default(60),
    status: sourceStatusEnum("status").notNull().default("pending"),
    consent: consentEnum("consent").notNull().default("unknown"),
    queueDefault: queueRequirementEnum("queue_default"),
    techContactEmail: text("tech_contact_email"),
    lastRunAt: ts("last_run_at"),
    lastSuccessAt: ts("last_success_at"),
    nextRunAt: ts("next_run_at"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("source_landlord_idx").on(t.landlordId), index("source_status_idx").on(t.status)],
);

export const sourceRun = pgTable(
  "source_run",
  {
    id: id(),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    ok: boolean("ok"),
    listingsFound: integer("listings_found"),
    listingsNew: integer("listings_new"),
    listingsUpdated: integer("listings_updated"),
    listingsGone: integer("listings_gone"),
    errorClass: text("error_class"),
    errorDetail: text("error_detail"),
    anomaly: boolean("anomaly").notNull().default(false),
  },
  (t) => [index("source_run_source_started_idx").on(t.sourceId, t.startedAt)],
);

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export const listing = pgTable(
  "listing",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    landlordId: text("landlord_id")
      .notNull()
      .references(() => landlord.id),
    municipalityId: text("municipality_id")
      .notNull()
      .references(() => municipality.id),
    areaId: text("area_id").references(() => area.id, { onDelete: "set null" }),
    address: text("address").notNull(),
    postcode: text("postcode"),
    areaName: text("area_name"),
    location: geometry("location", { type: "point", mode: "xy", srid: 4326 }),
    rentMonthly: integer("rent_monthly"),
    rooms: real("rooms"),
    sizeSqm: real("size_sqm"),
    floor: integer("floor"),
    floorsTotal: integer("floors_total"),
    contractType: contractTypeEnum("contract_type").notNull().default("first_hand"),
    moveInDate: date("move_in_date", { mode: "string" }),
    applicationDeadline: date("application_deadline", { mode: "string" }),
    queueRequirement: queueRequirementEnum("queue_requirement").notNull().default("unknown"),
    segment: segmentEnum("segment").notNull().default("none"),
    applyRoute: applyRouteEnum("apply_route").notNull().default("url"),
    applicationUrl: text("application_url"),
    applicationContact: text("application_contact"),
    description: text("description"),
    /** Hotlinked image URL from the source; direct listings use listing_image. */
    imageUrl: text("image_url"),
    externalId: text("external_id"),
    status: listingStatusEnum("status").notNull().default("active"),
    publishedDirectly: boolean("published_directly").notNull().default(false),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    lastCheckedAt: ts("last_checked_at").notNull().defaultNow(),
    removedAt: ts("removed_at"),
    publishedAt: ts("published_at"),
    unpublishedAt: ts("unpublished_at"),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    /** For merged duplicates: the surviving listing. */
    mergedIntoId: text("merged_into_id"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("listing_muni_status_rent_idx").on(t.municipalityId, t.status, t.rentMonthly),
    index("listing_status_last_seen_idx").on(t.status, t.lastSeenAt),
    index("listing_status_first_seen_idx").on(t.status, t.firstSeenAt),
    index("listing_landlord_idx").on(t.landlordId),
    index("listing_location_gix").using("gist", t.location),
  ],
);

export const listingSource = pgTable(
  "listing_source",
  {
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    lastCheckedAt: ts("last_checked_at").notNull().defaultNow(),
    presentAtLastCheck: boolean("present_at_last_check").notNull().default(true),
    rawPayload: jsonb("raw_payload"),
    rawPayloadAt: ts("raw_payload_at"),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.sourceId] }),
    uniqueIndex("listing_source_external_uq").on(t.sourceId, t.externalId),
  ],
);

export const listingRevision = pgTable(
  "listing_revision",
  {
    id: id(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    changedAt: ts("changed_at").notNull().defaultNow(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: text("changed_by"),
    /** e.g. "crawl", "portal", "system", "admin" */
    origin: text("origin").notNull().default("crawl"),
  },
  (t) => [index("listing_revision_listing_idx").on(t.listingId, t.changedAt)],
);

export const listingImage = pgTable(
  "listing_image",
  {
    id: id(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("listing_image_listing_idx").on(t.listingId, t.position)],
);

export const listingMetricDaily = pgTable(
  "listing_metric_daily",
  {
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    views: integer("views").notNull().default(0),
    outboundClicks: integer("outbound_clicks").notNull().default(0),
    saves: integer("saves").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

export const duplicateCandidate = pgTable(
  "duplicate_candidate",
  {
    id: id(),
    listingAId: text("listing_a_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    listingBId: text("listing_b_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 4, scale: 3 }).notNull(),
    features: jsonb("features").$type<Record<string, unknown>>().notNull().default({}),
    decision: duplicateDecisionEnum("decision").notNull().default("pending"),
    decidedBy: text("decided_by"),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("duplicate_pair_uq").on(t.listingAId, t.listingBId),
    index("duplicate_decision_idx").on(t.decision),
  ],
);

// ---------------------------------------------------------------------------
// Landlord onboarding and membership
// ---------------------------------------------------------------------------

export const landlordApplication = pgTable(
  "landlord_application",
  {
    id: id(),
    orgNumber: text("org_number").notNull(),
    companyName: text("company_name").notNull(),
    website: text("website"),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    publishingRoute: publishingRouteEnum("publishing_route").notNull(),
    sourceUrl: text("source_url"),
    automatedChecks: jsonb("automated_checks")
      .$type<Array<{ key: string; status: "done" | "warn" | "fail" | "na"; detail?: Record<string, unknown> }>>()
      .notNull()
      .default([]),
    status: applicationStatusEnum("status").notNull().default("pending"),
    /** The Better Auth user created at sign-up; activated on approval. */
    userId: text("user_id"),
    landlordId: text("landlord_id").references(() => landlord.id, { onDelete: "set null" }),
    reviewedBy: text("reviewed_by"),
    reviewedAt: ts("reviewed_at"),
    decisionNote: text("decision_note"),
    locale: text("locale").notNull().default("sv"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("landlord_application_status_idx").on(t.status, t.createdAt)],
);

export const landlordApplicationEvent = pgTable("landlord_application_event", {
  id: id(),
  applicationId: text("application_id")
    .notNull()
    .references(() => landlordApplication.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // submitted | needs_info | approved | rejected | reopened
  message: text("message"),
  actorId: text("actor_id"),
  createdAt: createdAt(),
});

export const landlordMember = pgTable(
  "landlord_member",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    landlordId: text("landlord_id")
      .notNull()
      .references(() => landlord.id, { onDelete: "cascade" }),
    role: landlordRoleEnum("role").notNull().default("editor"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.landlordId] })],
);

export const landlordInvitation = pgTable(
  "landlord_invitation",
  {
    id: id(),
    landlordId: text("landlord_id")
      .notNull()
      .references(() => landlord.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: landlordRoleEnum("role").notNull().default("editor"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: text("invited_by").notNull(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    createdAt: createdAt(),
  },
  (t) => [index("landlord_invitation_landlord_idx").on(t.landlordId)],
);

export const staffUser = pgTable("staff_user", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: staffRoleEnum("role").notNull().default("support"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  locale: text("locale").notNull().default("sv"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    /** Identity provider issuer (Better Auth 1.7 scopes account ids by issuer). */
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId), uniqueIndex("account_issuer_account_uq").on(t.issuer, t.accountId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const municipalityRelations = relations(municipality, ({ many }) => ({
  areas: many(area),
  listings: many(listing),
  landlords: many(landlordMunicipality),
}));

export const areaRelations = relations(area, ({ one, many }) => ({
  municipality: one(municipality, { fields: [area.municipalityId], references: [municipality.id] }),
  listings: many(listing),
}));

export const landlordRelations = relations(landlord, ({ many }) => ({
  sources: many(source),
  listings: many(listing),
  municipalities: many(landlordMunicipality),
  members: many(landlordMember),
  invitations: many(landlordInvitation),
}));

export const landlordMunicipalityRelations = relations(landlordMunicipality, ({ one }) => ({
  landlord: one(landlord, { fields: [landlordMunicipality.landlordId], references: [landlord.id] }),
  municipality: one(municipality, { fields: [landlordMunicipality.municipalityId], references: [municipality.id] }),
}));

export const sourceRelations = relations(source, ({ one, many }) => ({
  landlord: one(landlord, { fields: [source.landlordId], references: [landlord.id] }),
  runs: many(sourceRun),
  listingSources: many(listingSource),
}));

export const sourceRunRelations = relations(sourceRun, ({ one }) => ({
  source: one(source, { fields: [sourceRun.sourceId], references: [source.id] }),
}));

export const listingRelations = relations(listing, ({ one, many }) => ({
  landlord: one(landlord, { fields: [listing.landlordId], references: [landlord.id] }),
  municipality: one(municipality, { fields: [listing.municipalityId], references: [municipality.id] }),
  area: one(area, { fields: [listing.areaId], references: [area.id] }),
  sources: many(listingSource),
  revisions: many(listingRevision),
  images: many(listingImage),
  metrics: many(listingMetricDaily),
}));

export const listingSourceRelations = relations(listingSource, ({ one }) => ({
  listing: one(listing, { fields: [listingSource.listingId], references: [listing.id] }),
  source: one(source, { fields: [listingSource.sourceId], references: [source.id] }),
}));

export const listingRevisionRelations = relations(listingRevision, ({ one }) => ({
  listing: one(listing, { fields: [listingRevision.listingId], references: [listing.id] }),
}));

export const listingImageRelations = relations(listingImage, ({ one }) => ({
  listing: one(listing, { fields: [listingImage.listingId], references: [listing.id] }),
}));

export const listingMetricDailyRelations = relations(listingMetricDaily, ({ one }) => ({
  listing: one(listing, { fields: [listingMetricDaily.listingId], references: [listing.id] }),
}));

export const duplicateCandidateRelations = relations(duplicateCandidate, ({ one }) => ({
  listingA: one(listing, { fields: [duplicateCandidate.listingAId], references: [listing.id], relationName: "dupA" }),
  listingB: one(listing, { fields: [duplicateCandidate.listingBId], references: [listing.id], relationName: "dupB" }),
}));

export const landlordApplicationRelations = relations(landlordApplication, ({ one, many }) => ({
  landlord: one(landlord, { fields: [landlordApplication.landlordId], references: [landlord.id] }),
  events: many(landlordApplicationEvent),
}));

export const landlordApplicationEventRelations = relations(landlordApplicationEvent, ({ one }) => ({
  application: one(landlordApplication, {
    fields: [landlordApplicationEvent.applicationId],
    references: [landlordApplication.id],
  }),
}));

export const landlordMemberRelations = relations(landlordMember, ({ one }) => ({
  user: one(user, { fields: [landlordMember.userId], references: [user.id] }),
  landlord: one(landlord, { fields: [landlordMember.landlordId], references: [landlord.id] }),
}));

export const landlordInvitationRelations = relations(landlordInvitation, ({ one }) => ({
  landlord: one(landlord, { fields: [landlordInvitation.landlordId], references: [landlord.id] }),
}));

export const userRelations = relations(user, ({ many, one }) => ({
  memberships: many(landlordMember),
  staff: one(staffUser, { fields: [user.id], references: [staffUser.userId] }),
}));

export const staffUserRelations = relations(staffUser, ({ one }) => ({
  user: one(user, { fields: [staffUser.userId], references: [user.id] }),
}));

// Convenience type exports
export type Municipality = typeof municipality.$inferSelect;
export type Area = typeof area.$inferSelect;
export type Landlord = typeof landlord.$inferSelect;
export type Source = typeof source.$inferSelect;
export type SourceRun = typeof sourceRun.$inferSelect;
export type Listing = typeof listing.$inferSelect;
export type NewListing = typeof listing.$inferInsert;
export type ListingSource = typeof listingSource.$inferSelect;
export type ListingRevision = typeof listingRevision.$inferSelect;
export type LandlordApplication = typeof landlordApplication.$inferSelect;
export type DuplicateCandidate = typeof duplicateCandidate.$inferSelect;
export type QueueRequirement = (typeof queueRequirementEnum.enumValues)[number];
export type Segment = (typeof segmentEnum.enumValues)[number];
export type ListingStatus = (typeof listingStatusEnum.enumValues)[number];
export type SourceStatus = (typeof sourceStatusEnum.enumValues)[number];
export type SourceKind = (typeof sourceKindEnum.enumValues)[number];
export type LandlordRole = (typeof landlordRoleEnum.enumValues)[number];
export type StaffRole = (typeof staffRoleEnum.enumValues)[number];
