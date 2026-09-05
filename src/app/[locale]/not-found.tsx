import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="font-serif text-h1">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-ink-2">{t("notFoundBody")}</p>
      <p className="mt-8">
        <Link href="/" className="font-semibold">
          {t("toHome")}
        </Link>
      </p>
    </main>
  );
}
