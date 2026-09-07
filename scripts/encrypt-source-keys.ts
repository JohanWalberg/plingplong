// One-off: encrypt API keys stored in plaintext before src/lib/secrets.ts existed.
// Run with: pnpm exec tsx --env-file=.env scripts/encrypt-source-keys.ts
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { encryptSecret, isEncrypted } from "@/lib/secrets";

const rows = await db.select({ id: schema.source.id, config: schema.source.config }).from(schema.source);
let n = 0;
for (const r of rows) {
  const config = (r.config ?? {}) as { apiKey?: string };
  if (!config.apiKey || isEncrypted(config.apiKey)) continue;
  await db.update(schema.source).set({ config: { ...config, apiKey: encryptSecret(config.apiKey) } }).where(eq(schema.source.id, r.id));
  n++;
}
console.log(`encrypted ${n} of ${rows.length} sources`);
process.exit(0);
