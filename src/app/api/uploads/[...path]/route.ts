import { storage } from "@/lib/storage";

/** Serves uploaded listing images from the storage backend. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) return new Response(null, { status: 400 });
  const file = await storage.get(key);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
}
