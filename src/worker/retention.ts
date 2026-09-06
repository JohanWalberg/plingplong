import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { landlordApplication, landlordMember, staffUser, user } = schema;

export const REJECTED_RETENTION_DAYS = 90;
export const ABANDONED_RETENTION_DAYS = 180;

/**
 * GDPR retention for landlord applications. Rejected applications are purged
 * after 90 days, applications never decided after 180 days. The applicant's
 * user row goes too unless it is a member somewhere or staff.
 */
export async function purgeApplications(now: Date = new Date()): Promise<number> {
  const rejectedBefore = new Date(now.getTime() - REJECTED_RETENTION_DAYS * 86_400_000);
  const abandonedBefore = new Date(now.getTime() - ABANDONED_RETENTION_DAYS * 86_400_000);
  const rows = await db
    .select({ id: landlordApplication.id, userId: landlordApplication.userId })
    .from(landlordApplication)
    .where(
      sql`(${landlordApplication.status} = 'rejected' and coalesce(${landlordApplication.reviewedAt}, ${landlordApplication.createdAt}) < ${rejectedBefore})
        or (${landlordApplication.status} in ('pending', 'needs_info') and ${landlordApplication.createdAt} < ${abandonedBefore})`,
    );
  if (!rows.length) return 0;
  await db.delete(landlordApplication).where(inArray(landlordApplication.id, rows.map((r) => r.id)));
  for (const r of rows) {
    if (!r.userId) continue;
    const member = await db.query.landlordMember.findFirst({ where: eq(landlordMember.userId, r.userId) });
    const staff = await db.query.staffUser.findFirst({ where: eq(staffUser.userId, r.userId) });
    if (!member && !staff) await db.delete(user).where(and(eq(user.id, r.userId), lt(user.createdAt, abandonedBefore)));
  }
  return rows.length;
}
