import { storage } from "@/lib/storage";

/** Serves uploaded listing images from the storage backend. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.join("/");
  // Exactly the shape imageKey() generates; nothing else under the storage root is reachable.
  if (!/^listings\/[0-9a-f-]{36}\/[0-9a-f]{16}\.(jpg|png|webp)$/.test(key)) return new Response(null, { status: 400 });
  const file = await storage.get(key);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-disposition": "inline" },
  });
}
