import { PgBoss } from "pg-boss";

export const QUEUES = {
  sync: "source.sync",
  tick: "scheduler.tick",
  housekeeping: "housekeeping.daily",
  notify: "notify.daily",
} as const;

const globalForBoss = globalThis as unknown as { __hyrabostadBoss?: Promise<PgBoss> };

/** Shared pg-boss instance. The web app uses it to enqueue; the worker to process. */
export function createBoss(): Promise<PgBoss> {
  if (!globalForBoss.__hyrabostadBoss) {
    globalForBoss.__hyrabostadBoss = (async () => {
      const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
      await boss.start();
      for (const q of Object.values(QUEUES)) {
        try {
          await boss.createQueue(q);
        } catch {
          // already exists
        }
      }
      return boss;
    })();
  }
  return globalForBoss.__hyrabostadBoss;
}

/** `force` runs a disabled source and must only be passed from staff actions. */
export async function enqueueSourceSync(sourceId: string, manual = true, force = false) {
  const boss = await createBoss();
  return boss.send(QUEUES.sync, { sourceId, manual, force }, { singletonKey: sourceId, singletonSeconds: 60, retryLimit: 0 });
}

export async function enqueueAllSyncs(sourceIds: string[]) {
  const boss = await createBoss();
  let n = 0;
  for (const id of sourceIds) {
    const jobId = await boss.send(QUEUES.sync, { sourceId: id, manual: true }, { singletonKey: id, singletonSeconds: 60, retryLimit: 0 });
    if (jobId) n++;
  }
  return n;
}
