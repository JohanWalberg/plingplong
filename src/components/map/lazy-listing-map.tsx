"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/misc";

const ListingMap = dynamic(() => import("./listing-map").then((m) => m.ListingMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/**
 * Loads MapLibre only once the map frame is near the viewport. The listing
 * page shows a small static location map below the fold; without this the
 * page paid for the whole map library on every visit.
 */
export function LazyListingMap(props: ComponentProps<typeof ListingMap>) {
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = frame.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div ref={frame} className="h-full w-full">
      {near ? <ListingMap {...props} /> : <div aria-hidden="true" className="h-full w-full bg-placeholder" />}
    </div>
  );
}
