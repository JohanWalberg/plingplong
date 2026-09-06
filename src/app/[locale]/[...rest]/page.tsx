import { notFound } from "next/navigation";

/**
 * Unknown paths under a locale end here so the localised not-found page
 * renders inside the locale layout (with lang, fonts and copy) instead of
 * Next's bare default 404.
 */
export default function CatchAll() {
  notFound();
}
