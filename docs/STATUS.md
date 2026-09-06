# Status and pending work

Snapshot at the end of the first build session, 2026-09-05. Everything below
"Built" runs locally against the seed data; "Pending" is what remains.

## Built

**Foundation.** Next.js 16, Tailwind 4 with the design tokens, Drizzle schema
for the full data model, PostGIS via Docker, seed with real municipalities and
landlords plus about 40 synthetic listings, message catalogues in both languages
with a parity check, translated pathnames, unit tests (37) and Playwright end-
to-end tests with axe (10).

**Public site.** Home, search results with URL filter state, sorting,
pagination, coverage line, partial-coverage banner, empty state with recovery
actions, listing detail with source panel and hand-off tracking, removed-listing
page, municipality index and pages, landlord index and pages, coverage page,
map view with clustering, saved homes and searches in the browser, legal and
about pages, sitemap, robots, hreflang.

**Ingestion.** Adapters for XML, JSON and static HTML with auto-detected field
mapping, polite fetch with robots.txt and per-host rate limits, normaliser,
sync with revisions, removal only on success, anomaly guard, degraded/failed
states with tech-contact email, dedup candidates and merge, pg-boss worker with
scheduler, expiry and retention jobs.

**Auth and portal.** Email and password sign-in, sign-up creating an
application with automated checks, pending page, invitations, password reset.
Portal dashboard, add/edit/publish/unpublish/extend/delete listings with
images, performance page, sources with connection test and mapping table,
statistics, account with members.

**Admin.** Overview with KPIs and attention list, sources with runs and
settings, landlords, approval queue with approve/request-detail/reject and
a registry check, listings with revisions, raw payload, staff editing and
takedown with a logged reason, duplicate review with merge, coverage, staff
roles.

**Hardening.** Error boundaries on every surface, rate limiting on sign-in,
sign-up, password reset and metrics, application retention (90/180 days) in
the nightly housekeeping job, owner-initiated account closure.

**UI polish (2026-09-06).** Skeleton loading states on every data-backed
route, with the signed-in portal and admin pages in `(app)` and `(staff)`
route groups so sign-in pages keep their own look. Listing photos through
`next/image`: uploads and seed images are resized and served as AVIF/WebP,
hotlinked landlord photos are marked unoptimized per image. Open Graph
metadata and generated share images for listings, municipalities, landlords
and a site default. Map view stacks the list under the map on phones. Saves
are counted and shown in portal statistics. An axe sweep covers every
portal, admin and public page; unknown paths under a locale reach the
localised not-found page, and unknown listing, municipality and landlord
slugs answer a real 404 from a per-slug layout that runs before the loading
boundary.

## Pending

Items the brief or the design call for that are not built yet, in rough
priority order.

1. **BankID for landlords** via an OIDC broker (Criipto or Signicat). The auth
   layer has a provider slot; nothing is wired. Decision 8 in `DECISIONS.md`.
2. **Staff SSO** (Google Workspace / Entra) with 2FA at the IdP. Staff sign in
   with email and password today; the eight-hour cap is enforced server-side.
3. **Company register credentials.** The Bolagsverket lookup is built behind a
   provider interface and tested against a mock; it activates when the
   `BOLAGSVERKET_*` variables are set after registering with Bolagsverket.
4. **Playwright adapter for JS-rendered landlord sites.** Only the static HTML
   adapter exists. HTML sources connected through the portal wait for staff
   set-up (status pending) as the design describes.
5. **Geocoding.** Listings without coordinates in the feed get the area or
   municipality centroid. A geocoder (Lantmäteriet or similar) is needed for
   accurate markers.
6. **Real municipality and area polygons.** Only centroids are seeded; search
   by map bounds uses listing points. Area membership comes from feed data.
7. **Image handling in production.** Uploads go to local disk. An S3-compatible
   bucket needs to be wired behind the storage interface before deployment.
8. **Email in production.** Emails log to the console unless `RESEND_API_KEY`
   is set. Templates are plain text in both languages.
9. **Saved-search alerts** (post-MVP in the brief). Saved searches are
   browser-only links today.
10. **ISR on-demand invalidation** when a crawl changes a municipality's
    listing set. Pages use a five-minute revalidate instead.
11. **Observability.** No Sentry or structured log shipping; source health is
    in the database as the brief asks.
12. **Deployment.** No Vercel or Fly.io configuration, no CI workflow. The
    checks to run in CI are `pnpm typecheck`, `pnpm i18n:check`, `pnpm test`,
    `pnpm build`, `pnpm test:e2e`.
13. **Takedown SLA process.** Staff can now remove a listing with a logged
    reason from the admin listing page; there is still no ticket flow.
14. **Server-rendered 404 shell.** `notFound()` pages stream Next's bare
    `__next_error__` html without `lang` or the stylesheet; the browser
    hydrates the right tree, so axe passes, but the 404 flashes unstyled.

## Conflicts and gaps from the design review, current state

From section 4 of `DESIGN-REVIEW.md`:

| # | Item | State |
|---|---|---|
| 1 | Missing `map.*` copy | Added in both catalogues. |
| 2 | Manual listings reviewed before or after publish | Live immediately; staff can mark reviewed afterwards. |
| 3 | Fetch cadence stated three ways | Per-source interval, default hourly; copy says "about once an hour". |
| 4 | Roles and invites not designed | Built: owner/editor, invitations, account page. |
| 5 | Needs-info and rejection flows | Built with message, email and history. |
| 6 | Admin route localisation | Localised under `/sv/admin` and `/en/admin`. |
| 7 | Saved searches without accounts | Browser storage only. |
| 8 | Segment enum mismatch | "Pets allowed" dropped; youth badge rendered. |
| 9 | Two freshness wordings | One wording; "Senast kontrollerad" only on detail and landlord pages. |
| 10 | Missing legal pages | Built: about collection, privacy, cookies, contact, FAQ, how it works. |
| 11 | Field mapping covers 8 of ~15 fields | All canonical fields mappable; per-source queue default exists. |
| 12 | Copy arrays mixed with fixtures | Split into catalogues, seed and config. |
| 13 | Typo "passer" | Fixed. |
| 14 | Mobile filter sheet lacked size, landlord, move-in | All filters in the sheet. |
| 15 | Deadline logic | Passed deadlines read "closed"; closing soon is 48 hours. |

Still open from the review's questions: what a "view" should count on the
statistics page beyond detail-page opens, and whether landlord pages should
state the fetch cadence publicly (they do today).

## Design deviations worth knowing

- The faint grey text token was darkened from `#8a8378` to `#6b655d` because
  it failed WCAG AA contrast at small sizes in the axe run.
- Sublet contracts are out of scope; the schema keeps the column.
- Listings from feeds without coordinates are placed at the area centroid, so
  map markers for those are approximate.

## Running the end-to-end suite

`pnpm test:e2e` needs the dev server on port 3000 and the seed data. The
last spec closes the seed landlord's account, so run `pnpm db:reset` before
each full run or the portal sign-ins time out.

## Local testing of crawls

Point seeded sources at the fixture server to exercise the worker end to end:

```bash
node scripts/dev-feed-server.mjs 4010 &
psql "$DATABASE_URL" -c "update source set url='http://localhost:4010/signalisten.xml' where url like '%signalisten%'"
pnpm exec tsx --env-file=.env scripts/sync-once.ts ab-bostadsstiftelsen-signalisten-i-solna
```

The first run flags the source for review because the fixture has far fewer
homes than the seeded baseline. That is the anomaly guard working.
