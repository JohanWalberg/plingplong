# Status and pending work

Snapshot at the end of the first build session, 2026-09-05. Everything below
"Built" runs locally against the seed data; "Pending" is what remains.

## Built

**Foundation.** Next.js 16, Tailwind 4 with the design tokens, Drizzle schema
for the full data model, PostGIS via Docker, seed with real municipalities and
landlords plus about 40 synthetic listings, message catalogues in both languages
with a parity check, translated pathnames, unit tests (86), database integration tests (24) and Playwright
end-to-end tests with axe (22).

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

**Rendering and caching (2026-09-06).** The home page, municipality and
landlord indexes, coverage page and every municipality and landlord page
are prerendered per locale and refreshed every five minutes (ISR), and the
content pages are fully static. Two things had silently kept them dynamic:
translations read in the public layout's footer and in the loading
skeletons without a request locale, which made next-intl fall back to
request headers. The public layout now sets the locale, and loading files
read it from `next/root-params`, which required `[locale]/layout.tsx` to be
the root layout (the bare `app/layout.tsx` is gone; `global-not-found.tsx`
covers unmatched URLs). Search results stay uncached as the brief asks; the
facet, coverage and source-health lookups beside them are memoized for
`CACHE_TTL_SECONDS`, and every web-side listing change clears that memo and
the ISR pages through `invalidateListingCaches()`.

**UX batch (2026-09-07).** The search box suggests municipalities and
areas with their home counts (combobox, keyboard driven, no-JS fallback).
Listing pages get a sticky action bar on phones, a share button that copies
the canonical link, and record themselves in a recently-viewed row shown on
the home and saved pages. Results paginate with page numbers and show
compact cards on phones; deadlines read as a day count inside two weeks on
one line with the checked time. The saved page sorts by deadline, shows
days left, lets you unsave, groups homes that are gone and copies the list.
The map highlights the hovered row's marker and vice versa. Landlords get
inline validation on the listing form and a 14-day views sparkline per
home. A print stylesheet strips chrome and prints link addresses.

**Second polish pass (2026-09-06, evening).** Filter changes update the
result list in place with a busy state while the panel stays interactive.
The listing page loads MapLibre only when the location card scrolls near,
and zod no longer ships to the browser. The portal statistics chart shows
views, clicks and saves as grouped bars with a legend and a data table.

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

**Product review (2026-09-07, afternoon).** A walk through the public site,
portal and admin at desktop and phone widths, against the brief. Three
verified bugs, four gaps and five interface fixes, one commit each.

Bugs. Correlated subqueries interpolated an outer column that Drizzle renders
unqualified in a single-table select, so the name bound to the subquery's own
tables and matched nothing: the portal showed 0 homes per source and no source
per home, and the admin landlord list showed 0 listings and 0 sources for
everyone. An objection (a landlord closing their account, or staff setting
consent to objected) stopped the crawler but left everything it had already
collected in search. The partial-coverage banner said homes from a failing
source were missing from the results while they sat in the list below it.

Gaps. Similar homes appeared only on a home that was already gone. There was
no way to report a wrong listing. Nothing told an owner a home was about to
pass its deadline. Admin rendered raw database values (`active`, `queue`,
`crawl`, `present`, `submitted`) in a Swedish interface.

Interface. A phone showed neither the rent nor the deadline without scrolling
past everything. Six pages scrolled sideways on a phone, from grid items
sized to their content and a visually hidden label escaping a scroll box;
`e2e/responsive.spec.ts` now guards every surface at 390px. The home page
said nothing about how much it holds. "Saved searches" was renamed to
"Saved". The results coverage line links to the landlords behind it.

Not done: a user who belongs to several landlords still gets an arbitrary
one, which needs a product decision (a switcher, or one membership per
account).

## Review

A full code and security review from 2026-09-07 is in `REVIEW-2026-09-07.md`:
7 high, 16 medium, 14 low findings with an order of work. The high findings
(server-side request forgery in the fetch path, invitation takeover via open
sign-up, unvalidated URL schemes from feeds, missing security headers,
publish-before-image-validation, no transactions, unguarded seed) should be
fixed before any public deploy.

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
    listing set. Portal and admin changes invalidate immediately; crawls in
    the worker still rely on the five-minute revalidate.
11. **Observability.** No Sentry or structured log shipping; source health is
    in the database as the brief asks.
12. **Deployment.** No Vercel or Fly.io configuration, no CI workflow. The
    checks to run in CI are `pnpm typecheck`, `pnpm i18n:check`, `pnpm test`,
    `pnpm build`, `pnpm test:e2e`.
13. **Takedown SLA process.** Staff can now remove a listing with a logged
    reason from the admin listing page; there is still no ticket flow.
14. **Entity 404 shell.** Unmatched URLs get the styled global 404. Pages
    that call `notFound()` for an unknown slug answer 404 but stream Next's
    bare `__next_error__` shell until hydration (Next 16 behaviour for
    non-streamed 404s under a `[locale]` root).

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

`pnpm test:e2e` resets and reseeds the database first, then runs Playwright
against the dev server on port 3000. The last spec closes the seed landlord's
account, which is why the reset is part of the script; `pnpm test:e2e:only`
skips it for a quick rerun of a single spec.

## Local testing of crawls

Point seeded sources at the fixture server to exercise the worker end to end.
Outbound fetches refuse private addresses, so set `ALLOW_PRIVATE_FETCH=1` in
`.env` for this (it is ignored in production):

```bash
node scripts/dev-feed-server.mjs 4010 &
psql "$DATABASE_URL" -c "update source set url='http://localhost:4010/signalisten.xml' where url like '%signalisten%'"
pnpm exec tsx --env-file=.env scripts/sync-once.ts ab-bostadsstiftelsen-signalisten-i-solna
```

The first run flags the source for review because the fixture has far fewer
homes than the seeded baseline. That is the anomaly guard working.
