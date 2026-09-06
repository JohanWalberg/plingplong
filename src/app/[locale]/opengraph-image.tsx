import { getTranslations } from "next-intl/server";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { resolveLocale } from "@/lib/locale";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "home" });
  return ogCard({ kicker: "", title: t("title"), subtitle: t("sub"), footer: t("prop1Title") });
}
