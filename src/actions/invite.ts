"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { APIError } from "better-auth";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { getViewer, requireLandlord } from "@/lib/access";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function findInvitation(token: string) {
  return db.query.landlordInvitation.findFirst({
    where: and(eq(schema.landlordInvitation.tokenHash, hash(token)), isNull(schema.landlordInvitation.acceptedAt), gt(schema.landlordInvitation.expiresAt, new Date())),
    with: { landlord: true },
  });
}

export type InviteState = { ok: true } | { ok: false; error: string };

export async function sendInvitation(locale: Locale, formData: FormData): Promise<InviteState> {
  const me = await requireLandlord(locale, "owner");
  const parsed = z.object({ email: z.string().trim().email(), role: z.enum(["owner", "editor"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };
  const email = parsed.data.email.toLowerCase();
  const existingUser = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
  if (existingUser) {
    const member = await db.query.landlordMember.findFirst({ where: and(eq(schema.landlordMember.userId, existingUser.id), eq(schema.landlordMember.landlordId, me.landlordId)) });
    if (member) return { ok: false, error: "exists" };
  }
  const open = await db.query.landlordInvitation.findFirst({ where: and(eq(schema.landlordInvitation.landlordId, me.landlordId), eq(schema.landlordInvitation.email, email), isNull(schema.landlordInvitation.acceptedAt), gt(schema.landlordInvitation.expiresAt, new Date())) });
  if (open) return { ok: false, error: "exists" };

  const token = randomBytes(24).toString("base64url");
  await db.insert(schema.landlordInvitation).values({
    landlordId: me.landlordId,
    email,
    role: parsed.data.role,
    tokenHash: hash(token),
    invitedBy: me.userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
  });
  const url = absoluteUrl(locale, { pathname: "/portal/invite/[token]", params: { token } });
  const mail = await renderEmail(locale, "invite", { inviter: me.name, organisation: me.landlordName, url });
  await sendEmail({ to: email, ...mail });
  return { ok: true };
}

export async function revokeInvitation(locale: Locale, id: string) {
  const me = await requireLandlord(locale, "owner");
  await db.delete(schema.landlordInvitation).where(and(eq(schema.landlordInvitation.id, id), eq(schema.landlordInvitation.landlordId, me.landlordId)));
}

export type AcceptState = { ok: true } | { ok: false; error: string };

/** Invited colleague sets a name and password; membership is created on success. */
export async function acceptInvitation(token: string, locale: Locale, formData: FormData): Promise<AcceptState> {
  const inv = await findInvitation(token);
  if (!inv) return { ok: false, error: "invalid" };
  const parsed = z.object({ name: z.string().trim().min(2).max(120), password: z.string().min(10).max(200) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };

  let userId: string;
  const existing = await db.query.user.findFirst({ where: eq(schema.user.email, inv.email) });
  if (existing) {
    // The token proves the email was invited, not that the caller owns the
    // existing account: they must be signed in as it, or prove the password.
    const viewer = await getViewer();
    if (viewer?.userId !== existing.id) {
      try {
        await auth.api.signInEmail({ body: { email: inv.email, password: parsed.data.password } });
      } catch (e) {
        if (e instanceof APIError) return { ok: false, error: "invalid" };
        throw e;
      }
    }
    userId = existing.id;
  } else {
    try {
      const res = await auth.api.signUpEmail({ body: { email: inv.email, password: parsed.data.password, name: parsed.data.name, locale } });
      userId = res.user.id;
      await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, userId));
    } catch (e) {
      if (e instanceof APIError) return { ok: false, error: "invalid" };
      throw e;
    }
  }
  await db.insert(schema.landlordMember).values({ userId, landlordId: inv.landlordId, role: inv.role }).onConflictDoNothing();
  await db.update(schema.landlordInvitation).set({ acceptedAt: new Date() }).where(eq(schema.landlordInvitation.id, inv.id));
  return { ok: true };
}
