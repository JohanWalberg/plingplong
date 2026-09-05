"use server";

import { and, eq, sql } from "drizzle-orm";
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
