import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Storage for images uploaded to manually published listings. Local disk in
 * development, an S3-compatible bucket in production; callers only ever see
 * this interface.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Public URL the browser can load. */
  url(key: string): string;
}

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function contentTypeFor(key: string): string {
  return TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/**
 * Both backends serve through /api/uploads, so the bucket stays private, the
 * content-security policy needs no extra host, and switching driver changes
 * nothing that is already stored in a listing row.
 */
const publicUrl = (key: string) => `/api/uploads/${key}`;

// ---------------------------------------------------------------------------
// Local disk
// ---------------------------------------------------------------------------

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./storage/uploads");

function safe(key: string) {
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("invalid storage key");
  return p;
}

export const diskStorage: Storage = {
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
      return { data: await readFile(p), contentType: contentTypeFor(key) };
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
  url: publicUrl,
};

// ---------------------------------------------------------------------------
// S3-compatible bucket (AWS S3, Cloudflare R2, MinIO)
// ---------------------------------------------------------------------------

/** Built lazily so the client is only constructed when the driver is actually in use. */
export function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET");
  const clientPromise = (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    return new S3Client({
      // R2 has no regions and wants "auto"; a real S3 bucket must set S3_REGION.
      region: process.env.S3_REGION || "auto",
      endpoint,
      // A custom endpoint is almost always a bucket that does not do virtual hosting.
      forcePathStyle: Boolean(endpoint),
      // Without explicit keys the SDK falls back to the instance role.
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  })();

  return {
    async put(key, data, contentType) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await clientPromise;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    },
    async get(key) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await clientPromise;
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        return { data: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType ?? contentTypeFor(key) };
      } catch (e) {
        // A missing object is a 404, not a server error; anything else is worth knowing about.
        const name = (e as { name?: string }).name;
        if (name === "NoSuchKey" || name === "NotFound") return null;
        throw e;
      }
    },
    async delete(key) {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await clientPromise;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    url: publicUrl,
  };
}

export const STORAGE_DRIVER = process.env.STORAGE_DRIVER === "s3" ? "s3" : "disk";

export const storage: Storage = STORAGE_DRIVER === "s3" ? s3Storage() : diskStorage;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function imageKey(listingId: string, contentType: string) {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `listings/${listingId}/${randomBytes(8).toString("hex")}.${ext}`;
}
