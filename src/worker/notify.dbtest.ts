import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, solnaId } from "@/test-support/db";
import { stockholmDate } from "@/lib/format";

const sent: Array<{ to: string; subject: string; text: string }> = [];
vi.mock("@/lib/email", () => ({ sendEmail: async (m: { to: string; subject: string; text: string }) => void sent.push(m) }));
// next-intl's client navigation cannot be imported outside Next; the portal link is all we need from it.
vi.mock("@/i18n/navigation", () => ({ getPathname: ({ locale }: { locale: string }) => `/${locale}/portal/bostader` }));

const { notifyExpiringListings, EXPIRY_NOTICE_DAYS } = await import("./notify");
const { user, landlordMember, listing } = schema;

const landlords: string[] = [];
const users: string[] = [];
let muni: string;
let landlordId: string;

const day = (offset: number) => stockholmDate(new Date(Date.now() + offset * 86_400_000));

async function owner(email: string, locale: "sv" | "en", role: "owner" | "editor" = "owner") {
  const [u] = await db.insert(user).values({ id: crypto.randomUUID(), name: email, email, locale }).returning({ id: user.id });
  users.push(u.id);
  await db.insert(landlordMember).values({ userId: u.id, landlordId, role });
  return u.id;
}

beforeAll(async () => {
  muni = await solnaId();
  landlordId = await makeLandlord("Påminnelse AB");
  landlords.push(landlordId);
  await owner("agare@paminnelse.test", "sv");
});
beforeEach(() => void (sent.length = 0));
afterAll(async () => {
  await cleanupLandlords(landlords);
  for (const id of users) await db.delete(user).where(eq(user.id, id));
});

describe("notifyExpiringListings", () => {
  it("emails the owner once per home reaching the notice day, in their locale", async () => {
    const a = await makeListing(landlordId, muni, { publishedDirectly: true, address: "Deadlinegatan 1", applicationDeadline: day(EXPIRY_NOTICE_DAYS) });
    const b = await makeListing(landlordId, muni, { publishedDirectly: true, address: "Deadlinegatan 2", applicationDeadline: day(EXPIRY_NOTICE_DAYS) });

    expect(await notifyExpiringListings()).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("agare@paminnelse.test");
    expect(sent[0].subject).toContain("2 bostäder");
    expect(sent[0].text).toContain("Deadlinegatan 1");
    expect(sent[0].text).toContain("Deadlinegatan 2");
    await db.delete(listing).where(eq(listing.id, a));
    await db.delete(listing).where(eq(listing.id, b));
  });

  it("ignores homes that are further out, already past, or not published here", async () => {
    await makeListing(landlordId, muni, { publishedDirectly: true, applicationDeadline: day(EXPIRY_NOTICE_DAYS + 1) });
    await makeListing(landlordId, muni, { publishedDirectly: true, applicationDeadline: day(EXPIRY_NOTICE_DAYS - 1) });
    await makeListing(landlordId, muni, { publishedDirectly: true, applicationDeadline: null });
    await makeListing(landlordId, muni, { publishedDirectly: false, applicationDeadline: day(EXPIRY_NOTICE_DAYS) });
    await makeListing(landlordId, muni, { publishedDirectly: true, status: "draft", applicationDeadline: day(EXPIRY_NOTICE_DAYS) });

    expect(await notifyExpiringListings()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("writes to every owner in their own language and skips editors", async () => {
    await owner("english@paminnelse.test", "en");
    await owner("redaktor@paminnelse.test", "sv", "editor");
    await makeListing(landlordId, muni, { publishedDirectly: true, address: "Tvåspråksvägen 3", applicationDeadline: day(EXPIRY_NOTICE_DAYS) });

    expect(await notifyExpiringListings()).toBe(2);
    expect(sent.map((m) => m.to).sort()).toEqual(["agare@paminnelse.test", "english@paminnelse.test"]);
    expect(sent.find((m) => m.to.startsWith("english"))?.subject).toContain("Application deadline");
  });
});
