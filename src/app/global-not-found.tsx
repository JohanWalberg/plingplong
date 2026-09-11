import type { Metadata } from "next";
import { Instrument_Serif, Public_Sans } from "next/font/google";
import { LogoMark } from "@/components/ui/misc";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700"], variable: "--font-public-sans", display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = { title: "Sidan finns inte · plingplong", robots: { index: false } };

const COPY = {
  sv: { title: "Sidan finns inte.", body: "Adressen kan vara felstavad eller så har sidan tagits bort.", home: "Till startsidan", href: "/sv" },
  en: { title: "This page does not exist.", body: "The address may be misspelled or the page may have been removed.", home: "Go to the homepage", href: "/en" },
} as const;

/**
 * Served for URLs that match no route, with a real 404 status. It renders
 * outside the locale layout, so the locale is unknown: both languages are
 * shown, Swedish first, each marked with its own lang.
 */
export default function GlobalNotFound() {
  return (
    <html lang="sv" className={`${publicSans.variable} ${instrumentSerif.variable}`}>
      <body>
        <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
          <p className="flex items-center gap-2.5 text-ink">
            <LogoMark />
            <span className="text-[17px] font-[700] tracking-tight">plingplong</span>
          </p>
          {(["sv", "en"] as const).map((l) => (
            <section key={l} lang={l} className="mt-10 border-t border-hairline pt-8 first-of-type:border-0">
              <h1 className="font-serif text-h1">{COPY[l].title}</h1>
              <p className="mt-3 text-ink-2">{COPY[l].body}</p>
              <p className="mt-6">
                <a href={COPY[l].href} className="font-semibold">
                  {COPY[l].home}
                </a>
              </p>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
