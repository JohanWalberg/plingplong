import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff, isEngineer } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { ActionButton, ConfirmActionButton } from "@/components/admin/action-buttons";
import { ListingEditForm } from "@/components/admin/listing-edit-form";
import { getListingById } from "@/lib/queries/listings";
import { adminRemoveListing, adminRestoreListing, markListingReviewed } from "@/actions/admin";
import { formatDateTime, formatDateTimeShort, formatSek } from "@/lib/format";
import { Card } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminListingPage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const l = await getListingById(id);
  if (!l) notFound();
  const t = await getTranslations("admin.listings");
  const tp = await getTranslations("portal.perf");
  const reviewer = l.reviewedBy ? await db.query.user.findFirst({ where: eq(schema.user.id, l.reviewedBy), columns: { name: true } }) : null;

  return (
    <AdminShell
      viewer={viewer}
      active="listings"
      title={l.address}
      actions={
        <>
          <Link href={{ pathname: "/home/[slug]", params: { slug: l.slug } }} className={buttonClasses("secondary", "sm")}>
            {t("publicPage")}
          </Link>
          {!l.reviewedAt ? (
            <ActionButton action={markListingReviewed.bind(null, locale, l.id)} variant="primary">
              {t("markReviewed")}
            </ActionButton>
          ) : null}
          {viewer.role === "lead" ? (
            l.status === "removed" ? (
              <ActionButton action={adminRestoreListing.bind(null, locale, l.id)}>{t("restore")}</ActionButton>
            ) : (
              <ConfirmActionButton actionWithText={adminRemoveListing.bind(null, locale, l.id)} variant="danger" title={t("removeTitle")} body={t("removeBody")} confirmLabel={t("remove")} textareaLabel={t("reason")} textareaRequired>
                {t("remove")}
              </ConfirmActionButton>
            )
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <dl className="grid gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2">
              {(
                [
                  [t("colStatus"), <StatusPill key="s" tone={l.status === "active" ? "success" : "quiet"}>{l.status}</StatusPill>],
                  [t("colLandlord"), <Link key="l" href={{ pathname: "/admin/landlords/[id]", params: { id: l.landlordId } }}>{l.landlord.name}</Link>],
                  [tp("fieldRent"), l.rentMonthly === null ? "—" : formatSek(locale, l.rentMonthly)],
                  [tp("fieldRooms"), l.rooms ?? "—"],
                  [tp("fieldSize"), l.sizeSqm ?? "—"],
                  [tp("fieldDeadline"), l.applicationDeadline ?? "—"],
                  [tp("fieldMoveIn"), l.moveInDate ?? "—"],
                  [t("queue"), l.queueRequirement],
                  [t("colFirstSeen"), formatDateTime(locale, l.firstSeenAt)],
                  [t("colLastChecked"), formatDateTime(locale, l.lastCheckedAt)],
                  [t("slug"), l.slug],
                  [t("geo"), l.lat !== null && l.lon !== null ? `${l.lat?.toFixed(4)}, ${l.lon?.toFixed(4)}` : "—"],
                ] as Array<[string, React.ReactNode]>
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-meta text-muted">{k}</dt>
                  <dd className="font-[600]">{v}</dd>
                </div>
              ))}
            </dl>
            {l.reviewedAt ? <p className="mt-4 text-meta text-muted">{t("reviewed", { name: reviewer?.name ?? "", date: formatDateTimeShort(locale, l.reviewedAt) })}</p> : null}
          </Card>

          <section aria-labelledby="rev">
            <h2 id="rev" className="text-h3">
              {t("revisionsTitle")}
            </h2>
            <div className="mt-2">
              <Table minWidth={560}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>{t("colLastChecked")}</Th>
                    <Th>{t("colField")}</Th>
                    <Th>{t("colOld")}</Th>
                    <Th>{t("colNew")}</Th>
                    <Th>{t("colOrigin")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {l.revisions.map((r) => (
                    <tr key={r.id} className="border-b border-hairline last:border-0">
                      <Td>{formatDateTimeShort(locale, r.changedAt)}</Td>
                      <Td className="font-mono text-[12.5px]">{r.field}</Td>
                      <Td>{r.oldValue ?? "—"}</Td>
                      <Td>{r.newValue ?? "—"}</Td>
                      <Td>{r.origin}</Td>
                    </tr>
                  ))}
                  {!l.revisions.length ? (
                    <tr>
                      <Td className="text-muted">—</Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="text-h3">{t("editTitle")}</h2>
            <div className="mt-3">
              <ListingEditForm
                values={{
                  id: l.id,
                  address: l.address,
                  areaName: l.areaName ?? "",
                  rentMonthly: l.rentMonthly === null ? "" : String(l.rentMonthly),
                  rooms: l.rooms === null ? "" : String(l.rooms),
                  sizeSqm: l.sizeSqm === null ? "" : String(l.sizeSqm),
                  floor: l.floor === null ? "" : String(l.floor),
                  moveInDate: l.moveInDate ?? "",
                  applicationDeadline: l.applicationDeadline ?? "",
                  queueRequirement: l.queueRequirement,
                  segment: l.segment,
                  applicationUrl: l.applicationUrl ?? "",
                  description: l.description ?? "",
                }}
              />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-h3">{t("sourcesTitle")}</h2>
            <ul className="mt-3 flex flex-col divide-y divide-hairline text-[14px]">
              {l.sources.map((s) => (
                <li key={s.sourceId} className="py-2">
                  <Link href={{ pathname: "/admin/sources/[id]", params: { id: s.sourceId } }} className="font-[600]">
                    {s.source.landlord.name}
                  </Link>
                  <p className="font-mono text-[12.5px] text-muted">{s.externalId}</p>
                  <p className="text-meta text-muted">
                    {s.presentAtLastCheck ? "present" : "absent"} · {formatDateTimeShort(locale, s.lastCheckedAt)}
                  </p>
                  {s.sourceUrl ? (
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[13px]">
                      {s.sourceUrl}
                    </a>
                  ) : null}
                </li>
              ))}
              {!l.sources.length ? <li className="py-2 text-muted">{l.publishedDirectly ? "portal" : "—"}</li> : null}
            </ul>
          </Card>
          {isEngineer(viewer) ? (
            <Card className="p-5">
              <h2 className="text-h3">{t("rawPayload")}</h2>
              <pre className="mt-2 max-h-[400px] overflow-auto rounded bg-canvas p-3 text-[12px]">{JSON.stringify(l.sources[0]?.rawPayload ?? null, null, 2)}</pre>
            </Card>
          ) : (
            <p className="text-meta text-muted">{t("engineerOnly")}</p>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
