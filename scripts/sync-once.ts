// Run one crawl for a source id or landlord slug without pg-boss. Usage: tsx --env-file=.env scripts/sync-once.ts <sourceId|landlordSlug>
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { syncSource } from "@/worker/sync";

const arg = process.argv[2];
if (!arg) throw new Error("usage: sync-once <sourceId|landlordSlug>");
let id = arg;
if (!/^[0-9a-f-]{36}$/.test(arg)) {
  const ll = await db.query.landlord.findFirst({ where: eq(schema.landlord.slug, arg), with: { sources: true } });
  if (!ll?.sources[0]) throw new Error("no source for landlord");
  id = ll.sources[0].id;
}
console.log(await syncSource(id, { manual: true }));
process.exit(0);
