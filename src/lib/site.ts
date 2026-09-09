/**
 * Where the site lives, for anything that prints or links to it. Kept free of
 * Next imports so the worker and its tests can use it: seo.ts re-exports these
 * and adds the route-aware helpers on top.
 */
// A missing NEXT_PUBLIC_SITE_URL in production is refused at server start (src/lib/env-check.ts).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The bare host, for the places that print it rather than link to it: the
 * share-card footer, the crawler's User-Agent, the default sender address.
 * Derived rather than typed, so a domain change is one setting, not a hunt.
 */
export const SITE_HOST = new URL(SITE_URL).host;
