import { customType } from "drizzle-orm/pg-core";

export type Point = { x: number; y: number };

/** EWKB hex from PostGIS: byte order, type (with an optional SRID flag), then x and y. */
function parsePointEwkb(hex: string): Point {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  // Bit 0x20000000 says an SRID follows the type and shifts the coordinates along.
  const offset = 5 + ((type & 0x20000000) !== 0 ? 4 : 0);
  if ((type & 0xffff) !== 1) throw new Error(`expected a point, got geometry type ${type & 0xffff}`);
  return { x: view.getFloat64(offset, littleEndian), y: view.getFloat64(offset + 8, littleEndian) };
}

/**
 * A WGS 84 point.
 *
 * Drizzle's own `geometry` column ignores its `srid` option twice over: it
 * emits `geometry(point)` in the DDL and writes `point(x y)` with no SRID, so
 * every coordinate here sat at SRID 0 under a column that claimed 4326. Bounding
 * box operators ignore SRID, which is why search never noticed, but a geography
 * cast or a spatial join would have been wrong. This declares the SRID in both
 * places, so PostGIS enforces it on write.
 */
export const point4326 = customType<{ data: Point; driverData: string }>({
  dataType() {
    return "geometry(Point,4326)";
  },
  toDriver(value: Point) {
    return `SRID=4326;POINT(${value.x} ${value.y})`;
  },
  fromDriver(value: string) {
    return parsePointEwkb(value);
  },
});
