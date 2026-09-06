"use client";

import Image from "next/image";
import { useState } from "react";

/** Images we serve ourselves (uploads) or allowlisted in next.config go through the optimizer. */
export function isOptimizable(src: string) {
  return src.startsWith("/") || src.startsWith("https://picsum.photos/");
}

/**
 * Listing photo with a graceful fallback. Landlord images are hotlinked and
 * never copied, so they can disappear; when one fails we show the same
 * no-photo state the card is designed for instead of a broken image.
 *
 * `className` sizes the frame; the image fills it. `sizes` tells the
 * optimizer how wide the frame renders so uploads are served at that width.
 */
export function ListingImage({
  src,
  address,
  noImage,
  className,
  sizes = "(min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  src: string | null;
  address: string;
  noImage: string;
  className: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className={`${className} relative block overflow-hidden`}>
        <Image src={src} alt="" fill sizes={sizes} priority={priority} unoptimized={!isOptimizable(src)} onError={() => setFailed(true)} className="object-cover" />
      </span>
    );
  }
  return (
    <div className={`${className} flex items-center justify-center bg-placeholder text-center text-meta text-faint`} aria-label={`${address}: ${noImage}`} role="img">
      <span className="px-3">{noImage}</span>
    </div>
  );
}
