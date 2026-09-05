"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { APIError } from "better-auth";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-templates";
import { domainMatches, isValidOrgNumber, normaliseOrgNumber, orgNumberKind } from "@/lib/org-number";
import { testSource } from "@/lib/source-test";
import type { Locale } from "@/i18n/routing";

const schemaInput = z.object({
  locale: z.enum(["sv", "en"]),
  orgNumber: z.string().min(1),
  companyName: z.string().trim().min(2).max(160),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(10).max(200),
  publishingRoute: z.enum(["source", "manual"]),
  sourceUrl: z.string().trim().max(500).optional().or(z.literal("")),
  terms: z.literal("on"),
});

export type SignupState = { ok: true; email: string } | { ok: false; errors: Record<string, string>; formError?: string };

export async function submitApplication(_prev: SignupState | null, formData: FormData): Promise<SignupState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schemaInput.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.code;
    return { ok: false, errors };
  }
  const d = parsed.data;
  const locale = d.locale as Locale;
  if (!isValidOrgNumber(d.orgNumber)) return { ok: false, errors: { orgNumber: "invalid" } };
  const orgNumber = normaliseOrgNumber(d.orgNumber)!;

  const existingApp = await db.query.landlordApplication.findFirst({ where: eq(schema.landlordApplication.orgNumber, orgNumber) });
  if (existingApp && existingApp.status !== "rejected") return { ok: false, errors: { orgNumber: "taken" } };

  // Create the user now (inactive until approval: no membership exists yet).
  let userId: string;
  try {
    const res = await auth.api.signUpEmail({ body: { email: d.email, password: d.password, name: d.contactName, locale } });
    userId = res.user.id;
  } catch (e) {
    if (e instanceof APIError && /exist/i.test(e.message)) return { ok: false, errors: { email: "taken" } };
    throw e;
  }

  // Automated checks, recorded for the reviewer. None of them auto-approve.
  const checks: Array<{ key: string; status: "done" | "warn" | "fail" | "na"; detail?: Record<string, unknown> }> = [
    { key: "org_format", status: "done", detail: { kind: orgNumberKind(orgNumber) } },
    { key: "org_registry", status: "warn" },
  ];
  const dm = domainMatches(d.email, d.website || null);
  checks.push({ key: "email_domain", status: dm === null ? "na" : dm ? "done" : "fail" });
  if (d.publishingRoute === "source" && d.sourceUrl) {
    const kind = /\.(xml|json|rss)(\?|$)/i.test(d.sourceUrl) || /feed|api/i.test(d.sourceUrl) ? "feed" : "html";
    const test = await testSource(kind, d.sourceUrl);
    if (test.ok) {
      checks.push({ key: "feed", status: "done", detail: { count: test.count, mapping: test.mapping } });
      if (test.warnings.includes("queue")) checks.push({ key: "feed_queue", status: "warn" });
    } else checks.push({ key: "feed", status: "fail", detail: { error: `${test.errorClass}: ${test.message}` } });
  } else checks.push({ key: "feed", status: "na" });

  const [app] = await db
    .insert(schema.landlordApplication)
    .values({
      orgNumber,
      companyName: d.companyName,
      website: d.website || null,
      contactName: d.contactName,
      contactEmail: d.email,
      contactPhone: d.phone || null,
      publishingRoute: d.publishingRoute,
      sourceUrl: d.sourceUrl || null,
      automatedChecks: checks,
      userId,
      locale,
    })
    .returning({ id: schema.landlordApplication.id });
  await db.insert(schema.landlordApplicationEvent).values({ applicationId: app.id, kind: "submitted", actorId: userId });

  const mail = await renderEmail(locale, "applicationReceived", { name: d.contactName, organisation: d.companyName });
  await sendEmail({ to: d.email, ...mail });
  return { ok: true, email: d.email };
}
