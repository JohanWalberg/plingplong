import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeSource, solnaId } from "@/test-support/db";
import { AdapterError } from "./adapters";

const fetchText = vi.fn();
vi.mock("./fetch", () => ({ politeFetch: { fetchText: (...args: unknown[]) => fetchText(...args) }, USER_AGENT: "test" }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => {} }));

const { syncSource } = await import("./sync");
const { listing, listingSource, listingRevision, source, sourceRun } = schema;

type Item = { id: string; address: string; municipality: string; rent: number; rooms: number; size?: number; url?: string };
const item = (id: string, rent = 9000, address = `Björnstigen ${id}`): Item => ({ id, address, municipality: "Solna", rent, rooms: 2, size: 55, url: `https://feed.test/${id}` });
function feed(items: Item[]) {
  fetchText.mockResolvedValueOnce({ status: 200, text: JSON.stringify({ items }), contentType: "application/json" });
}

const landlords: string[] = [];
let landlordId: string;
let sourceId: string;

beforeAll(async () => {
  await solnaId();
  landlordId = await makeLandlord();
  landlords.push(landlordId);
  sourceId = await makeSource(landlordId);
});
afterAll(() => cleanupLandlords(landlords));

const bySource = () => db.select({ externalId: listingSource.externalId, present: listingSource.presentAtLastCheck, status: listing.status, rent: listing.rentMonthly, id: listing.id }).from(listingSource).innerJoin(listing, eq(listing.id, listingSource.listingId)).where(eq(listingSource.sourceId, sourceId)).orderBy(listingSource.externalId);
const sourceRow = () => db.query.source.findFirst({ where: eq(source.id, sourceId) });

describe("syncSource", () => {
  it("creates listings and source links on the first run", async () => {
    feed([item("A"), item("B")]);
    const out = await syncSource(sourceId);
    expect(out).toMatchObject({ ok: true, found: 2, created: 2, updated: 0, gone: 0, anomaly: false });
    const rows = await bySource();
    expect(rows.map((r) => [r.externalId, r.status, r.rent])).toEqual([
      ["A", "active", 9000],
      ["B", "active", 9000],
    ]);
    expect((await sourceRow())?.status).toBe("active");
  });

  it("updates a changed listing with a revision and removes one absent from a successful run", async () => {
    feed([item("A", 9500)]);
    const out = await syncSource(sourceId);
    expect(out).toMatchObject({ ok: true, updated: 1, gone: 1, created: 0 });
    const rows = await bySource();
    expect(rows.map((r) => [r.externalId, r.status, r.rent, r.present])).toEqual([
      ["A", "active", 9500, true],
      ["B", "removed", 9000, false],
    ]);
    const a = rows.find((r) => r.externalId === "A")!;
    const revs = await db.select({ field: listingRevision.field, oldValue: listingRevision.oldValue, newValue: listingRevision.newValue }).from(listingRevision).where(and(eq(listingRevision.listingId, a.id), eq(listingRevision.field, "rent_monthly")));
    expect(revs).toEqual([{ field: "rent_monthly", oldValue: "9000", newValue: "9500" }]);
  });

  it("keeps everything and degrades the source when the fetch throws", async () => {
    fetchText.mockRejectedValueOnce(new AdapterError("unreachable", "boom"));
    const out = await syncSource(sourceId);
    expect(out.ok).toBe(false);
    const rows = await bySource();
    expect(rows.find((r) => r.externalId === "A")?.status).toBe("active");
    const s = await sourceRow();
    expect(s?.consecutiveFailures).toBe(1);
    expect(s?.status).toBe("degraded");
    const runs = await db.select({ ok: sourceRun.ok, errorClass: sourceRun.errorClass }).from(sourceRun).where(eq(sourceRun.sourceId, sourceId)).orderBy(sourceRun.startedAt);
    expect(runs.at(-1)).toEqual({ ok: false, errorClass: "unreachable" });
  });

  it("revives a removed listing when it reappears, with a status revision", async () => {
    feed([item("A", 9500), item("B")]);
    const out = await syncSource(sourceId);
    expect(out).toMatchObject({ ok: true, updated: 1, created: 0, gone: 0 });
    const rows = await bySource();
    expect(rows.find((r) => r.externalId === "B")).toMatchObject({ status: "active", present: true });
    const b = rows.find((r) => r.externalId === "B")!;
    const revs = await db.select({ oldValue: listingRevision.oldValue, newValue: listingRevision.newValue }).from(listingRevision).where(and(eq(listingRevision.listingId, b.id), eq(listingRevision.field, "status")));
    expect(revs).toContainEqual({ oldValue: "removed", newValue: "active" });
    expect((await sourceRow())?.consecutiveFailures).toBe(0);
  });

  it("attaches a second source of the same landlord to the existing home instead of creating one", async () => {
    const other = await makeSource(landlordId);
    feed([item("X-A", 9500, "Björnstigen A")]);
    const out = await syncSource(other);
    expect(out).toMatchObject({ ok: true, created: 0, found: 1 });
    const links = await db.select({ sourceId: listingSource.sourceId }).from(listingSource).innerJoin(listing, eq(listing.id, listingSource.listingId)).where(and(eq(listing.landlordId, landlordId), eq(listing.address, "Björnstigen A")));
    expect(new Set(links.map((l) => l.sourceId))).toEqual(new Set([sourceId, other]));
  });

  it("flags an anomaly and removes nothing when a feed collapses", async () => {
    const lid = await makeLandlord("Anomali AB");
    landlords.push(lid);
    const sid = await makeSource(lid);
    const ten = Array.from({ length: 10 }, (_, i) => item(`N${i}`));
    feed(ten);
    await syncSource(sid);
    feed(ten);
    await syncSource(sid);
    feed([ten[0]]);
    const out = await syncSource(sid);
    expect(out).toMatchObject({ ok: true, found: 1, gone: 0, anomaly: true });
    const active = await db.select({ id: listing.id }).from(listing).where(and(eq(listing.landlordId, lid), eq(listing.status, "active")));
    expect(active).toHaveLength(10);
    expect((await db.query.source.findFirst({ where: eq(source.id, sid) }))?.status).toBe("needs_review");
  });

  it("records a poison item as a failed run and leaves earlier state intact", async () => {
    feed([item("A", 9500), { ...item("C"), rooms: Number.NaN, rent: 99_999_999_999 }]);
    const before = await bySource();
    const out = await syncSource(sourceId);
    // Either the normaliser clamps the values (ok run) or the run is a recorded failure; it must never be an unhandled rejection.
    expect(typeof out.ok).toBe("boolean");
    const runs = await db.select({ ok: sourceRun.ok, finishedAt: sourceRun.finishedAt }).from(sourceRun).where(eq(sourceRun.sourceId, sourceId));
    expect(runs.every((r) => r.finishedAt !== null)).toBe(true);
    if (!out.ok) expect(await bySource()).toEqual(before);
  });
});

