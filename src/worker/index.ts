/**
 * Long-running worker: pg-boss queues on Postgres. Runs crawls, expiry and
 * retention jobs. Start with `pnpm worker`; the web app only enqueues.
 */
import type { Job } from "pg-boss";
import { QUEUES, createBoss } from "@/lib/jobs";
import { dueSources, expireDirectListings, pruneRawPayloads, syncSource } from "./sync";
import { purgeApplications } from "./retention";
import { notifyExpiringListings } from "./notify";
import { sendAlertDigests } from "./alerts";
import { purgeUnconfirmedAlerts } from "@/lib/queries/alerts";
import { requestRevalidate } from "@/lib/revalidate";
import { assertProductionConfig } from "@/lib/env-check";
import { initErrorReporting, reportError } from "@/lib/observability";

async function main() {
  assertProductionConfig();
  await initErrorReporting("worker");
  const boss = await createBoss();
  boss.on("error", (e: unknown) => reportError(e, { queue: "pg-boss" }));

  // A job that throws is retried or dropped by pg-boss; without this nobody hears about it.
  process.on("unhandledRejection", (e) => reportError(e, { kind: "unhandledRejection" }));
  process.on("uncaughtException", (e) => {
    reportError(e, { kind: "uncaughtException" });
    process.exit(1);
  });

  await boss.work<{ sourceId: string; manual?: boolean; force?: boolean }>(QUEUES.sync, async (jobs: Job<{ sourceId: string; manual?: boolean; force?: boolean }>[]) => {
    const [job] = jobs;
    const started = Date.now();
    let out;
    try {
      out = await syncSource(job.data.sourceId, { manual: job.data.manual, force: job.data.force });
    } catch (e) {
      reportError(e, { queue: "source.sync", sourceId: job.data.sourceId });
      throw e;
    }
    console.log(`[sync] ${job.data.sourceId} ${out.ok ? "ok" : "FAILED"} found=${out.found} new=${out.created} upd=${out.updated} gone=${out.gone}${out.anomaly ? " ANOMALY" : ""}${out.error ? ` err=${out.error}` : ""} (${Date.now() - started}ms)`);
    // Only when search would actually look different; a run that changed nothing needs no invalidation.
    if (out.created + out.updated + out.gone > 0) {
      await requestRevalidate(`sync ${job.data.sourceId}`, { municipalityIds: out.municipalityIds, landlordIds: out.landlordId ? [out.landlordId] : [] });
    }
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
    const purged = await purgeApplications();
    const staleAlerts = await purgeUnconfirmedAlerts();
    console.log(`[housekeeping] expired ${expired} direct listing(s), purged ${purged} application(s), dropped ${staleAlerts} unconfirmed alert(s)`);
    if (expired > 0) await requestRevalidate("housekeeping expiry");
  });

  // No retry: a landlord must never get the same reminder twice because a send failed halfway.
  await boss.work(QUEUES.notify, async () => {
    const sent = await notifyExpiringListings();
    if (sent) console.log(`[notify] ${sent} deadline reminder(s) sent`);
  });

  await boss.schedule(QUEUES.tick, "* * * * *", undefined, { tz: "Europe/Stockholm" });
  await boss.schedule(QUEUES.housekeeping, "15 3 * * *", undefined, { tz: "Europe/Stockholm" });
  // Same rule as the reminders: no retry, so a half-sent morning never repeats a mail.
  await boss.work(QUEUES.alerts, async () => {
    const sent = await sendAlertDigests();
    if (sent) console.log(`[alerts] ${sent} search alert digest(s) sent`);
  });

  await boss.schedule(QUEUES.notify, "0 8 * * *", undefined, { tz: "Europe/Stockholm", retryLimit: 0 });
  await boss.schedule(QUEUES.alerts, "30 7 * * *", undefined, { tz: "Europe/Stockholm", retryLimit: 0 });
  console.log("worker started: queues", Object.values(QUEUES).join(", "));

  // Deploys send SIGTERM: finish the running job instead of leaving a source run open.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
      console.log(`[worker] ${signal}: stopping`);
      await boss.stop({ graceful: true, timeout: 30_000 });
      process.exit(0);
    });
  }
}

main().catch((e) => {
  reportError(e, { kind: "worker start" });
  process.exit(1);
});
