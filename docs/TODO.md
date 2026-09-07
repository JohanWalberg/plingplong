# TODO — to MVP, highest priority first

Work through this list top to bottom. Tick an item when it is merged and
verified. Items marked **needs input** wait on a decision or an account from
the product owner; everything else can be built directly.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done · `[?]` needs input

## A. Content and correctness (blocks launch)

- [?] **A1. Connect the first real landlord sources.** Pick three to five
  landlords (suggestion: Signalisten, Förvaltaren, Bostadsförmedlingen,
  Stockholmshem, Heimstaden), confirm feed or page per landlord, verify the
  field mapping with the connection test, create the sources in admin, run and
  watch the anomaly guard. Custom adapter per site where the generic ones fail.
  Product decision needed: crawl public pages without consent, or contact first.
- [?] **A2. Geocoding.** Register for Lantmäteriet's address API, add a
  geocoder step in the crawl for listings without coordinates, store the result
  on the listing, fall back to area centroid only when geocoding fails.
- [x] **A3. Error boundaries.** `error.tsx` for public, portal and admin route
  groups with a retry action and the copy that already exists under
  `states.errorTitle` / `states.errorBody`.
- [x] **A4. Save-search button on the results page.** The component exists
  (`src/components/search/save-search-button.tsx`) but is not placed. Add it to
  the results toolbar with the current heading as label.
- [x] **A5. Terms of use for landlords.** Static page in both languages, linked
  from the sign-up checkbox and the portal footer. Needs a short text from the
  owner or a draft to approve.
- [x] **A6. Photo gallery on the listing detail page.** Show all images for
  manual listings (thumbnails, keyboard-navigable), first image for feeds.
- [x] **A7. Catalogue the remaining English-only admin strings.** Listing
  detail table headers, staff invite hint, "Pending" status label in the source
  filter. Run `pnpm i18n:check` after.

## B. Operations (blocks a public deploy)

- [?] **B1. Hosting choice and Dockerfile.** Fly.io or Railway for web +
  worker + Postgres/PostGIS in an EU region, or Vercel + Neon + Fly worker.
  Add Dockerfile, provider config, deploy checklist, migration step on deploy.
- [x] **B2. Object storage for uploads.** S3-compatible adapter (AWS S3,
  Cloudflare R2, MinIO) behind the storage interface, selected by
  `STORAGE_DRIVER`. Both drivers serve through `/api/uploads`, so the bucket
  stays private and stored keys do not change when the driver does. Production
  refuses to start unless the driver is chosen explicitly.
- [?] **B3. Email delivery.** Resend API key and sender domain; templates are
  ready.
- [x] **B4. Rate limiting** on sign-in, sign-up, password reset and the
  metrics endpoint.
- [x] **B5. CI workflow.** `.github/workflows/ci.yml`: typecheck, i18n check,
  unit tests, database tests, migrate and seed, build, then Playwright against
  the production build on a Postgres/PostGIS service.
- [x] **B6. Error monitoring.** Sentry for the web server (through
  `instrumentation.ts`, `register` plus `onRequestError`) and the worker
  (job failures, pg-boss errors, unhandled rejections). Off without
  `SENTRY_DSN`; errors are always logged either way. Source health stays in
  the database as the brief asks.

## C. Trust and compliance

- [x] **C1. Bolagsverket registry check.** Built and tested against a mock; activates when `BOLAGSVERKET_*` env vars are set. Provider interface with the free
  "värdefulla datamängder" API; needs the credentials from the owner's
  registration. Until then the queue shows "verify manually".
- [x] **C2. Staff can edit or hide a listing.** Admin listing detail: edit the
  factual fields, mark removed, with a revision row and reason. This is also the
  takedown mechanism.
- [x] **C3. Application retention and account deletion.** Purge rejected
  applications after a set period, let owners close the landlord account,
  document both on the privacy page.
- [x] **C4. Landlord terms acceptance stored** with a timestamp. The
  application records when the box was ticked; approval carries that onto the
  landlord. Both are shown in the approval queue and on the landlord page in
  admin.

## D. Nice to have for MVP

- [ ] **D1. Seed data polish.** More listings with photos, a few in Göteborg,
  Malmö and Uppsala so the popular-search pills are not empty.
- [x] **D2. Mobile map view.** Dedicated narrow layout (list under the map)
  instead of hiding the list.
- [x] **D3. Portal statistics: saves.** Count saves via the metrics endpoint
  when a seeker saves a home; the column exists.
- [x] **D4. Accessibility sweep** of pages not covered by the e2e axe run:
  portal sources, statistics, account; admin sources detail, listings,
  settings. Now `e2e/a11y.spec.ts`, run with the rest.
- [x] **D5. Loading skeletons** on every data-backed route, per the brief's
  definition of done.
- [x] **D6. next/image** for listing photos; uploads resized and converted.
- [x] **D7. Open Graph metadata** and generated share images.
- [x] **D13. UX batch (2026-09-07).** Search suggestions as you type, sticky
  mobile action bar on listings, share button, recently viewed row, numbered
  pagination, saved page with days left, unsave, gone group and copy list,
  map and list hover sync, compact result cards on phones, deadlines as a
  day count on one line with freshness, inline validation on the listing
  form, per-home sparklines, print stylesheet. Portal empty states already
  existed. Dark mode left as is: the product is deliberately single-theme.
- [x] **D12. Statistics chart** shows views, clicks and saves as grouped daily
  bars with a legend, per-bar tooltip and a hidden data table; palette
  validated for colour-vision separation.
- [x] **D11. Lighter bundles.** MapLibre loads on the listing page only when
  the location card nears the viewport; zod stays server-side (the filter
  panel imports a zod-free search-params module).
- [x] **D10. Filter changes update in place.** One shared transition: the
  list dims with a progress bar and aria-busy while the sidebar, chips and
  sort stay interactive.
- [x] **D9. Static rendering.** Home, indexes, coverage and all municipality
  and landlord pages prerendered with five-minute ISR; content pages static.
- [x] **D8. Unmatched URLs get a styled 404.** `app/global-not-found.tsx`
  (Next's `globalNotFound` flag) serves a full bilingual document with a 404
  status. Pages that call `notFound()` for an unknown slug still stream Next's
  bare `__next_error__` shell until hydration; that is how Next 16 renders
  non-streamed 404s under a `[locale]` root and is rare in practice.

## E. Post-MVP (from the brief)

- [ ] BankID for landlords through an OIDC broker.
- [ ] Staff SSO (Google Workspace / Entra) with 2FA at the IdP.
- [ ] Playwright adapter for JavaScript-rendered landlord sites.
- [ ] Saved-search email alerts (requires seeker email, a product decision).
- [ ] Real municipality and area polygons from Lantmäteriet; search by drawn area.
- [ ] ISR on-demand invalidation when a crawl changes a municipality's listings.