describe("a source staff put in review", () => {
  it("stays in review when a manual run fails, instead of becoming degraded", async () => {
    const lid = await makeLandlord("Granskning AB");
    landlords.push(lid);
    const sid = await makeSource(lid);
    await db.update(source).set({ status: "needs_review" }).where(eq(source.id, sid));

    fetchText.mockRejectedValueOnce(new AdapterError("unreachable", "boom"));
    const out = await syncSource(sid, { force: true });

    expect(out.ok).toBe(false);
    // "degraded" is scheduled again; "needs_review" waits for staff, which is the point.
    expect((await db.query.source.findFirst({ where: eq(source.id, sid) }))?.status).toBe("needs_review");
  });
});

describe("a home staff took down", () => {
  it("stays down when the landlord's feed still offers it", async () => {
    const lid = await makeLandlord("Nedtagning AB");
    landlords.push(lid);
    const sid = await makeSource(lid);

    // The home arrives normally, then staff take it down.
    feed([item("T")]);
    expect(await syncSource(sid)).toMatchObject({ ok: true, created: 1 });
    const [row] = await db.select({ id: listing.id }).from(listingSource).innerJoin(listing, eq(listing.id, listingSource.listingId)).where(eq(listingSource.sourceId, sid));
    const now = new Date();
    await db.update(listing).set({ status: "removed", removedAt: now, takenDownAt: now }).where(eq(listing.id, row.id));

    // The feed has not changed, so the next crawl sees it again. It must not
    // undo the takedown: that would put the home back into search while its own
    // page kept answering 404.
    feed([item("T")]);
    await syncSource(sid);

    const after = await db.query.listing.findFirst({ where: eq(listing.id, row.id), columns: { status: true, takenDownAt: true } });
    expect(after?.status).toBe("removed");
    expect(after?.takenDownAt).not.toBeNull();
  });
});
