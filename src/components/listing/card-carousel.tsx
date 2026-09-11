"use client";

import { useState, type MouseEvent } from "react";
import { ListingImage } from "./listing-image";

type Labels = { prev: string; next: string; photo: string };

/**
 * Photo strip inside a result card. The card's own link covers the card, so
 * the arrows sit above it and swallow their clicks; everything else still
 * opens the home. Arrows show on hover and on focus, always on touch screens.
 */
export function CardCarousel({ images, address, noImage, className, sizes, labels }: { images: string[]; address: string; noImage: string; className: string; sizes: string; labels: Labels }) {
  const [index, setIndex] = useState(0);
  const go = (e: MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + delta + images.length) % images.length);
  };
  const arrow = "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue group-hover:opacity-100 [@media(hover:none)]:opacity-100";
  return (
    <div className={`relative ${className}`} role="group" aria-label={labels.photo}>
      <ListingImage key={images[index]} src={images[index]} address={address} noImage={noImage} className="absolute inset-0 h-full w-full" sizes={sizes} />
      <button type="button" onClick={(e) => go(e, -1)} aria-label={labels.prev} className={`${arrow} left-2`}>
        <Chevron dir="left" />
      </button>
      <button type="button" onClick={(e) => go(e, 1)} aria-label={labels.next} className={`${arrow} right-2`}>
        <Chevron dir="right" />
      </button>
      <span aria-hidden="true" className="absolute bottom-2 right-2 z-10 rounded-full bg-navy/80 px-2 py-0.5 text-[11.5px] font-[700] tabular text-white">
        {index + 1}/{images.length}
      </span>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}
