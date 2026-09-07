import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Storage for images uploaded to manually published listings. Local disk in
 * development; swap the implementation for an S3-compatible bucket without
 * touching callers.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Public URL the browser can load. */
  url(key: string): string;
}

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function safe(key: string) {
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("invalid storage key");
  return p;
}

const diskStorage: Storage = {
  async put(key, data) {
    const p = safe(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  },
  async get(key) {
    try {
      const p = safe(key);
      const s = await stat(p);
      if (!s.isFile()) return null;
      const ext = key.split(".").pop()?.toLowerCase() ?? "";
      return { data: await readFile(p), contentType: TYPES[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  },
  async delete(key) {
    try {
      await rm(safe(key));
    } catch {
      // already gone
    }
  },
  url(key) {
    return `/api/uploads/${key}`;
  },
};

export const storage: Storage = diskStorage;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function imageKey(listingId: string, contentType: string) {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `listings/${listingId}/${randomBytes(8).toString("hex")}.${ext}`;
}
