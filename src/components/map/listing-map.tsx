"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMarker = { id: string; lon: number; lat: number; label: string; slug: string; address: string; active?: boolean };

type Props = {
  center?: [number, number];
  zoom?: number;
  bounds?: [number, number, number, number];
  markers: MapMarker[];
  ariaLabel: string;
  interactive?: boolean;
  onSelect?: (id: string | null) => void;
  /** `userMoved` is false for the map's own initial fit, true for a drag, a zoom or an eased jump. */
  onMoveEnd?: (bounds: [number, number, number, number], userMoved: boolean) => void;
  selectedId?: string | null;
  /** Highlighted from the list on hover; mirrors onHover from the markers. */
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  attribution?: string;
  /** When set, the map eases to this point (used when a list item is chosen). */
  focus?: { lon: number; lat: number; zoom?: number; key: number } | null;
  /**
   * Refit the viewport to these bounds whenever `key` changes. `bounds` is
   * fitted once and then the visitor owns the viewport; this is the escape
   * hatch for the times they asked to be moved, such as searching a place.
   */
  fitTo?: { bounds: [number, number, number, number]; key: string } | null;
  /** Never start further out than this, even if the results are spread wide. */
  minInitialZoom?: number;
};

function markerClass(active: boolean, hovered: boolean) {
  const base = "rounded-md border px-2 py-1 text-[12.5px] font-[700] tabular shadow-md transition-transform";
  if (active) return `${base} z-10 border-primary bg-primary text-white${hovered ? " scale-110" : ""}`;
  if (hovered) return `${base} z-10 scale-110 border-ink bg-primary text-white`;
  return `${base} border-line-strong bg-surface text-ink hover:border-ink`;
}

/** How long the map takes to glide to a searched place. */
const FIT_MS = 600;

/** Stands in for "the view is not a place", which no place key can equal. */
const NO_PLACE = "";

/** Rides along on the camera moves the code triggers, marking them as not the visitor's. */
const FIT = { hbFit: true };

// OpenFreeMap: free OSM-based vector tiles, no key. Swap for Protomaps/MapTiler via NEXT_PUBLIC_MAP_STYLE_URL.
const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * MapLibre map with rent-labelled markers and supercluster clustering.
 * The style URL comes from NEXT_PUBLIC_MAP_STYLE_URL (self-hosted or metered
 * tiles); the MapLibre demo style is the zero-config fallback.
 */
/** The marker with the most neighbours within roughly 4 km: where the homes actually are. */
function densestMarker(markers: MapMarker[]): MapMarker | undefined {
  if (markers.length < 2) return markers[0];
  const kmPerDegLat = 111;
  let best: MapMarker | undefined;
  let bestCount = -1;
  for (const a of markers) {
    const kmPerDegLon = 111 * Math.cos((a.lat * Math.PI) / 180);
    let count = 0;
    for (const b of markers) {
      const dx = (a.lon - b.lon) * kmPerDegLon;
      const dy = (a.lat - b.lat) * kmPerDegLat;
      if (dx * dx + dy * dy <= 16) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = a;
    }
  }
  return best;
}

