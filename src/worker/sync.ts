import { and, desc, eq, inArray, isNull, lt, lte, notInArray, or, sql, ne } from "drizzle-orm";
import { stockholmDate } from "@/lib/format";
import { db, schema, type Db, type Tx } from "@/db";
import { listingSlug, slugify } from "@/lib/slug";
import { insertWithUniqueSlug } from "@/lib/queries/slug";
import { LISTING_TRACKED, diffTracked } from "@/lib/queries/revisions";
import { landlordLocale } from "@/lib/queries/landlords";
import { withPlainApiKey } from "@/lib/secrets";
import { reportError } from "@/lib/observability";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { getAdapter, AdapterError, sniffFeedAdapter, type AdapterResult } from "./adapters";
import { politeFetch } from "./fetch";
import { normalise, type NormalisedListing } from "./normalise";
import { isAnomalousDrop } from "./anomaly";
import { blockKey, decide, scorePair, type DedupSubject } from "./dedup";

const { source, sourceRun, listing, listingSource, listingRevision, area, landlord, duplicateCandidate } = schema;

const MAX_ITEMS_PER_RUN = 5000;

/** `municipalityIds` are the places this run touched, so the web app can clear only their pages. */
type SyncOutcome = { ok: boolean; found: number; created: number; updated: number; gone: number; anomaly: boolean; error?: string; landlordId?: string; municipalityIds?: string[] };

/**
 * One crawl of one source. Rules (see brief §2–3):
 * - last_checked_at is set for every listing we saw or looked for on success.
 * - Absent on a successful run → removed (unless the anomaly guard fires).
 * - Failed run → nothing removed, source degraded/failed, contact emailed at 3.
 */
