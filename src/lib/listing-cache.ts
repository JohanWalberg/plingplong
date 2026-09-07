import { revalidatePath } from "next/cache";
import { invalidate, LISTINGS_NS } from "./ttl-cache";

/**
 * Clears the memoized search queries and the ISR pages under the public
 * layout. Called directly by portal and admin actions, and by the worker
 * through POST /api/revalidate after a crawl changes what search returns.
 */
export function invalidateListingCaches() {
  invalidate(LISTINGS_NS);
  revalidatePath("/[locale]/(public)", "layout");
}
