"use client";

import { useState } from "react";

/**
 * Hotlinked listing photo with a graceful fallback. Landlord images are never
 * copied, so they can disappear; when one fails we show the same no-photo
 * state the card is designed for instead of a broken image.
 */
export function ListingImage({ src, address, noImage, className }: { src: string | null; address: string; noImage: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-placeholder text-center text-meta text-faint`} aria-label={`${address}: ${noImage}`} role="img">
      <span className="px-3">{noImage}</span>
    </div>
  );
}
