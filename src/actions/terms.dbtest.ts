import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, leadUserId, solnaId } from "@/test-support/db";

let staffId = "";
vi.mock("@/lib/access", () => ({
  requireStaff: async () => ({ userId: staffId, email: "lead@hyrabostad.se", name: "Lead", locale: "sv", sessionCreatedAt: new Date(), role: "lead" }),
}));
vi.mock("@/lib/email", () => ({ sendEmail: async () => {} }));
vi.mock("@/i18n/navigation", () => ({ getPathname: ({ locale }: { locale: string }) => `/${locale}/portal/sign-in`, redirect: () => {} }));
vi.mock("@/lib/jobs", () => ({ enqueueSourceSync: async () => {}, enqueueAllSyncs: async () => 0 }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/listing-cache", () => ({ invalidateListingCaches: () => {} }));

const { approveApplication } = await import("./admin");
const { landlord, landlordApplication, landlordApplicationEvent } = schema;

const applications: string[] = [];
const landlords: string[] = [];

beforeAll(async () => {
  await solnaId();
  staffId = await leadUserId();
});
afterAll(async () => {
  for (const id of applications) {
    await db.delete(landlordApplicationEvent).where(eq(landlordApplicationEvent.applicationId, id));
    await db.delete(landlordApplication).where(eq(landlordApplication.id, id));
  }
  await cleanupLandlords(landlords);
});

async function application(termsAcceptedAt: Date | null, orgNumber: string) {
  const [row] = await db
    .insert(landlordApplication)
    .values({
      orgNumber,
      companyName: `Villkor ${orgNumber} AB`,
      contactName: "Test Testsson",
      contactEmail: `villkor-${orgNumber}@test.invalid`,
      publishingRoute: "manual",
      termsAcceptedAt,
      locale: "sv",
    })
    .returning({ id: landlordApplication.id });
  applications.push(row.id);
  return row.id;
}

const landlordFor = async (appId: string) => {
  const app = await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, appId) });
  const l = await db.query.landlord.findFirst({ where: eq(landlord.id, app!.landlordId!) });
  landlords.push(l!.id);
  return l!;
};

describe("terms acceptance", () => {
  it("carries the applicant's acceptance onto the landlord at approval", async () => {
    const accepted = new Date("2026-09-01T10:30:00Z");
    const appId = await application(accepted, "556000-0101");
    expect(await approveApplication("sv", appId)).toEqual({ ok: true });
    const l = await landlordFor(appId);
    expect(l.termsAcceptedAt?.toISOString()).toBe(accepted.toISOString());
    expect(l.approvedAt).not.toBeNull();
  });

  it("falls back to the approval time for an application from before the column existed", async () => {
    const appId = await application(null, "556000-0202");
    const before = new Date();
    expect(await approveApplication("sv", appId)).toEqual({ ok: true });
    const l = await landlordFor(appId);
    expect(l.termsAcceptedAt).not.toBeNull();
    expect(l.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("records acceptance when an existing landlord row is adopted", async () => {
    const accepted = new Date("2026-08-15T08:00:00Z");
    const [existing] = await db
      .insert(landlord)
      .values({ name: "Redan Känd AB", slug: `zz-terms-${Date.now().toString(36)}`, orgNumber: "556000-0303", type: "private", queueType: "unknown" })
      .returning({ id: landlord.id });
    landlords.push(existing.id);
    const appId = await application(accepted, "556000-0303");
    expect(await approveApplication("sv", appId)).toEqual({ ok: true });
    const l = await db.query.landlord.findFirst({ where: eq(landlord.id, existing.id) });
    expect(l?.termsAcceptedAt?.toISOString()).toBe(accepted.toISOString());
  });
});

describe("existing applications", () => {
  it("all carry an acceptance timestamp, so approval never has to guess", async () => {
    const rows = await db
      .select({ id: landlordApplication.id, acceptedAt: landlordApplication.termsAcceptedAt })
      .from(landlordApplication)
      .where(sql`${landlordApplication.id} not in ${applications}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.acceptedAt === null)).toEqual([]);
  });
});
