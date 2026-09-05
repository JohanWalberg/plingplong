# Design review — prototypes vs. implementation brief

Reviewed 2026-09-05 against `project_design/` (three Claude Design files plus
`IMPLEMENTATION-BRIEF.md`). The design folder is git-ignored; this document
records what was learned from it so the repo stands on its own.

## 1. Verdict

The brief is complete enough to build from. The three prototypes are showcase
artboards, not an application: every link is `href="#1a"`, navigation is a
`state.screen` switch, data is hard-coded fixtures, and most buttons have no
handler. They should be treated as a **specification**, not as code to port.

What the prototypes do give us, and what will be extracted rather than retyped:

| Asset | Where | Notes |
|---|---|---|
| SV/EN copy deck | `COPY` object in each file | Key sets are identical in both languages in all three files (178, 360 and 64 leaf strings). |
| Design tokens | Foundations screen, `Bostadssök` | 14 colours, type scale, spacing 4–48, radii 4/6/8/full, badge tones, admin status pills. |
| Badge priority rule | `badges()` in `Bostadssök` | Max 3 per card; deadline, then queue, then contract, then segment. |
| Formatters | `rent()`, `roomsSize()`, `fresh()`, `deadline()` | Locale rules: `9 340 kr/mån` vs `SEK 9,340/month`, `1 room`/`2 rooms`. |
| Fixture data | `LISTINGS` (8), portal rows (6), admin sources (8), applications (4) | Cover the edge cases the brief asks the seed to include. |
| Route map | Access map in `Åtkomst och inloggning` | Translated pathnames for public and portal. |

## 2. Screen inventory

**Public search** (`Bostadssök.dc.html`, 10 screens): home, results, three mobile
frames, map, listing detail, municipality page, landlord page, edge cases
(empty results, removed listing), admin overview, foundations.

**Landlord portal** (`Hyresvärdsportal.dc.html`, 7 screens): landing, sign-up
and review status, connect source with field-mapping test, add property,
dashboard, listing performance, publish confirmation.

**Access** (`Åtkomst och inloggning.dc.html`, 5 screens): access map with roles
matrix, landlord BankID and magic-link login, staff SSO login, approval queue,
public footer.

## 3. Things the prototypes fake that the product must do for real

- Search input is never read; every search goes to a fixed "Solna" results page.
- Filters: only max rent and rooms filter anything. Size, queue, landlord,
  segment and move-in are inert. Sorting changes a label but never sorts.
- No URL state, no locale routes, no pagination, no data fetching, frozen clock
  (`NOW = 4 Sept 2026 14:43`), freshness strings partly literal ("idag 13:08").
- Map is CSS shapes with percent-positioned markers.
- Sign-up submit only toggles the validation alert. Source test only toggles a
  flag. Publish is a plain navigation to the confirmation screen.
- Dashboard tabs highlight but do not filter; every row opens the same listing.
- Approval queue: tabs do not filter, detail panel never follows the selection,
  decision buttons have no handler, "needs info" has no dialog or flow.
- BankID is a static QR and a toggled "waiting" panel. SSO buttons do nothing.
- No loading skeletons, empty states (except the two on the edge-cases screen),
  error states, dialogs, toasts, tablet layouts or dark theme anywhere.

## 4. Conflicts and gaps between the files and the brief

1. **`map.*` copy is missing.** The map screen references `map.hint`,
   `map.zoomIn`, `map.zoomOut`, `map.attribution`; no such namespace exists.
2. **Review timing for manual listings.** The performance timeline shows
   "Publicerad 09:14" then "Granskad av oss 10:02" (review after publish), but
   the dashboard has a listing in "Granskas" with zero views (held before).
3. **Fetch cadence** is stated three ways: "flera gånger i timmen" (landing),
   hourly/4h/daily (source screen), "en gång per timme" (confirm, landlord page).
4. **Roles and invites are not designed.** The brief requires owner/editor and
   magic-link invites; the portal has no account screen, member list or
   permission-gated buttons.
5. **Approval queue "needs info" and rejection** have labels only. No composer,
   no reason, no landlord-side status, no resubmission path.
6. **Admin route localisation** is ambiguous: `/admin/kallor` (sv) vs
   `/admin/sources` (en) with no locale prefix.
7. **Saved searches and "save home"** appear in every public header and on the
   detail page, but the brief says the public site has no accounts.
8. **Segment filter** lists "Husdjur tillåtna" which is not in the brief's
   `segment` enum; `badges.youth` exists in copy but is never rendered;
   `filters.segment` is "Målgrupp" in Swedish but "Housing type" in English.
9. **Freshness wording** has two competing forms: "Kontrollerad för N minuter
   sedan" and "Senast kontrollerad för N minuter sedan".