/** `manual` marks an on-demand run; `force` (staff only) is the sole way to run a disabled source. Objected sources never run. */
export async function syncSource(sourceId: string, opts: { manual?: boolean; force?: boolean } = {}): Promise<SyncOutcome> {
  const src = await db.query.source.findFirst({ where: eq(source.id, sourceId), with: { landlord: { with: { municipalities: true } } } });
  if (!src) throw new Error(`source ${sourceId} not found`);
  if (src.consent === "objected") return { ok: false, found: 0, created: 0, updated: 0, gone: 0, anomaly: false, error: "objected" };
  if (src.status === "disabled" && !opts.force) return { ok: false, found: 0, created: 0, updated: 0, gone: 0, anomaly: false, error: "disabled" };
  if (src.kind === "manual" || !src.url) return { ok: true, found: 0, created: 0, updated: 0, gone: 0, anomaly: false };

  const [run] = await db.insert(sourceRun).values({ sourceId }).returning({ id: sourceRun.id });
  const now = new Date();

  let result: AdapterResult;
  try {
    const config = withPlainApiKey((src.config ?? {}) as import("./adapters").SourceConfig);
    if (src.kind === "feed" || src.kind === "api") {
      // Feeds sniff JSON vs XML from the payload so a mislabelled adapter still works.
      const res = await politeFetch.fetchText(src.url, { headers: { ...(config.headers ?? {}), ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}) } });
      if (res.status >= 400) throw new AdapterError(res.status === 401 || res.status === 403 ? "auth" : "http_error", `HTTP ${res.status}`, res.status);
      const adapter = src.adapter === "generic-json" || src.adapter === "generic-xml" ? sniffFeedAdapter(res.text, res.contentType) : getAdapter(src.adapter);
      result = adapter.parse(res.text, config);
    } else {
      result = await getAdapter(src.adapter).fetch(src.url, config, politeFetch);
    }
  } catch (e) {
    return await recordFailure(src, run.id, e, now);
  }

  const found = result.listings.length;

  // Anomaly guard against the trailing median of the last five successful runs.
  const previous = await db
    .select({ found: sourceRun.listingsFound })
    .from(sourceRun)
    // Runs flagged as anomalies stay out of the baseline, otherwise three empty runs would pull the median to zero and switch the guard off.
    .where(and(eq(sourceRun.sourceId, src.id), eq(sourceRun.ok, true), eq(sourceRun.anomaly, false), sql`${sourceRun.id} <> ${run.id}`))
    .orderBy(desc(sourceRun.startedAt))
    .limit(5);
  const { anomaly } = isAnomalousDrop(found, previous.map((p) => p.found ?? 0));

  // Resolve municipalities for this landlord's listings.
  const munis = await db.query.municipality.findMany({ columns: { id: true, nameSv: true, nameEn: true, slugSv: true, code: true } });
  const muniByName = new Map<string, string>();
  for (const m of munis) {
    muniByName.set(m.nameSv.toLowerCase(), m.id);
    muniByName.set(m.nameEn.toLowerCase(), m.id);
    muniByName.set(m.slugSv, m.id);
  }
  const fallbackMuni = src.landlord.municipalities.length === 1 ? src.landlord.municipalities[0].municipalityId : null;
  const areas = await db.query.area.findMany({ columns: { id: true, municipalityId: true, name: true, slug: true }, extras: { lat: sql<number | null>`ST_Y(${area.centroid})`.as("lat"), lon: sql<number | null>`ST_X(${area.centroid})`.as("lon") } });

  // Only the columns the loop reads: the full row would drag the geometry through the driver for every listing.
  const existing = await db
    .select({
      ls: { externalId: listingSource.externalId, presentAtLastCheck: listingSource.presentAtLastCheck },
      l: {
        id: listing.id,
        status: listing.status,
        areaId: listing.areaId,
        postcode: listing.postcode,
        floor: listing.floor,
        description: listing.description,
        applicationUrl: listing.applicationUrl,
        removedAt: listing.removedAt,
        rentMonthly: listing.rentMonthly,
        rooms: listing.rooms,
        sizeSqm: listing.sizeSqm,
        applicationDeadline: listing.applicationDeadline,
        moveInDate: listing.moveInDate,
        address: listing.address,
        queueRequirement: listing.queueRequirement,
      },
    })
    .from(listingSource)
    .innerJoin(listing, eq(listing.id, listingSource.listingId))
    .where(eq(listingSource.sourceId, src.id));
  const byExternalId = new Map(existing.map((e) => [e.ls.externalId, e]));

  // Every listing of this landlord, so an item new to this source attaches to the same home seen through another source without a query per item.
  const siblingKey = (municipalityId: string, address: string) => `${municipalityId}|${address.toLowerCase()}`;
  const siblings = new Map<string, Array<{ id: string; status: string; rooms: number | null }>>();
  for (const row of await db.select({ id: listing.id, status: listing.status, municipalityId: listing.municipalityId, address: listing.address, rooms: listing.rooms }).from(listing).where(eq(listing.landlordId, src.landlordId))) {
    const key = siblingKey(row.municipalityId, row.address);
    siblings.set(key, [...(siblings.get(key) ?? []), row]);
  }

  let created = 0;
  let updated = 0;
  const seen = new Set<string>();
  const touchedMunicipalities = new Set<string>();
  const newListingIds: string[] = [];
  type RevisionRow = typeof listingRevision.$inferInsert;
  type LinkRow = typeof listingSource.$inferInsert;

  // One feed must not monopolise the single worker; beyond this the source is treated as broken.
  if (result.listings.length > MAX_ITEMS_PER_RUN) return await recordFailure(src, run.id, new AdapterError("parse_error", `feed has ${result.listings.length} items, limit ${MAX_ITEMS_PER_RUN}`), now);

  // From here on a bad item (out-of-range number, unique clash) must end as a
  // recorded failure, not an unhandled rejection that leaves the run open. The
  // whole run is one transaction so a failure leaves the previous state intact.
  let gone = 0;
  try {
    await db.transaction(async (tx) => {
      const revisions: RevisionRow[] = [];
      const links: LinkRow[] = [];
      const touched: string[] = []; // existing rows seen again with nothing to write but the timestamps

      for (const raw of result.listings) {
        const n = normalise(raw, now, src.url ?? undefined);
        if (seen.has(n.externalId)) continue;
        seen.add(n.externalId);
        const queueRequirement = n.queueRequirement === "unknown" && src.queueDefault ? src.queueDefault : n.queueRequirement;
        const municipalityId = (n.municipalityName && (muniByName.get(n.municipalityName.toLowerCase()) ?? muniByName.get(slugify(n.municipalityName)))) || fallbackMuni;
        if (!municipalityId) continue; // cannot place the listing; counted in found but not stored
        touchedMunicipalities.add(municipalityId);
        const matchedArea = n.areaName ? areas.find((a) => a.municipalityId === municipalityId && (a.name.toLowerCase() === n.areaName!.toLowerCase() || a.slug === slugify(n.areaName!))) : undefined;
        const lat = n.lat ?? matchedArea?.lat ?? null;
        const lon = n.lon ?? matchedArea?.lon ?? null;

        const found = byExternalId.get(n.externalId);
        if (found) {
          const changes = diffFields(found.l, { ...n, queueRequirement });
          const wasGone = found.l.status === "removed";
          await tx
            .update(listing)
            .set({
              address: n.address,
              areaName: n.areaName,
              areaId: matchedArea?.id ?? found.l.areaId,
              postcode: n.postcode ?? found.l.postcode,
              rentMonthly: n.rentMonthly,
              rooms: n.rooms,
              sizeSqm: n.sizeSqm,
              floor: n.floor ?? found.l.floor,
              moveInDate: n.moveInDate,
              applicationDeadline: n.applicationDeadline,
              queueRequirement,
              segment: n.segment,
              contractType: n.contractType,
              description: n.description ?? found.l.description,
              imageUrl: n.imageUrl,
              applicationUrl: n.sourceUrl ?? found.l.applicationUrl,
              location: lat !== null && lon !== null ? { x: lon, y: lat } : undefined,
              lastSeenAt: now,
              lastCheckedAt: now,
              status: wasGone ? "active" : found.l.status,
              removedAt: wasGone ? null : found.l.removedAt,
            })
            .where(eq(listing.id, found.l.id));
          await tx
            .update(listingSource)
            .set({ lastSeenAt: now, lastCheckedAt: now, presentAtLastCheck: true, sourceUrl: n.sourceUrl, rawPayload: n.raw as object, rawPayloadAt: now })
            .where(and(eq(listingSource.listingId, found.l.id), eq(listingSource.sourceId, src.id)));
          if (wasGone) changes.push({ field: "status", oldValue: "removed", newValue: "active" });
          if (changes.length) {
            updated++;
            revisions.push(...changes.map((c) => ({ listingId: found.l.id, ...c, origin: "crawl", changedAt: now })));
          }
          continue;
        }

        // New to this source: attach to an existing listing of the same landlord at the same address, else create.
        const key = siblingKey(municipalityId, n.address);
        const sibling = (siblings.get(key) ?? []).find((s) => n.rooms === null || s.rooms === n.rooms);
        let listingId: string;
        if (sibling) {
          listingId = sibling.id;
          if (sibling.status === "removed") {
            await tx.update(listing).set({ status: "active", removedAt: null, lastSeenAt: now, lastCheckedAt: now }).where(eq(listing.id, listingId));
            revisions.push({ listingId, field: "status", oldValue: "removed", newValue: "active", origin: "crawl", changedAt: now });
            sibling.status = "active";
          } else touched.push(listingId);
        } else {
          const muniName = munis.find((m) => m.id === municipalityId)!.nameSv;
          const base = listingSlug(n.address, muniName);
          const [row] = await insertWithUniqueSlug(tx, listing, base, (sp, slug) =>
            sp
              .insert(listing)
              .values({
                slug,
                landlordId: src.landlordId,
                municipalityId,
                areaId: matchedArea?.id ?? null,
                address: n.address,
                postcode: n.postcode,
                areaName: n.areaName,
                location: lat !== null && lon !== null ? { x: lon, y: lat } : null,
                rentMonthly: n.rentMonthly,
                rooms: n.rooms,
                sizeSqm: n.sizeSqm,
                floor: n.floor,
                floorsTotal: n.floorsTotal,
                contractType: n.contractType,
                moveInDate: n.moveInDate,
                applicationDeadline: n.applicationDeadline,
                queueRequirement,
                segment: n.segment,
                applyRoute: "url",
                applicationUrl: n.sourceUrl,
                description: n.description,
                imageUrl: n.imageUrl,
                externalId: n.externalId,
                status: "active",
                publishedDirectly: false,
                firstSeenAt: now,
                lastSeenAt: now,
                lastCheckedAt: now,
              })
              .returning({ id: listing.id }),
          );
          listingId = row.id;
          created++;
          newListingIds.push(listingId);
          siblings.set(key, [...(siblings.get(key) ?? []), { id: listingId, status: "active", rooms: n.rooms }]);
        }
        links.push({ listingId, sourceId: src.id, externalId: n.externalId, sourceUrl: n.sourceUrl, firstSeenAt: now, lastSeenAt: now, lastCheckedAt: now, presentAtLastCheck: true, rawPayload: n.raw as object, rawPayloadAt: now });
      }

      if (touched.length) await tx.update(listing).set({ lastSeenAt: now, lastCheckedAt: now }).where(inArray(listing.id, touched));
      for (const part of chunk(links)) await tx.insert(listingSource).values(part).onConflictDoNothing();

      // Removals: present in DB for this source but absent from a successful run.
      const absent = existing.filter((e) => !seen.has(e.ls.externalId) && e.ls.presentAtLastCheck);
      const absentIds = absent.map((e) => e.l.id);
      if (absent.length && !anomaly) {
        await tx.update(listingSource).set({ presentAtLastCheck: false, lastCheckedAt: now }).where(and(eq(listingSource.sourceId, src.id), inArray(listingSource.listingId, absentIds)));
        const elsewhere = new Set(
          (await tx.select({ id: listingSource.listingId }).from(listingSource).where(and(inArray(listingSource.listingId, absentIds), eq(listingSource.presentAtLastCheck, true), ne(listingSource.sourceId, src.id)))).map((r) => r.id),
        );
        const remove = absent.filter((e) => e.l.status === "active" && !elsewhere.has(e.l.id)).map((e) => e.l.id);
        const keep = absentIds.filter((id) => !remove.includes(id));
        if (remove.length) {
          await tx.update(listing).set({ status: "removed", removedAt: now, lastCheckedAt: now }).where(inArray(listing.id, remove));
          revisions.push(...remove.map((id) => ({ listingId: id, field: "status", oldValue: "active", newValue: "removed", origin: "crawl", changedAt: now })));
        }
        if (keep.length) await tx.update(listing).set({ lastCheckedAt: now }).where(inArray(listing.id, keep));
        gone = remove.length;
      } else if (absent.length) {
        // Anomaly: keep the rows untouched but record that we looked.
        await tx.update(listing).set({ lastCheckedAt: now }).where(inArray(listing.id, absentIds));
      }

      for (const part of chunk(revisions)) await tx.insert(listingRevision).values(part);

      await tx.update(sourceRun).set({ finishedAt: new Date(), ok: true, listingsFound: found, listingsNew: created, listingsUpdated: updated, listingsGone: gone, anomaly }).where(eq(sourceRun.id, run.id));
      await tx
        .update(source)
        .set({
          status: src.status === "disabled" ? "disabled" : anomaly ? "needs_review" : src.status === "needs_review" ? "needs_review" : "active",
          lastRunAt: now,
          lastSuccessAt: now,
          nextRunAt: new Date(now.getTime() + src.fetchIntervalMinutes * 60_000),
          consecutiveFailures: 0,
          lastError: null,
        })
        .where(eq(source.id, src.id));
      await tx.update(landlord).set({ isMonitored: true }).where(eq(landlord.id, src.landlordId));
    });
  } catch (e) {
    return await recordFailure(src, run.id, e instanceof AdapterError ? e : new AdapterError("parse_error", `sync failed: ${(e as Error).message}`), now);
  }

  if (newListingIds.length) await findDuplicates(newListingIds);

  return { ok: true, found, created, updated, gone, anomaly, landlordId: src.landlordId, municipalityIds: [...touchedMunicipalities] };
}

