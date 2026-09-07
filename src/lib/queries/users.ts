import { and, eq, lt } from "drizzle-orm";
import { schema, type Db, type Tx } from "@/db";

const { landlordMember, staffUser, user } = schema;

/**
 * Deletes a user row that nothing needs any more: not a member of any
 * landlord and not staff. `createdBefore` guards against deleting an account
 * newer than the record being purged; callers pass the cutoff that matches
 * what they are purging.
 */
export async function deleteUserIfOrphan(exec: Db | Tx, userId: string, createdBefore?: Date): Promise<boolean> {
  const member = await exec.query.landlordMember.findFirst({ where: eq(landlordMember.userId, userId), columns: { userId: true } });
  if (member) return false;
  const staff = await exec.query.staffUser.findFirst({ where: eq(staffUser.userId, userId), columns: { userId: true } });
  if (staff) return false;
  const rows = await exec
    .delete(user)
    .where(createdBefore ? and(eq(user.id, userId), lt(user.createdAt, createdBefore)) : eq(user.id, userId))
    .returning({ id: user.id });
  return rows.length > 0;
}
