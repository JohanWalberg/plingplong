"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { absoluteUrl } from "@/lib/seo";
import { confirmAlert, createAlert, deleteAlert } from "@/lib/queries/alerts";
import { parseSearchParams } from "@/lib/search-params-parse";
import { toQuery } from "@/lib/search-params";
import { findMunicipalityBySlug, findArea } from "@/lib/queries/places";
import type { Locale } from "@/i18n/routing";

const input = z.object({
  locale: z.enum(["sv", "en"]),
  email: z.string().trim().email().max(200),
  label: z.string().trim().min(1).max(200),
  place: z.string().trim().max(80).optional().or(z.literal("")),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  query: z.string().max(2000),
});

export type AlertState = { ok: true; email: string } | { ok: false; error: "email" | "rate_limited" | "limit" | "invalid" };

/**
 * Asks for a search alert. The reply is the same whether the address is new,
 * already watching this search or already confirmed: what differs goes to the
 * inbox, so the form cannot be used to check which addresses we know.
 */
export async function requestSearchAlert(_prev: AlertState | null, formData: FormData): Promise<AlertState> {
  const limit = rateLimit(`alert:${clientIp(await headers())}`, 10, 3600);
  if (!limit.ok) return { ok: false, error: "rate_limited" };
  const parsed = input.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "email") ? "email" : "invalid" };
  const d = parsed.data;
  const locale = d.locale as Locale;

  let municipalityId: string | undefined;
  let areaId: string | undefined;
  if (d.place) {
    const muni = await findMunicipalityBySlug(d.place);
    if (!muni) return { ok: false, error: "invalid" };
    municipalityId = muni.id;
    if (d.area) {
      const a = await findArea(muni.id, d.area);
      if (!a) return { ok: false, error: "invalid" };
      areaId = a.id;
    }
  }
  let raw: Record<string, string> = {};
  try {
    const obj = JSON.parse(d.query || "{}");
    if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (typeof v === "string") raw[k] = v;
  } catch {
    raw = {};
  }
  // Re-parsed and re-serialised: only filters we understand are stored, and page and sort never are.
  const { page: _page, sort: _sort, ...filters } = parseSearchParams(raw);
  const query = toQuery(filters);

  const created = await createAlert({ email: d.email, locale, label: d.label, municipalityId, areaId, query });
  if (!created) return { ok: false, error: "limit" };
  const url = absoluteUrl(locale, { pathname: "/alerts/[token]", params: { token: created.token } });
  const mail = await renderEmail(locale, "alertConfirm", { label: d.label, url, confirmed: created.confirmed ? "yes" : "no" });
  await sendEmail({ to: d.email, ...mail });
  return { ok: true, email: d.email };
}

export async function confirmSearchAlert(token: string): Promise<{ ok: boolean }> {
  if (typeof token !== "string" || token.length > 100) return { ok: false };
  return { ok: await confirmAlert(token) };
}

export async function endSearchAlert(token: string): Promise<{ ok: boolean }> {
  if (typeof token !== "string" || token.length > 100) return { ok: false };
  return { ok: await deleteAlert(token) };
}