async function recordFailure(src: typeof source.$inferSelect & { landlord: { name: string } }, runId: string, e: unknown, now: Date): Promise<SyncOutcome> {
  const raw = e instanceof AdapterError ? e : new AdapterError("unreachable", (e as Error).message);
  // Remote error text (JSON.parse snippets, HTTP bodies) is untrusted: keep it short before it reaches the UI or an email.
  const err = new AdapterError(raw.errorClass, raw.message.replace(/\s+/g, " ").slice(0, 300), raw.status);
  const failures = src.consecutiveFailures + 1;
  await db.update(sourceRun).set({ finishedAt: new Date(), ok: false, errorClass: err.errorClass, errorDetail: err.message }).where(eq(sourceRun.id, runId));
  await db
    .update(source)
    .set({
      status: src.status === "disabled" ? "disabled" : failures >= 3 ? "failed" : "degraded",
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + Math.min(src.fetchIntervalMinutes * 60_000 * 2 ** Math.min(failures, 4), 24 * 60 * 60_000)),
      consecutiveFailures: failures,
      lastError: `${err.errorClass}: ${err.message}`,
    })
    .where(eq(source.id, src.id));
  if (failures === 3 && src.techContactEmail) {
    try {
      const mail = await renderEmail(await landlordLocale(src.landlordId), "sourceFailed", { source: src.url ?? src.landlord.name, count: failures, error: err.message });
      await sendEmail({ to: src.techContactEmail, ...mail });
    } catch (mailErr) {
      reportError(mailErr, { kind: "tech contact email", sourceId: src.id });
    }
  }
  return { ok: false, found: 0, created: 0, updated: 0, gone: 0, anomaly: false, error: `${err.errorClass}: ${err.message}` };
}

