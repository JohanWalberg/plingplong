import { createTranslator } from "next-intl";
import type { Locale } from "@/i18n/routing";

type Template =
  | "applicationReceived"
  | "approved"
  | "needsInfo"
  | "rejected"
  | "invite"
  | "reset"
  | "sourceFailed";

export async function renderEmail(
  locale: Locale,
  template: Template,
  values: Record<string, string | number>,
): Promise<{ subject: string; text: string }> {
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "email" });
  return {
    subject: t(`${template}Subject` as never, values as never),
    text: t(`${template}Body` as never, values as never),
  };
}
