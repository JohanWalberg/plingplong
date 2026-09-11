import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, solnaId } from "@/test-support/db";

const sent: Array<{ to: string; subject: string; text: string }> = [];
vi.mock("@/lib/email", () => ({ sendEmail: async (m: { to: string; subject: string; text: string }) => void sent.push(m) }));
vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ locale, href }: { locale: string; href: { pathname: string; params?: Record<string, string> } }) =>
    `/${locale}` + href.pathname.replace(/\[(\w+)\]/g, (_, k) => href.params?.[k] ?? ""),
}));

const { sendAlertDigests } = await import("./alerts");
const { createAlert, confirmAlert, findAlert, deleteAlert, purgeUnconfirmedAlerts, hashAlertToken } = await import("@/lib/queries/alerts");
const { searchAlert } = schema;

const landlords: string[] = [];
let muni: string;
let landlordId: string;
const email = `bevakning-${Date.now()}@test.plingplong`;

beforeAll(async () => {
  muni = await solnaId();
  landlordId = await makeLandlord("Bevakning AB");
  landlords.push(landlordId);
});
beforeEach(() => void (sent.length = 0));
afterAll(async () => {
  await db.delete(searchAlert).where(eq(searchAlert.email, email));
  await cleanupLandlords(landlords);
});

describe("search alerts", () => {
  it("sends nothing before confirmation and a digest of new homes after it", async () => {
    const created = await createAlert({ email, locale: "sv", label: "Solna, max 10 000 kr", municipalityId: muni, query: { maxRent: "10000" } });
    expect(created).not.toBeNull();
    const { token } = created!;
    await makeListing(landlordId, muni, { rentMonthly: 9000, address: "Före bekräftelse 1" });

    expect(await sendAlertDigests()).toBe(0);
    expect(sent).toHaveLength(0);

    expect(await confirmAlert(token)).toBe(true);
    // Homes that existed before the confirmation are not "new".
    expect(await sendAlertDigests()).toBe(0);

    await makeListing(landlordId, muni, { rentMonthly: 8500, address: "Nytt hem 1" });
    await makeListing(landlordId, muni, { rentMonthly: 12000, address: "För dyrt" }); // filtered out by maxRent
    expect(await sendAlertDigests()).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].subject).toContain("En ny bostad");
    expect(sent[0].text).toContain("Nytt hem 1");
    expect(sent[0].text).not.toContain("För dyrt");
    expect(sent[0].text).not.toContain("__TOKEN__");

    // The next morning without new homes sends nothing; the old link is gone, the one in the mail works.
    expect(await sendAlertDigests()).toBe(0);
    expect(await findAlert(token)).toBeNull();
    const newToken = sent[0].text.match(/alerts\/([A-Za-z0-9_-]+)/)![1];
    const found = await findAlert(newToken);
    expect(found?.email).toBe(email);
    expect(await deleteAlert(newToken)).toBe(true);
    expect(await findAlert(newToken)).toBeNull();
  });

  it("re-requesting the same search reuses the row and unconfirmed rows are purged after a week", async () => {
    const a = await createAlert({ email, locale: "sv", label: "Solna", municipalityId: muni, query: {} });
    const b = await createAlert({ email, locale: "sv", label: "Solna", municipalityId: muni, query: {} });
    expect(a && b).toBeTruthy();
    const rows = await db.select({ id: searchAlert.id, hash: searchAlert.tokenHash }).from(searchAlert).where(and(eq(searchAlert.email, email), eq(searchAlert.label, "Solna")));
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).toBe(hashAlertToken(b!.token));

    expect(await purgeUnconfirmedAlerts()).toBe(0);
    await db.update(searchAlert).set({ createdAt: new Date(Date.now() - 8 * 86_400_000) }).where(eq(searchAlert.id, rows[0].id));
    expect(await purgeUnconfirmedAlerts()).toBeGreaterThanOrEqual(1);
    expect(await findAlert(b!.token)).toBeNull();
  });
});
