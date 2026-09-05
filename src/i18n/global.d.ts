import type { routing } from "./routing";
import type messages from "../../messages/sv.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Pathnames: typeof routing.pathnames;
  }
}
