// Copies MapLibre's web-worker bundle into public/ so the browser can load it
// from a stable URL. Turbopack cannot resolve the worker's `new URL(...,
// import.meta.url)` at runtime, which leaves the map stuck without a worker.
import { copyFileSync, mkdirSync } from "node:fs";
const out = "public/vendor/maplibre";
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `${out}/${f}`);
console.log("maplibre worker copied to", out);
