import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteUserIfOrphan } from "@/lib/queries/users";

const { landlordApplication } = schema;

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
    .select({ id: landlordApplication.id, userId: landlordApplication.userId, status: landlordApplication.status })
    .from(landlordApplication)
    .where(
      // The cutoffs are bound as ISO strings and cast: a bare Date in a raw
      // template reaches the driver unmapped and the query throws.
      sql`(${landlordApplication.status} = 'rejected' and coalesce(${landlordApplication.reviewedAt}, ${landlordApplication.createdAt}) < ${rejectedBefore.toISOString()}::timestamptz)
        or (${landlordApplication.status} in ('pending', 'needs_info') and ${landlordApplication.createdAt} < ${abandonedBefore.toISOString()}::timestamptz)`,
    );
  if (!rows.length) return 0;
  await db.delete(landlordApplication).where(inArray(landlordApplication.id, rows.map((r) => r.id)));
  // Each row is aged out against its own cutoff. Passing the 180-day one for
  // everything meant a rejected applicant's user, typically 90 days old, always
  // failed the age check — and its application had just been deleted, so nothing
  // ever looked at that user again and the row stayed forever.
  for (const r of rows) if (r.userId) await deleteUserIfOrphan(db, r.userId, r.status === "rejected" ? rejectedBefore : abandonedBefore);
  return rows.length;
}