/** Multi-row inserts in slices so a 5000-item feed does not build one giant statement. */
function chunk<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function diffFields(before: { [K in keyof typeof LISTING_TRACKED]?: unknown }, after: NormalisedListing & { queueRequirement: string }) {
  return diffTracked(LISTING_TRACKED, before, after);
}

/** Score new listings against active listings in the same block; write candidates for staff. */
export async function findDuplicates(listingIds: string[]) {
  const subjects = await loadSubjects(listingIds);
  for (const s of subjects) {
    const rentLow = s.rentMonthly === null ? null : s.rentMonthly - 750;
    const rentHigh = s.rentMonthly === null ? null : s.rentMonthly + 750;
    const candidates = await db
      .select({ id: listing.id, landlordId: listing.landlordId, municipalityId: listing.municipalityId, address: listing.address, rentMonthly: listing.rentMonthly, rooms: listing.rooms, sizeSqm: listing.sizeSqm, lat: sql<number | null>`ST_Y(${listing.location})`, lon: sql<number | null>`ST_X(${listing.location})` })
      .from(listing)
      .where(
        and(
          eq(listing.municipalityId, s.municipalityId),
          eq(listing.status, "active"),
          sql`${listing.id} <> ${s.id}`,
          rentLow === null ? sql`true` : sql`(${listing.rentMonthly} is null or ${listing.rentMonthly} between ${rentLow} and ${rentHigh})`,
          s.rooms === null ? sql`true` : sql`(${listing.rooms} is null or floor(${listing.rooms}) = ${Math.floor(s.rooms)})`,
        ),
      )
      .limit(200);
    for (const c of candidates) {
      if (blockKey(c) !== blockKey(s) && s.rentMonthly !== null && c.rentMonthly !== null && Math.abs(s.rentMonthly - c.rentMonthly) > 500) continue;
      const score = scorePair(s, c);
      const verdict = decide(score, s.landlordId === c.landlordId);
      if (verdict === "ignore") continue;
      if (verdict === "merge") {
        await mergeListings(c.id, s.id, null);
        break;
      }
      const [a, b] = s.id < c.id ? [s.id, c.id] : [c.id, s.id];
      await db.insert(duplicateCandidate).values({ listingAId: a, listingBId: b, score: score.score.toFixed(3), features: score.features }).onConflictDoNothing();
    }
  }
}