export function ListingMap({ center, zoom = 11, bounds, markers, ariaLabel, interactive = true, onSelect, onMoveEnd, selectedId, hoveredId = null, onHover, attribution, focus, fitTo, minInitialZoom = 13 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerEls = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onMoveEndRef = useRef(onMoveEnd);
  const onHoverRef = useRef(onHover);
  const elsById = useRef(new Map<string, HTMLButtonElement>());
  const fitKey = useRef<string | null>(null); // null until the first fit is accounted for
  onSelectRef.current = onSelect;
  onMoveEndRef.current = onMoveEnd;
  onHoverRef.current = onHover;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    // Worker served from /public; see scripts/copy-maplibre-worker.mjs.
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    const map = new maplibregl.Map({
      container: container.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE,
      center: center ?? [18.06, 59.33],
      zoom,
      interactive,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: attribution }), "bottom-right");
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 15 }, FIT);
      if (map.getZoom() < minInitialZoom) {
        // Results spread wider than the zoom floor allows: the centre of the whole
        // box can be empty countryside, so centre on the selected home (the first
        // in the list) and let panning re-query the rest.
        const focusMarker = densestMarker(markers) ?? markers[0];
        if (focusMarker) {
          map.jumpTo({ center: [focusMarker.lon, focusMarker.lat], zoom: minInitialZoom }, FIT);
          onSelectRef.current?.(focusMarker.id);
        }
      }
    }
    map.on("load", () => setReady(true));
    // Fits the code asked for carry a marker on the event itself, so telling them
    // from a drag needs no guessing. A flag with a timer around it was the old
    // way, and it mistook whichever movement it happened to be racing.
    map.on("moveend", (e) => {
      const b = map.getBounds();
      onMoveEndRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], !("hbFit" in e));
    });
    map.on("click", () => onSelectRef.current?.(null));
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __hbMap?: MLMap }).__hbMap = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const render = () => {
      if (process.env.NODE_ENV !== "production") (window as unknown as { __hbMarkers?: MapMarker[] }).__hbMarkers = markers;
      for (const m of markerEls.current) m.remove();
      markerEls.current = [];
      elsById.current.clear();
      const index = new Supercluster<{ marker: MapMarker }>({ radius: 48, maxZoom: 16 });
      index.load(markers.map((m) => ({ type: "Feature", geometry: { type: "Point", coordinates: [m.lon, m.lat] }, properties: { marker: m } })));
      const b = map.getBounds();
      const clusters = index.getClusters([b.getWest() - 1, b.getSouth() - 1, b.getEast() + 1, b.getNorth() + 1], Math.floor(map.getZoom()));
      for (const c of clusters) {
        const [lon, lat] = c.geometry.coordinates;
        const el = document.createElement("button");
        el.type = "button";
        if ("cluster" in c.properties && c.properties.cluster) {
          const count = c.properties.point_count as number;
          el.className = "flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-white bg-ink px-2 text-[13px] font-[700] text-white shadow-md";
          el.textContent = String(count);
          el.setAttribute("aria-label", `${count}`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const z = Math.min(index.getClusterExpansionZoom((c.properties as { cluster_id: number }).cluster_id), 17);
            map.easeTo({ center: [lon, lat], zoom: z });
          });
        } else {
          const m = (c.properties as { marker: MapMarker }).marker;
          el.className = markerClass(m.active || m.id === selectedId, m.id === hoveredId);
          el.textContent = m.label;
          el.setAttribute("aria-label", `${m.address}: ${m.label}`);
          el.dataset.markerId = m.id;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current?.(m.id);
          });
          el.addEventListener("mouseenter", () => onHoverRef.current?.(m.id));
          el.addEventListener("mouseleave", () => onHoverRef.current?.(null));
          el.addEventListener("focus", () => onHoverRef.current?.(m.id));
          el.addEventListener("blur", () => onHoverRef.current?.(null));
          elsById.current.set(m.id, el);
        }
        const marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        markerEls.current.push(marker);
      }
    };
    render();
    map.on("moveend", render);
    return () => {
      map.off("moveend", render);
    };
  }, [markers, ready, selectedId]);

  // Hover retints in place: rebuilding the markers on every hover would flicker.
  useEffect(() => {
    const selected = new Set(markers.filter((m) => m.active || m.id === selectedId).map((m) => m.id));
    for (const [id, el] of elsById.current) el.className = markerClass(selected.has(id), id === hoveredId);
  }, [hoveredId, selectedId, markers]);

  // Bounds are fitted once at creation. After that the user owns the viewport:
  // refitting on every prop change would fight their zoom and pan. `fitTo` is
  // the exception, and only when its key changes — one refit per place searched.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!fitTo) {
      // The view is a rectangle now, so whatever place comes next is a new one.
      // Remembering the last place here would leave a search for it doing nothing.
      fitKey.current = NO_PLACE;
      return;
    }
    if (fitKey.current === null) {
      fitKey.current = fitTo.key; // the opening fit already used these bounds
      return;
    }
    if (fitKey.current === fitTo.key) return;
    fitKey.current = fitTo.key;
    map.fitBounds(fitTo.bounds, { padding: 40, duration: FIT_MS, maxZoom: 15 }, FIT);
  }, [fitTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.easeTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), focus.zoom ?? 15), duration: 500 });
  }, [focus]);

  return <div ref={container} role="region" aria-label={ariaLabel} className="h-full w-full" />;
}
