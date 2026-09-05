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
  onMoveEnd?: (bounds: [number, number, number, number]) => void;
  selectedId?: string | null;
  attribution?: string;
};

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";

/**
 * MapLibre map with rent-labelled markers and supercluster clustering.
 * The style URL comes from NEXT_PUBLIC_MAP_STYLE_URL (self-hosted or metered
 * tiles); the MapLibre demo style is the zero-config fallback.
 */
export function ListingMap({ center, zoom = 11, bounds, markers, ariaLabel, interactive = true, onSelect, onMoveEnd, selectedId, attribution }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerEls = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onMoveEndRef = useRef(onMoveEnd);
  onSelectRef.current = onSelect;
  onMoveEndRef.current = onMoveEnd;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
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
    if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 15 });
    map.on("load", () => setReady(true));
    map.on("moveend", () => {
      const b = map.getBounds();
      onMoveEndRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });
    map.on("click", () => onSelectRef.current?.(null));
    mapRef.current = map;
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
      for (const m of markerEls.current) m.remove();
      markerEls.current = [];
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
          const active = m.active || m.id === selectedId;
          el.className = `rounded-md border px-2 py-1 text-[12.5px] font-[700] tabular shadow-md ${active ? "z-10 border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink hover:border-ink"}`;
          el.textContent = m.label;
          el.setAttribute("aria-label", `${m.address}: ${m.label}`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current?.(m.id);
          });
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 15 });
  }, [bounds]);

  return <div ref={container} role="region" aria-label={ariaLabel} className="h-full w-full" />;
}
