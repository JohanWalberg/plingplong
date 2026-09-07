"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { invalidateListingCaches } from "@/lib/listing-cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { deleteUserIfOrphan } from "@/lib/queries/users";
import { withdrawSources } from "@/worker/sync";
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
  z.enum(["owner", "editor"]).parse(role);
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
 * Close the landlord account: unpublish direct listings, withdraw everything
 * crawled from the landlord's sources, disable those sources, remove members
 * and invitations, delete users who belong nowhere else. The landlord row
 * stays as a known landlord so coverage does not change.
 */
export async function closeLandlordAccount(locale: Locale, confirmName: string): Promise<{ ok: true } | { ok: false; error: "confirm" }> {
  const me = await requireLandlord(locale, "owner");
  if (confirmName.trim().toLowerCase() !== me.landlordName.trim().toLowerCase()) return { ok: false, error: "confirm" };
  const now = new Date();
  const { listing, listingRevision, source, landlordMember, landlordInvitation, landlord } = schema;
  await db.transaction(async (tx) => {
    // Everything published here goes down with the account, not merely out of search:
    // closing is an objection, and an objection means the record stops being public.
    const direct = await tx.select({ id: listing.id, status: listing.status }).from(listing).where(and(eq(listing.landlordId, me.landlordId), eq(listing.publishedDirectly, true), eq(listing.status, "active")));
    if (direct.length) {
      await tx.update(listing).set({ status: "unpublished", unpublishedAt: now, takenDownAt: now, lastCheckedAt: now }).where(inArray(listing.id, direct.map((d) => d.id)));
      await tx.insert(listingRevision).values(direct.map((d) => ({ listingId: d.id, field: "status", oldValue: d.status, newValue: "unpublished", origin: "portal", changedBy: me.userId, changedAt: now })));
    }
    // Closing the account is an objection: the sources stop, and what they collected leaves search with them.
    const sources = await tx.select({ id: source.id }).from(source).where(eq(source.landlordId, me.landlordId));
    await tx.update(source).set({ status: "disabled", consent: "objected", nextRunAt: null }).where(eq(source.landlordId, me.landlordId));
    await withdrawSources(sources.map((s) => s.id), me.userId, tx);
    const members = await tx.select({ userId: landlordMember.userId }).from(landlordMember).where(eq(landlordMember.landlordId, me.landlordId));
    await tx.delete(landlordInvitation).where(eq(landlordInvitation.landlordId, me.landlordId));
    await tx.delete(landlordMember).where(eq(landlordMember.landlordId, me.landlordId));
    await tx.update(landlord).set({ approvedAt: null, isMonitored: false }).where(eq(landlord.id, me.landlordId));
    for (const m of members) await deleteUserIfOrphan(tx, m.userId);
  });
  invalidateListingCaches();
  return { ok: true };
}
