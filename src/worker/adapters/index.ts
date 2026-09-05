import { jsonAdapter, xmlAdapter } from "./feed";
import { htmlAdapter } from "./html";
import type { Adapter } from "./types";

export const ADAPTERS: Record<string, Adapter> = {
  [xmlAdapter.id]: xmlAdapter,
  [jsonAdapter.id]: jsonAdapter,
  [htmlAdapter.id]: htmlAdapter,
};

export function getAdapter(id: string): Adapter {
  const a = ADAPTERS[id];
  if (!a) throw new Error(`unknown adapter: ${id}`);
  return a;
}

export * from "./types";
export { detectMapping, findItems, getPath } from "./mapping";
export { sniffFeedAdapter } from "./feed";
