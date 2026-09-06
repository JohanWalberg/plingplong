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
- [ ] **A5. Terms of use for landlords.** Static page in both languages, linked
  from the sign-up checkbox and the portal footer. Needs a short text from the
  owner or a draft to approve.
- [ ] **A6. Photo gallery on the listing detail page.** Show all images for
  manual listings (thumbnails, keyboard-navigable), first image for feeds.
- [x] **A7. Catalogue the remaining English-only admin strings.** Listing
  detail table headers, staff invite hint, "Pending" status label in the source
  filter. Run `pnpm i18n:check` after.

## B. Operations (blocks a public deploy)

- [?] **B1. Hosting choice and Dockerfile.** Fly.io or Railway for web +
  worker + Postgres/PostGIS in an EU region, or Vercel + Neon + Fly worker.
  Add Dockerfile, provider config, deploy checklist, migration step on deploy.
- [ ] **B2. Object storage for uploads.** S3-compatible adapter (Cloudflare R2)
  behind the existing storage interface, selected by env var.
- [?] **B3. Email delivery.** Resend API key and sender domain; templates are
  ready.
- [ ] **B4. Rate limiting** on sign-in, sign-up, password reset and the
  metrics endpoint.
- [ ] **B5. CI workflow.** typecheck, i18n check, unit tests, build, e2e
  against a Postgres service.
- [ ] **B6. Error monitoring.** Sentry for web and worker; keep source health
  in the database as the brief asks.

## C. Trust and compliance

- [?] **C1. Bolagsverket registry check.** Provider interface with the free
  "värdefulla datamängder" API; needs the credentials from the owner's
  registration. Until then the queue shows "verify manually".
- [ ] **C2. Staff can edit or hide a listing.** Admin listing detail: edit the
  factual fields, mark removed, with a revision row and reason. This is also the
  takedown mechanism.
- [ ] **C3. Application retention and account deletion.** Purge rejected
  applications after a set period, let owners close the landlord account,
  document both on the privacy page.
- [ ] **C4. Landlord terms acceptance stored** with timestamp on approval.

## D. Nice to have for MVP

- [ ] **D1. Seed data polish.** More listings with photos, a few in Göteborg,
  Malmö and Uppsala so the popular-search pills are not empty.
- [ ] **D2. Mobile map view.** Dedicated narrow layout (list under the map)
  instead of hiding the list.
- [ ] **D3. Portal statistics: saves.** Count saves via the metrics endpoint
  when a seeker saves a home; the column exists.
- [ ] **D4. Accessibility sweep** of pages not covered by the e2e axe run:
  portal sources, statistics, account; admin sources detail, listings,
  settings.

## E. Post-MVP (from the brief)

- [ ] BankID for landlords through an OIDC broker.
- [ ] Staff SSO (Google Workspace / Entra) with 2FA at the IdP.
- [ ] Playwright adapter for JavaScript-rendered landlord sites.
- [ ] Saved-search email alerts (requires seeker email, a product decision).
- [ ] Real municipality and area polygons from Lantmäteriet; search by drawn area.
- [ ] ISR on-demand invalidation when a crawl changes a municipality's listings.
