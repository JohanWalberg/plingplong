"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireLandlord } from "@/lib/access";
import type { Locale } from "@/i18n/routing";

const { landlordMember, user } = schema;

export async function updateProfile(locale: Locale, fd: FormData) {
  const me = await requireLandlord(locale, "editor");
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false as const };
  await db.update(user).set({ name: parsed.data.name }).where(eq(user.id, me.userId));
  return { ok: true as const };
}

async function ownerCount(landlordId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(landlordMember).where(and(eq(landlordMember.landlordId, landlordId), eq(landlordMember.role, "owner")));
  return n;
}

export async function changeMemberRole(locale: Locale, userId: string, role: "owner" | "editor") {
  const me = await requireLandlord(locale, "owner");
  const target = await db.query.landlordMember.findFirst({ where: and(eq(landlordMember.userId, userId), eq(landlordMember.landlordId, me.landlordId)) });
  if (!target) return { ok: false as const, error: "invalid" as const };
  if (target.role === "owner" && role === "editor" && (await ownerCount(me.landlordId)) <= 1) return { ok: false as const, error: "lastOwner" as const };
  await db.update(landlordMember).set({ role }).where(and(eq(landlordMember.userId, userId), eq(landlordMember.landlordId, me.landlordId)));
  return { ok: true as const };
}

export async function removeMember(locale: Locale, userId: string) {
  const me = await requireLandlord(locale, "owner");
  const target = await db.query.landlordMember.findFirst({ where: and(eq(landlordMember.userId, userId), eq(landlordMember.landlordId, me.landlordId)) });
  if (!target) return { ok: false as const, error: "invalid" as const };
  if (target.role === "owner" && (await ownerCount(me.landlordId)) <= 1) return { ok: false as const, error: "lastOwner" as const };
  await db.delete(landlordMember).where(and(eq(landlordMember.userId, userId), eq(landlordMember.landlordId, me.landlordId)));
  return { ok: true as const };
}


/**
 * Close the landlord account: unpublish direct listings, disable sources,
 * remove members and invitations, delete users who belong nowhere else.
 * The landlord row stays as a known landlord so coverage does not change.
 */
export async function closeLandlordAccount(locale: Locale, confirmName: string): Promise<{ ok: true } | { ok: false; error: "confirm" }> {
  const me = await requireLandlord(locale, "owner");
  if (confirmName.trim().toLowerCase() !== me.landlordName.trim().toLowerCase()) return { ok: false, error: "confirm" };
  const now = new Date();
  const { listing, listingRevision, source, landlordMember, landlordInvitation, landlord, staffUser, user } = schema;
  const direct = await db.select({ id: listing.id, status: listing.status }).from(listing).where(and(eq(listing.landlordId, me.landlordId), eq(listing.publishedDirectly, true), eq(listing.status, "active")));
  if (direct.length) {
    await db.update(listing).set({ status: "unpublished", unpublishedAt: now, lastCheckedAt: now }).where(inArray(listing.id, direct.map((d) => d.id)));
    await db.insert(listingRevision).values(direct.map((d) => ({ listingId: d.id, field: "status", oldValue: d.status, newValue: "unpublished", origin: "portal", changedBy: me.userId, changedAt: now })));
  }
  await db.update(source).set({ status: "disabled", consent: "objected", nextRunAt: null }).where(eq(source.landlordId, me.landlordId));
  const members = await db.select({ userId: landlordMember.userId }).from(landlordMember).where(eq(landlordMember.landlordId, me.landlordId));
  await db.delete(landlordInvitation).where(eq(landlordInvitation.landlordId, me.landlordId));
  await db.delete(landlordMember).where(eq(landlordMember.landlordId, me.landlordId));
  await db.update(landlord).set({ approvedAt: null, isMonitored: false }).where(eq(landlord.id, me.landlordId));
  for (const m of members) {
    const elsewhere = await db.query.landlordMember.findFirst({ where: eq(landlordMember.userId, m.userId) });
    const staff = await db.query.staffUser.findFirst({ where: eq(staffUser.userId, m.userId) });
    if (!elsewhere && !staff) await db.delete(user).where(eq(user.id, m.userId));
  }
  return { ok: true };
}
