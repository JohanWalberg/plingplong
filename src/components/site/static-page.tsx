import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/header";

export function StaticPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[760px] px-4 py-12 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{title}</h1>
        {intro ? <p className="mt-3 text-[17px] text-ink-2">{intro}</p> : null}
        <div className="prose-hb mt-8 flex flex-col gap-6 text-[15.5px] leading-relaxed text-ink-2">{children}</div>
      </main>
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-h2 text-ink">{title}</h2>
      <div className="mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}
