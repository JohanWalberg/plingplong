import { or, eq, like } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db, Tx } from "@/db";
import { escapeLike } from "@/lib/like";

type Executor = Db | Tx;
type SlugTable = PgTable & { id: PgColumn; slug: PgColumn };

/**
 * First free slug among `base`, `base-2`, `base-3`, … resolved with a single
 * query instead of one probe per suffix. `excludeId` lets an update keep its
 * own slug.
 */
export async function freeSlug(exec: Executor, table: SlugTable, base: string, excludeId?: string): Promise<string> {
  const rows = await exec
    .select({ id: table.id, slug: table.slug })
    .from(table)
    .where(or(eq(table.slug, base), like(table.slug, `${escapeLike(base)}-%`)));
  const taken = new Set(rows.filter((r) => String(r.id) !== excludeId).map((r) => String(r.slug)));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

type PgError = { code?: string; constraint_name?: string };

/**
 * A unique violation on the slug specifically, whether thrown directly by
 * postgres.js or wrapped by Drizzle. The constraint name matters: `landlord`
 * also has a unique organisation number, and retrying that one would burn
 * three attempts and then rethrow, turning a validation failure into a crash.
 */
export function isSlugViolation(e: unknown): boolean {
  const err = e as (PgError & { cause?: PgError }) | null;
  const pg = err?.code === "23505" ? err : err?.cause?.code === "23505" ? err.cause : null;
  return pg !== null && (pg.constraint_name ?? "").includes("slug");
}

/**
 * Picks a free slug and runs `insert` with it. Two writers can pick the same
 * slug between the lookup and the insert; the unique constraint then rejects
 * one of them and we pick again. The insert runs in a nested transaction
 * (a savepoint when already inside one) so the failed statement does not
 * poison the caller's transaction.
 */
export async function insertWithUniqueSlug<T>(exec: Executor, table: SlugTable, base: string, insert: (tx: Tx, slug: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await freeSlug(exec, table, base);
    try {
      return await exec.transaction((tx) => insert(tx, slug));
    } catch (e) {
      if (!isSlugViolation(e)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
