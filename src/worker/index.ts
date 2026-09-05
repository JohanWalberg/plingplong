/**
 * Long-running worker: pg-boss queues on Postgres. Runs crawls, expiry and
 * retention jobs. Start with `pnpm worker`; the web app only enqueues.
 */
import type { Job } from "pg-boss";
import { QUEUES, createBoss } from "@/lib/jobs";
import { dueSources, expireDirectListings, pruneRawPayloads, syncSource } from "./sync";

async function main() {
  const boss = await createBoss();
  boss.on("error", (e: unknown) => console.error("[pg-boss]", e));

  await boss.work<{ sourceId: string; manual?: boolean }>(QUEUES.sync, async (jobs: Job<{ sourceId: string; manual?: boolean }>[]) => {
    const [job] = jobs;
    const started = Date.now();
    const out = await syncSource(job.data.sourceId, { manual: job.data.manual });
    console.log(`[sync] ${job.data.sourceId} ${out.ok ? "ok" : "FAILED"} found=${out.found} new=${out.created} upd=${out.updated} gone=${out.gone}${out.anomaly ? " ANOMALY" : ""}${out.error ? ` err=${out.error}` : ""} (${Date.now() - started}ms)`);
  });

  await boss.work(QUEUES.tick, async () => {
    const due = await dueSources();
    for (const s of due) {
      await boss.send(QUEUES.sync, { sourceId: s.id }, { singletonKey: s.id, singletonSeconds: 300, retryLimit: 0 });
    }
    if (due.length) console.log(`[tick] queued ${due.length} source(s)`);
  });

  await boss.work(QUEUES.housekeeping, async () => {
    const expired = await expireDirectListings();
    await pruneRawPayloads();
    console.log(`[housekeeping] expired ${expired} direct listing(s)`);
  });

  await boss.schedule(QUEUES.tick, "* * * * *", undefined, { tz: "Europe/Stockholm" });
  await boss.schedule(QUEUES.housekeeping, "15 3 * * *", undefined, { tz: "Europe/Stockholm" });
  console.log("worker started: queues", Object.values(QUEUES).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
