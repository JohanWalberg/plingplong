import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Stockholm",
    formats: {
      number: {
        sek: { style: "currency", currency: "SEK", maximumFractionDigits: 0 },
        plain: { maximumFractionDigits: 0 },
      },
      dateTime: {
        short: { day: "numeric", month: "short" },
        long: { day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit" },
        full: { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" },
      },
    },
  };
});