async function loadSubjects(ids: string[]): Promise<DedupSubject[]> {
  if (!ids.length) return [];
  return db
    .select({ id: listing.id, landlordId: listing.landlordId, municipalityId: listing.municipalityId, address: listing.address, rentMonthly: listing.rentMonthly, rooms: listing.rooms, sizeSqm: listing.sizeSqm, lat: sql<number | null>`ST_Y(${listing.location})`, lon: sql<number | null>`ST_X(${listing.location})` })
    .from(listing)
    .where(inArray(listing.id, ids));
}

/** Merge `loserId` into `survivorId`: move sources, mark the loser removed and pointing at the survivor. */
export async function mergeListings(survivorId: string, loserId: string, actorId: string | null, exec: Db | Tx = db) {
  const run = async (tx: Db | Tx) => {
    const now = new Date();
    // Delete before re-inserting: the (source, external id) unique index would otherwise reject the survivor's copy while the loser's row still exists.
    const loserSources = await tx.delete(listingSource).where(eq(listingSource.listingId, loserId)).returning();
    if (loserSources.length) await tx.insert(listingSource).values(loserSources.map((ls) => ({ ...ls, listingId: survivorId }))).onConflictDoNothing();
    await tx.update(listing).set({ status: "removed", removedAt: now, mergedIntoId: survivorId, lastCheckedAt: now }).where(eq(listing.id, loserId));
    await tx.insert(listingRevision).values({ listingId: loserId, field: "status", oldValue: "active", newValue: "removed", origin: actorId ? "admin" : "system", changedBy: actorId, changedAt: now });
    await tx.update(duplicateCandidate).set({ decision: "merged", decidedAt: now, decidedBy: actorId }).where(sql`(${duplicateCandidate.listingAId} = ${loserId} or ${duplicateCandidate.listingBId} = ${loserId}) and ${duplicateCandidate.decision} = 'pending'`);
  };
  // Standalone callers get their own transaction; callers already inside one pass it in.
  if (exec === db) await db.transaction((tx) => run(tx));
  else await run(exec);
}

