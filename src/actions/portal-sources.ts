"use server";

import { and, eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireLandlord } from "@/lib/access";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { adapterForKind, testSource, type SourceTestResult } from "@/lib/source-test";
import { enqueueSourceSync } from "@/lib/jobs";
import { encryptSecret } from "@/lib/secrets";

const { source } = schema;

const kindSchema = z.enum(["feed", "api", "html"]);
const settings = z.object({
  kind: kindSchema,
  url: z.string().trim().url().max(500),
  apiKey: z.string().trim().max(500).optional().or(z.literal("")),
  fetchIntervalMinutes: z.coerce.number().refine((n) => [60, 240, 1440].includes(n)),
  techContactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  queueDefault: z.enum(["", "none", "queue", "points", "unknown"]).default(""),
});

export type TestState = SourceTestResult | { ok: false; errorClass: "invalid"; message: string } | null;

export async function testConnection(locale: Locale, _prev: TestState, fd: FormData): Promise<TestState> {
  await requireLandlord(locale, "owner");
  const parsed = z.object({ kind: kindSchema, url: z.string().trim().url(), apiKey: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, errorClass: "invalid", message: "invalid" };
  const { kind, url, apiKey } = parsed.data;
  return testSource(kind, url, apiKey ? { apiKey } : {});
}

export type ConnectState = { ok: true; id: string } | { ok: false; error: "invalid" | "testRequired" } | null;

export async function connectSource(locale: Locale, _prev: ConnectState, fd: FormData): Promise<ConnectState> {
  const me = await requireLandlord(locale, "owner");
  const parsed = settings.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  let mapping: Record<string, string> = {};
  let hint: "json" | "xml" | undefined;
  let status: "pending" | "active" = "pending";
  if (d.kind !== "html") {
    const test = await testSource(d.kind, d.url, d.apiKey ? { apiKey: d.apiKey } : {});
    if (!test.ok) return { ok: false, error: "testRequired" };
    mapping = test.mapping as Record<string, string>;
    hint = /^\s*[\[{]/.test(JSON.stringify(test.sample ?? "")) ? undefined : undefined;
    status = "pending";
  }
  const [row] = await db
    .insert(source)
    .values({
      landlordId: me.landlordId,
      kind: d.kind,
      adapter: adapterForKind(d.kind, hint),
      url: d.url,
      config: { fields: mapping, ...(d.apiKey ? { apiKey: encryptSecret(d.apiKey) } : {}), ...(d.kind === "html" ? { listSelector: "" } : {}) },
      fetchIntervalMinutes: d.fetchIntervalMinutes,
      status,
      consent: "consented",
      queueDefault: d.queueDefault ? d.queueDefault : null,
      techContactEmail: d.techContactEmail || me.email,
      nextRunAt: d.kind === "html" ? null : new Date(),
    })
    .returning({ id: source.id });
  if (d.kind !== "html") {
    try {
      await enqueueSourceSync(row.id);
    } catch (e) {
      console.error("enqueue failed", e);
    }
  }
  return { ok: true, id: row.id };
}

export async function updateSourceSettings(locale: Locale, id: string, _prev: ConnectState, fd: FormData): Promise<ConnectState> {
  const me = await requireLandlord(locale, "owner");
  const parsed = settings.partial({ kind: true, url: true }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;
  const existing = await db.query.source.findFirst({ where: and(eq(source.id, id), eq(source.landlordId, me.landlordId)) });
  if (!existing) redirect({ href: "/portal/sources", locale });
  const config = { ...(existing!.config as Record<string, unknown>) };
  if (d.apiKey !== undefined) {
    if (d.apiKey) config.apiKey = encryptSecret(d.apiKey);
    else delete config.apiKey;
  }
  await db
    .update(source)
    .set({
      fetchIntervalMinutes: d.fetchIntervalMinutes ?? existing!.fetchIntervalMinutes,
      techContactEmail: d.techContactEmail || existing!.techContactEmail,
      queueDefault: d.queueDefault ? d.queueDefault : null,
      config,
    })
    .where(eq(source.id, id));
  return { ok: true, id };
}

export async function setSourceEnabled(locale: Locale, id: string, enabled: boolean) {
  const me = await requireLandlord(locale, "owner");
  const existing = await db.query.source.findFirst({ where: and(eq(source.id, id), eq(source.landlordId, me.landlordId)) });
  if (!existing) return;
  if (!rateLimit(`source-toggle:${id}`, 6, 3600).ok) return;
  await db.update(source).set({ status: enabled ? "pending" : "disabled", consecutiveFailures: 0, nextRunAt: enabled ? new Date() : null }).where(eq(source.id, id));
}

export async function runSourceNow(locale: Locale, id: string) {
  const me = await requireLandlord(locale, "owner");
  const existing = await db.query.source.findFirst({ where: and(eq(source.id, id), eq(source.landlordId, me.landlordId)) });
  if (!existing) return { ok: false as const };
  // A run also re-arms the failure email: six per hour per source is plenty for a human.
  if (!rateLimit(`source-run:${id}`, 6, 3600).ok) return { ok: false as const };
  try {
    await enqueueSourceSync(id);
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}
