"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListingImage } from "./listing-image";

/**
 * Photo gallery: a large image plus keyboard-navigable thumbnails. One image
 * renders without thumbnails. Arrow keys move between photos when the
 * thumbnail strip has focus.
 */
export function Gallery({ images, address }: { images: string[]; address: string }) {
  const t = useTranslations("listing");
  const [index, setIndex] = useState(0);
  if (!images.length) return null;
  const current = images[Math.min(index, images.length - 1)];
  const go = (i: number) => setIndex((i + images.length) % images.length);
  return (
    <figure className="m-0">
      <ListingImage key={current} src={current} address={address} noImage={t("noImage")} className="max-h-[480px] min-h-[220px] w-full" />
      {images.length > 1 ? (
        <div
          role="group"
          aria-label={t("galleryLabel", { count: images.length })}
          className="flex gap-2 overflow-x-auto p-3 scrollbar-thin"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(index + 1);
            if (e.key === "ArrowLeft") go(index - 1);
          }}
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t("galleryPhoto", { n: i + 1, count: images.length })}
              aria-current={i === index ? "true" : undefined}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-sm border-2 ${i === index ? "border-primary" : "border-transparent hover:border-line-strong"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <figcaption className="sr-only">{t("galleryCaption", { n: index + 1, count: images.length })}</figcaption>
    </figure>
  );
}
