import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "./auth";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { LandlordRole, StaffRole } from "@/db/schema";

const STAFF_SESSION_MAX_MS = 8 * 60 * 60_000;

export type Viewer = {
  userId: string;
  email: string;
  name: string;
  locale: Locale;
  sessionCreatedAt: Date;
};

export async function getViewer(): Promise<Viewer | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  return {
    userId: s.user.id,
    email: s.user.email,
    name: s.user.name,
    locale: ((s.user as { locale?: string }).locale === "en" ? "en" : "sv") as Locale,
    sessionCreatedAt: new Date(s.session.createdAt),
  };
}

export type StaffViewer = Viewer & { role: StaffRole };

/**
 * Staff guard. Sessions older than eight hours are rejected regardless of the
 * cookie's own lifetime. `minRole` uses support < lead; engineer is a
 * separate capability checked by `isEngineer`.
 */
export async function requireStaff(locale: Locale, minRole: "support" | "lead" = "support"): Promise<StaffViewer> {
  const v = await getViewer();
  if (!v) redirect({ href: "/admin/sign-in", locale });
  if (Date.now() - v!.sessionCreatedAt.getTime() > STAFF_SESSION_MAX_MS) redirect({ href: { pathname: "/admin/sign-in", query: { expired: "1" } }, locale });
  const staff = await db.query.staffUser.findFirst({ where: eq(schema.staffUser.userId, v!.userId) });
  if (!staff) redirect({ href: { pathname: "/admin/sign-in", query: { denied: "1" } }, locale });
  if (minRole === "lead" && staff!.role !== "lead") redirect({ href: { pathname: "/admin", query: { denied: "1" } }, locale });
  return { ...v!, role: staff!.role };
}

export async function getStaff(): Promise<StaffViewer | null> {
  const v = await getViewer();
  if (!v) return null;
  const staff = await db.query.staffUser.findFirst({ where: eq(schema.staffUser.userId, v.userId) });
  return staff ? { ...v, role: staff.role } : null;
}

export const isLead = (s: StaffViewer) => s.role === "lead";
export const isEngineer = (s: StaffViewer) => s.role === "engineer" || s.role === "lead";

export type LandlordViewer = Viewer & { landlordId: string; landlordName: string; landlordSlug: string; role: LandlordRole };


/**
 * Landlord guard. Every portal query must be scoped by the returned
 * `landlordId`; the UI never decides access on its own.
 *
 * A user can belong to more than one organisation, and which one they land in is
 * still a product decision (a switcher, or one membership per account). Until it
 * is made the oldest membership wins, so the answer is at least the same every
 * time: unordered, it was whichever row the planner happened to return, and the
 * same person could reach one organisation's homes on one request and another's
 * on the next.
 */
export async function requireLandlord(locale: Locale, minRole: LandlordRole = "editor"): Promise<LandlordViewer> {
  const v = await getViewer();
  if (!v) redirect({ href: "/portal/sign-in", locale });
  const member = await db.query.landlordMember.findFirst({ where: eq(schema.landlordMember.userId, v!.userId), with: { landlord: true }, orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.landlordId)] });
  if (!member) redirect({ href: "/portal/pending", locale });
  if (minRole === "owner" && member!.role !== "owner") redirect({ href: { pathname: "/portal/homes", query: { denied: "1" } }, locale });
  return { ...v!, landlordId: member!.landlordId, landlordName: member!.landlord.name, landlordSlug: member!.landlord.slug, role: member!.role };
}

export async function getLandlord(): Promise<LandlordViewer | null> {
  const v = await getViewer();
  if (!v) return null;
  const member = await db.query.landlordMember.findFirst({ where: eq(schema.landlordMember.userId, v.userId), with: { landlord: true }, orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.landlordId)] });
  return member ? { ...v, landlordId: member.landlordId, landlordName: member.landlord.name, landlordSlug: member.landlord.slug, role: member.role } : null;
}

export const isOwner = (l: LandlordViewer) => l.role === "owner";