10. **Footer legal items** are plain text. No privacy, cookies, terms,
    `/om-insamling` or takedown page exists in any file, though the brief
    requires `/om-insamling` and a takedown SLA.
11. **Field mapping** covers 8 fields; the listing model has about 15. No
    mapping editor or per-source default for queue requirement exists, though
    copy refers to one "i inställningarna".
12. **Copy arrays mix text with fixture data and layout** (`signup.fields`,
    `add.sections`, `source.rows`, `dash.kpis`). These must be split into
    catalogue strings, seed data and component config during extraction.
13. **Typo** in `paths.sub`: "passer" should be "passar".
14. **Mobile filter sheet** lacks size, landlord and move-in filters.
15. **Deadline logic**: past deadlines render as "closes today"; there is no
    closed state. "Ansök snart" is 48h in the spec but `days === 1` in code.

## 5. Stack: following the brief, with two local notes

The brief's stack is adopted as written: Next.js 15 App Router, TypeScript
strict, Tailwind v4, PostgreSQL 16 + PostGIS via Docker, Drizzle, pg-boss,
next-intl, MapLibre, Auth.js with a BankID OIDC broker, Vitest and Playwright.

- `pnpm` is not installed on this machine. It will be enabled through
  `corepack`, which ships with Node 26.
- Local PostgreSQL 18 is installed but the project will use the
  `postgis/postgis:16-3.4` container so dev matches the brief.

## 6. Questions for the product owner

Answers that change the build (needed before step 1):

1. **Product name and domain.** The design says "Hyresmarknad" and
   `hyresmarknad.se`; the folder is `hyrabostad`. Which name goes in the
   package, the User-Agent string and the URLs?
2. **Is manual publishing in the MVP?** The portal has a `manualPublishing`
   feature flag. If yes, are manual listings live immediately and reviewed
   afterwards, or held until staff review them?
3. **Are sublets (andrahand) in scope?** One fixture is a sublet at 34 900 kr.
4. **Saved searches and save home.** Hide the links for MVP, or implement with
   browser storage and no account?
5. **Who is eligible?** Fixtures include a Brf (tenant-owner association) with
   no website. Are Brf:s, foundations and agencies accepted, and what replaces
   the email-domain check when there is no website?
6. **Admin language.** Swedish only, or localised like the public site?
7. **Photos.** Hotlink the landlord's image URL, or ship no-image cards only?
8. **BankID broker.** Criipto or Signicat, and do you already have an account?
   Locally a stub credentials provider will be used either way.

Proposed defaults for the rest (say "use defaults" to accept):

| Topic | Default |
|---|---|
| Fetch cadence | Per-source `fetch_interval`, default 60 min, choices 60/240/1440. Public copy says "about once an hour". |
| Freshness copy | "Kontrollerad för N minuter sedan"; buckets: just now, minutes, today HH:MM, yesterday, N days ago. |
| Deadline states | Passed: "Ansökningstiden har gått ut" (quiet). Today: urgent. Within 48h: soon. Else neutral. Rolling when null. |
| Sort definitions | newest = `first_seen_at` desc; checked = `last_checked_at` desc; deadline asc with null last; size desc null last; rent asc/desc with null last. |
| Max-rent filter | 25 000 means no limit and no chip. Null rent always passes. |
| Segment enum | Keep the brief's `none/student/youth/senior/accessible`. Drop "pets allowed" from the filter. |
| Queue filter | none / queue (includes points) / unknown. |
| Auto-unpublish | 7 days after deadline for direct listings only. Fetched listings follow the source. |
| Unpublish | Confirmation dialog, immediate, reversible within the portal. Metrics kept. |
| Editor role | Sees everything read-only; publish, unpublish and invite hidden server-side and in UI. |
| Invites | Magic link, 24h TTL, single use, must match the landlord's email domain. |
| Needs-info flow | Free-text message emailed to contact; application moves to `needs_info`; landlord replies by email; lead marks it pending again. |
| Rejection | Reason required, shown in email, re-application allowed. |
| Admin routes | Swedish only under `/admin`, no locale prefix, `X-Robots-Tag: noindex`. |
| Legal pages | `/om-insamling`, `/personuppgifter`, `/cookies` as static localised pages in step 6. |
| Metrics | View = detail page open, click = outbound CTA click, save = deferred with saved searches. Delta = previous 30 days. |
| Responsive | Public site fully responsive; portal and admin desktop-first with a working narrow layout, no dedicated mobile design. |

## 7. Build plan

Follow the brief's build order. Steps 1 to 6 (schema, tokens, primitives,
listing card, search, detail, municipality and landlord pages) ship before any
ingestion work. Each step lands as one or more commits so any change can be
reverted on its own.
