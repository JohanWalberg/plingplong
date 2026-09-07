import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { solnaId } from "@/test-support/db";
import { ABANDONED_RETENTION_DAYS, REJECTED_RETENTION_DAYS, purgeApplications } from "./retention";

const { landlordApplication, landlordApplicationEvent, user } = schema;
const made: { apps: string[]; users: string[] } = { apps: [], users: [] };

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

beforeAll(async () => void (await solnaId()));
afterEach(async () => {
  if (made.apps.length) {
    await db.delete(landlordApplicationEvent).where(inArray(landlordApplicationEvent.applicationId, made.apps));
    await db.delete(landlordApplication).where(inArray(landlordApplication.id, made.apps));
  }
  if (made.users.length) await db.delete(user).where(inArray(user.id, made.users));
  made.apps.length = 0;
  made.users.length = 0;
});

async function applicant(status: "rejected" | "pending", age: number, orgNumber: string) {
  const [u] = await db
    .insert(user)
    .values({ id: crypto.randomUUID(), name: "Purge Test", email: `purge-${orgNumber}-${Date.now()}@test.invalid`, createdAt: ago(age) })
    .returning({ id: user.id });
  made.users.push(u.id);
  const [a] = await db
    .insert(landlordApplication)
    .values({
      orgNumber,
      companyName: "Gallring AB",
      contactName: "Test",
      contactEmail: `purge-${orgNumber}@test.invalid`,
      publishingRoute: "manual",
      status,
      userId: u.id,
      createdAt: ago(age),
      reviewedAt: status === "rejected" ? ago(age) : null,
      termsAcceptedAt: ago(age),
    })
    .returning({ id: landlordApplication.id });
  made.apps.push(a.id);
  return { userId: u.id, applicationId: a.id };
}

const exists = async (id: string) => Boolean(await db.query.user.findFirst({ where: eq(user.id, id), columns: { id: true } }));

describe("purgeApplications", () => {
  it("deletes a rejected applicant's user, not just the application", async () => {
    // The bug this covers: the user was aged against the 180-day cutoff while
    // the application went at 90, so the row survived every later sweep.
    const { userId, applicationId } = await applicant("rejected", REJECTED_RETENTION_DAYS + 5, "556100-0001");
    expect(await purgeApplications()).toBeGreaterThanOrEqual(1);
    expect(await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) })).toBeUndefined();
    expect(await exists(userId)).toBe(false);
  });

  it("deletes an abandoned applicant's user too", async () => {
    const { userId } = await applicant("pending", ABANDONED_RETENTION_DAYS + 5, "556100-0002");
    await purgeApplications();
    expect(await exists(userId)).toBe(false);
  });

  it("leaves an application that is not old enough alone", async () => {
    const { userId, applicationId } = await applicant("rejected", REJECTED_RETENTION_DAYS - 5, "556100-0003");
    await purgeApplications();
    expect(await db.query.landlordApplication.findFirst({ where: eq(landlordApplication.id, applicationId) })).toBeDefined();
    expect(await exists(userId)).toBe(true);
  });
});
