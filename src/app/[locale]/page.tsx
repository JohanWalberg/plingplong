import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await resolveLocale(params);
  const t = await getTranslations("home");
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="font-serif text-display">{t("title")}</h1>
      <p className="mt-3 text-ink-2">{t("sub")}</p>
    </main>
  );
}
