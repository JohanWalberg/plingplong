import { revalidatePath } from "next/cache";
import { invalidate, LISTINGS_NS } from "./ttl-cache";

/**
 * Call after the web process changes listings (portal or admin actions):
 * clears the memoized search queries and the ISR pages under the public
 * layout. Crawls run in the worker and rely on the cache TTL instead.
 */
export function invalidateListingCaches() {
  invalidate(LISTINGS_NS);
  revalidatePath("/[locale]/(public)", "layout");
}
