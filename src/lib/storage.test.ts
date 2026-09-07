import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const sent: Array<{ command: string; input: Record<string, unknown> }> = [];
let getResult: { body: Uint8Array | null; contentType?: string } | Error = { body: new Uint8Array([1, 2, 3]), contentType: "image/png" };

vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
    get name() {
      return this.constructor.name;
    }
  }
  return {
    S3Client: class {
      constructor(public config: Record<string, unknown>) {}
      async send(c: Command) {
        sent.push({ command: c.constructor.name, input: c.input });
        if (c.constructor.name !== "GetObjectCommand") return {};
        if (getResult instanceof Error) throw getResult;
        return { Body: getResult.body === null ? undefined : { transformToByteArray: async () => getResult as never && (getResult as { body: Uint8Array }).body }, ContentType: getResult.contentType };
      }
    },
    PutObjectCommand: class extends Command {},
    GetObjectCommand: class extends Command {},
    DeleteObjectCommand: class extends Command {},
  };
});

const { diskStorage, s3Storage, imageKey, contentTypeFor } = await import("./storage");

describe("imageKey and content types", () => {
  it("produces the key shape the upload route allows, with the right extension", () => {
    const id = "0f9c3a2e-1111-4222-8333-444455556666";
    expect(imageKey(id, "image/png")).toMatch(/^listings\/0f9c3a2e-1111-4222-8333-444455556666\/[0-9a-f]{16}\.png$/);
    expect(imageKey(id, "image/webp")).toMatch(/\.webp$/);
    expect(imageKey(id, "image/jpeg")).toMatch(/\.jpg$/);
  });

  it("maps an extension back to its type and falls back safely", () => {
    expect(contentTypeFor("listings/a/b.png")).toBe("image/png");
    expect(contentTypeFor("listings/a/b.jpg")).toBe("image/jpeg");
    expect(contentTypeFor("listings/a/b.exe")).toBe("application/octet-stream");
  });
});

describe("disk storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "hb-storage-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterEach(async () => rm(dir, { recursive: true, force: true }));

  it("round-trips a file and deletes it", async () => {
    // The module read UPLOAD_DIR at import, so exercise the default root it captured.
    const key = "listings/0f9c3a2e-1111-4222-8333-444455556666/abcdef0123456789.png";
    await diskStorage.put(key, Buffer.from([9, 8, 7]), "image/png");
    expect(await diskStorage.get(key)).toEqual({ data: Buffer.from([9, 8, 7]), contentType: "image/png" });
    await diskStorage.delete(key);
    expect(await diskStorage.get(key)).toBeNull();
  });

  it("returns null for a missing file and refuses a key that escapes the root", async () => {
    expect(await diskStorage.get("listings/none/none.png")).toBeNull();
    await expect(diskStorage.put("../escape.png", Buffer.from([1]), "image/png")).rejects.toThrow("invalid storage key");
  });

  it("serves through the app, not a bucket URL", () => {
    expect(diskStorage.url("listings/a/b.png")).toBe("/api/uploads/listings/a/b.png");
  });
});

describe("s3 storage", () => {
  beforeEach(() => {
    sent.length = 0;
    process.env.S3_BUCKET = "hyrabostad-uploads";
  });

  it("refuses to build without a bucket", () => {
    delete process.env.S3_BUCKET;
    expect(() => s3Storage()).toThrow("S3_BUCKET");
  });

  it("puts with the content type and an immutable cache header", async () => {
    await s3Storage().put("listings/a/b.png", Buffer.from([1]), "image/png");
    expect(sent[0].command).toBe("PutObjectCommand");
    expect(sent[0].input).toMatchObject({ Bucket: "hyrabostad-uploads", Key: "listings/a/b.png", ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" });
  });

  it("reads an object back as a buffer", async () => {
    getResult = { body: new Uint8Array([4, 5, 6]), contentType: "image/webp" };
    expect(await s3Storage().get("listings/a/b.webp")).toEqual({ data: Buffer.from([4, 5, 6]), contentType: "image/webp" });
  });

  it("treats a missing object as null and lets other failures through", async () => {
    getResult = Object.assign(new Error("gone"), { name: "NoSuchKey" });
    expect(await s3Storage().get("listings/a/b.png")).toBeNull();
    getResult = Object.assign(new Error("boom"), { name: "AccessDenied" });
    await expect(s3Storage().get("listings/a/b.png")).rejects.toThrow("boom");
  });

  it("serves through the app so the bucket can stay private", () => {
    expect(s3Storage().url("listings/a/b.png")).toBe("/api/uploads/listings/a/b.png");
  });
});
