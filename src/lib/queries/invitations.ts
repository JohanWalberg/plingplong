import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

/** Invitation tokens are stored hashed; the raw token only ever lives in the email link. */
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A live invitation for this raw token: not accepted, not expired. */
export async function findInvitation(token: string) {
  return db.query.landlordInvitation.findFirst({
    where: and(eq(schema.landlordInvitation.tokenHash, hashInviteToken(token)), isNull(schema.landlordInvitation.acceptedAt), gt(schema.landlordInvitation.expiresAt, new Date())),
    with: { landlord: true },
  });
}
