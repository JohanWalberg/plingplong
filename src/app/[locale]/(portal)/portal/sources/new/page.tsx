import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { SourceForm } from "@/components/portal/source-form";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function NewSourcePage({ params }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale, "owner");
  const t = await getTranslations("portal.source");
  return (
    <PortalShell viewer={me} active="sources">
      <h1 className="font-serif text-[32px] leading-tight">{t("title")}</h1>
      <p className="mt-1 mb-6 max-w-[64ch] text-ink-2">{t("sub")}</p>
      <SourceForm />
    </PortalShell>
  );
}
