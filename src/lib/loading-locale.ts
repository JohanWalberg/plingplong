import { locale } from "next/root-params";
import { setRequestLocale } from "next-intl/server";
import { toLocale } from "./locale";

/**
 * For loading.tsx files, which get no params. Reads the locale from the
 * root segment and sets it for next-intl so translations in the skeleton
 * do not fall back to request headers, which would make the whole route
 * dynamic and cost the index pages their static rendering.
 */
export async function loadingLocale() {
  const l = toLocale(await locale());
  setRequestLocale(l);
  return l;
}
