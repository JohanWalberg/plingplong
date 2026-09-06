"use client";

import { useEffect, type AnchorHTMLAttributes, type ReactNode } from "react";

export function beacon(listingId: string, kind: "view" | "click" | "save") {
  const body = JSON.stringify({ listingId, kind });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through
  }
  fetch("/api/metrics", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

/** Counts one detail-page view per page load. Honest metric: page opens, not impressions. */
export function TrackView({ listingId }: { listingId: string }) {
  useEffect(() => {
    beacon(listingId, "view");
  }, [listingId]);
  return null;
}

/** Outbound link to the landlord; counts a click-through before the browser navigates. */
export function OutboundLink({ listingId, children, className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { listingId: string; children: ReactNode }) {
  return (
    <a
      {...rest}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => beacon(listingId, "click")}
    >
      {children}
    </a>
  );
}