/**
 * A landlord objected, or closed their account: nothing crawled from these
 * sources may stay in search. Their links are marked absent and every listing
 * that no other present source still carries is removed, with a revision
 * saying why. The crawler already refuses to run an objected source, so this
 * is what clears what it collected earlier.
 */
export async function withdrawSources(sourceIds: string[], actorId: string | null, exec: Db | Tx = db): Promise<number> {
  if (!sourceIds.length) return 0;
  const run = async (tx: Db | Tx) => {
    const now = new Date();
    const linked = await tx.select({ id: listingSource.listingId }).from(listingSource).where(inArray(listingSource.sourceId, sourceIds));
    const ids = [...new Set(linked.map((l) => l.id))];
    if (!ids.length) return 0;
    await tx.update(listingSource).set({ presentAtLastCheck: false, lastCheckedAt: now }).where(inArray(listingSource.sourceId, sourceIds));
    const elsewhere = new Set(
      (
        await tx
          .select({ id: listingSource.listingId })
          .from(listingSource)
          .where(and(inArray(listingSource.listingId, ids), eq(listingSource.presentAtLastCheck, true), notInArray(listingSource.sourceId, sourceIds)))
      ).map((r) => r.id),
    );
    const orphaned = ids.filter((id) => !elsewhere.has(id));
    if (!orphaned.length) return 0;
    const removed = await tx
      .update(listing)
      .set({ status: "removed", removedAt: now, takenDownAt: now, lastCheckedAt: now })
      .where(and(inArray(listing.id, orphaned), eq(listing.status, "active")))
      .returning({ id: listing.id });
    if (removed.length) {
      await tx.insert(listingRevision).values(
        removed.map((r) => ({ listingId: r.id, field: "status", oldValue: "active", newValue: "removed", origin: actorId ? "admin" : "system", changedBy: actorId, changedAt: now })),
      );
    }
    return removed.length;
  };
  return exec === db ? db.transaction((tx) => run(tx)) : run(exec);
}

/** Direct listings: seven days after the deadline they expire automatically. */
export async function expireDirectListings(now: Date = new Date()) {
  const cutoff = stockholmDate(new Date(now.getTime() - 7 * 24 * 60 * 60_000));
  const rows = await db
    .update(listing)
    .set({ status: "expired", unpublishedAt: now, lastCheckedAt: now })
    .where(and(eq(listing.publishedDirectly, true), eq(listing.status, "active"), sql`${listing.applicationDeadline} < ${cutoff}`))
    .returning({ id: listing.id });
  if (rows.length) await db.insert(listingRevision).values(rows.map((r) => ({ listingId: r.id, field: "status", oldValue: "active", newValue: "expired", origin: "system", changedAt: now })));
  return rows.length;
}

/** Raw payload retention: 90 days. */
export async function pruneRawPayloads(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  await db.update(listingSource).set({ rawPayload: null, rawPayloadAt: null }).where(lt(listingSource.rawPayloadAt, cutoff));
}

/** Sources due for a run (used by the scheduler). */
export async function dueSources(now: Date = new Date()) {
  return db
    .select({ id: source.id })
    .from(source)
    // Sources in review wait for staff (markSourceReviewed re-arms them); objected sources never run.
    .where(and(inArray(source.status, ["pending", "active", "degraded", "failed"]), ne(source.consent, "objected"), inArray(source.kind, ["feed", "api", "html"]), or(isNull(source.nextRunAt), lte(source.nextRunAt, now))));
}

