import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell } from "@/components/admin/admin-shell";
import { ActionButton, ConfirmActionButton } from "@/components/admin/action-buttons";
import { listDuplicates } from "@/lib/queries/admin";
import { decideDuplicate } from "@/actions/admin";
import { formatNumber, formatSek } from "@/lib/format";
import { Card } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/badge";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DuplicatesPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const sp = await searchParams;
  const tab = sp.tab === "decided" ? "decided" : "pending";
  const t = await getTranslations("admin.duplicates");
  const rows = await listDuplicates(tab);
  const lead = viewer.role === "lead";
  const fields = (x: (typeof rows)[number]["a"]) =>
    [
      [t("fieldAddress"), x.address],
      [t("fieldRent"), x.rentMonthly === null ? "—" : formatSek(locale, x.rentMonthly)],
      [t("fieldRooms"), x.rooms === null ? "—" : formatNumber(locale, x.rooms, { maximumFractionDigits: 1 })],
      [t("fieldSize"), x.sizeSqm === null ? "—" : `${formatNumber(locale, x.sizeSqm)} m²`],
      [t("fieldLandlord"), x.landlordName],
      [t("fieldSource"), x.sourceDomain ?? "portal"],
    ] as Array<[string, string]>;

  return (
    <AdminShell viewer={viewer} active="duplicates" title={t("title")}>
      <p className="text-[14px] text-ink-2">{t("sub", { count: tab === "pending" ? rows.length : 0 })}</p>
      <div role="tablist" className="mt-3 flex gap-1">
        {(["pending", "decided"] as const).map((k) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={{ pathname: "/admin/duplicates", query: { tab: k } }} className={`flex min-h-10 items-center rounded-md px-3 text-[13.5px] font-[650] hover:no-underline ${tab === k ? "bg-ink text-white hover:text-white" : "text-ink-2 hover:bg-surface"}`}>
            {k === "pending" ? t("title") : t("decided")}
          </Link>
        ))}
      </div>
      {!lead ? <p className="mt-3 text-meta text-muted">{t("leadOnly")}</p> : null}
      <div className="mt-4 flex flex-col gap-4">
        {rows.length ? (
          rows.map((r) => {
            const fa = fields(r.a);
            const fb = fields(r.b);
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusPill tone={Number(r.score) >= 0.9 ? "error" : Number(r.score) >= 0.7 ? "warning" : "info"}>{t("confidence", { score: formatNumber(locale, Number(r.score), { maximumFractionDigits: 2, minimumFractionDigits: 2 }) })}</StatusPill>
                  {r.decision !== "pending" ? <span className="text-meta text-muted">{r.decision === "merged" ? t("merged") : r.decision === "not_duplicate" ? t("notDup") : t("ignore")}</span> : null}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    [t("listingA"), r.a, fa],
                    [t("listingB"), r.b, fb],
                  ].map(([label, x, f], i) => (
                    <div key={i}>
                      <h2 className="text-label font-[650] uppercase tracking-wide text-muted">
                        {label as string} ·{" "}
                        <Link href={{ pathname: "/admin/listings/[id]", params: { id: (x as typeof r.a).id } }} className="normal-case tracking-normal">
                          {(x as typeof r.a).slug}
                        </Link>
                      </h2>
                      <dl className="mt-2 divide-y divide-hairline text-[14px]">
                        {(f as Array<[string, string]>).map(([k, v], j) => {
                          const same = fa[j][1] === fb[j][1];
                          return (
                            <div key={k} className={`flex justify-between gap-3 px-2 py-1.5 ${same ? "bg-[#f3f7f4]" : ""}`}>
                              <dt className="text-muted">{k}</dt>
                              <dd className="text-right font-[600]">
                                {v}
                                <span className="sr-only">{same ? ` (${t("matches")})` : ` (${t("differs")})`}</span>
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  ))}
                </div>
                {r.decision === "pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ConfirmActionButton action={decideDuplicate.bind(null, locale, r.id, "merged")} variant="primary" size="md" title={t("merge")} body={t("mergeNote")} confirmLabel={t("merge")} disabled={!lead} successMessage={t("merged")}>
                      {t("merge")}
                    </ConfirmActionButton>
                    <ActionButton action={decideDuplicate.bind(null, locale, r.id, "not_duplicate")} size="md">
                      {t("notDup")}
                    </ActionButton>
                    <ActionButton action={decideDuplicate.bind(null, locale, r.id, "ignored")} variant="tertiary" size="md">
                      {t("ignore")}
                    </ActionButton>
                  </div>
                ) : null}
              </Card>
            );
          })
        ) : (
          <p className="text-[14px] text-muted">{t("empty")}</p>
        )}
      </div>
    </AdminShell>
  );
}
