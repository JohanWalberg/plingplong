import { createTranslator } from "next-intl";
import type { Locale } from "@/i18n/routing";

type Template =
  | "applicationReceived"
  | "applicationExists"
  | "accountExists"
  | "approved"
  | "needsInfo"
  | "rejected"
  | "invite"
  | "reset"
  | "sourceFailed"
  | "expiringSoon";

export async function renderEmail(
  locale: Locale,
  template: Template,
  values: Record<string, string | number>,
): Promise<{ subject: string; text: string }> {
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "email" });
  return {
    subject: t(`${template}Subject` as const, values),
    text: t(`${template}Body` as const, values),
  };
}
