# Follow-up review — security, performance, code quality

Second review pass, 2026-09-07, after the fix rounds recorded in
`REVIEW-2026-09-07.md` and the product review recorded in `STATUS.md`. Nothing
closed in the first review is repeated here unless it regressed; one thing did.

Findings are marked **[verified]** where they were reproduced against the running
app or the database during this pass, and **[reported]** where they come from
reading the code only. Fix the verified ones first.

---

## Status

Everything under "Fix before a public deploy", all five performance items and
all four code-quality items are fixed, one commit each, plus the three missing
rate limits and the two source-state escapes from the reported list. Two bugs
surfaced while writing tests for the fixes and are recorded below.

| Finding | Commit |
|---|---|
| S1 takedown left the listing readable | `4df6c45` |
| S2 daily view dedupe lasted a minute | `0c85e93` |
| S3 100 MB body before authentication | `fee0ba8` |
| S4, S5 localhost carve-out, force flag | `63992a5` |
| P1 crawl flushed every public page | `ff3b90e` |
| P2, P3 missing indexes | `4ecb747` |
| P4 facet cached per page and sort | `69b4ca9` |
| P5 unbounded limiter store | `0c85e93` |
| C1 retention never deleted the users | `b1901d8` |
| C2, C3 enqueue in transaction, slug retry | `2ea90e4` |
| C4 dead code and misleading comments | `c34bd18` |
| Missing rate limits (three paths) | `8d53a88` |
| Staff hold escapes, duplicate guard | `4dd8a53` |

Found while fixing, not in the original list:

- `purgeApplications` bound its cutoffs as `Date` objects inside a raw SQL
  template, which reaches the driver unmapped. The nightly purge threw every
  time it ran and nothing had exercised it. Fixed in `b1901d8`.
- The slug retry matched any unique violation, so a duplicate organisation
  number burned three retries and then threw instead of returning a validation
  failure. Fixed in `2ea90e4`.

Still open, all scale-related or judgement calls, none blocking:

- Duplicate detection is one candidate query per new listing, and the worker
  loads every area row per run. Both are invisible at this size.
- Five call sites select whole municipality or area rows including geometry
  columns. Free until boundaries are loaded, which the schema anticipates.
- The suggest endpoint evaluates a correlated count per candidate row.
- Portal and admin lists run correlated subqueries per row. Staff and landlord
  traffic only.
- The sitemap is assembled in memory and emits two entries per listing.
- The map page serialises full card objects into its payload.
- Accepting an invitation while signed in needs no confirmation of which
  organisation is being joined, and membership still resolves arbitrarily for a
  user who belongs to several. Both wait on the multi-landlord decision.
- Unscoped rent and size sorts still sort in full.
- The content-security policy is still report-only with no reporting endpoint.
- The "which listings are now orphaned" logic exists twice, in the crawl removal
  path and in `withdrawSources`.
- A crawled item whose municipality cannot be resolved is skipped silently, with
  no counter and no log line.
- Three weak tests: the poison-item case asserts only that a boolean is a
  boolean, the terms test asserts a property of the seed, and the bad-photo test
  never checks why the write was refused.
- `requireStaff`'s eight-hour session cap is covered end to end only.

## Fix before a public deploy

### S1. A takedown leaves the listing publicly readable — [verified]

`src/lib/queries/listings.ts:238` excludes only drafts:

```ts
where: and(eq(listing.slug, slug), ne(listing.status, "draft"))
```

So a listing with `status = "removed"` still renders in full. Fetched against
the running app, `/sv/bostad/hagalundsgatan-17-solna` answers **200** and exposes
the address, the rent, the room count and the area. `home/[slug]/opengraph-image.tsx`
renders the same into a share card.

Three different controls all land on `removed`:

| Control | Where |
|---|---|
| Staff takedown with a logged reason | `src/actions/admin.ts:438` |
| Landlord objection / account closure | `src/worker/sync.ts:415`, `src/actions/portal-account.ts:66` |
| The feed simply stopped listing it | `src/worker/sync.ts:252` |

The third is ordinary and the "no longer available" page is deliberate product
design for it. That is the problem: a legal takedown and a GDPR objection are
indistinguishable from an expired ad, so both leave the full record readable at
a stable, guessable URL (slugs are deterministic from the address).

Fix: a separate status or a `takenDownAt` column, excluded from
`getListingBySlug`, the share image and the saved page, answering 410.

### S2. Counting a listing view once per visitor per day lasts about 60 seconds — [verified]

This is a regression of finding S7, which the first review closed in `832fd70`.

`src/lib/rate-limit.ts:17` sweeps the store using the **current call's** window:

```ts
if (now - lastSweep > 60_000) {
  for (const [k, e] of store) if (!e.hits.some((t) => now - t < windowSeconds * 1000)) store.delete(k);
```

`src/app/api/metrics/route.ts:15` runs a 60-second per-IP limit on every
request, and `:34` runs the 86 400-second per-visitor-per-listing-per-day
dedupe. The first call's sweep evicts the second call's entries. Reproduced:

```
first view counted:        true
same visitor again:        false   (correct)
after a 60s-window sweep:  true    (should still be false)
```

So landlord view counts inflate for anyone who reloads, which is exactly what
S7 set out to prevent. Fix: store the window per entry and expire against that,
not against whichever caller happens to trigger the sweep.

### S3. 100 MB request bodies are accepted before any authentication — [verified]

`next.config.ts:13` sets `serverActions: { bodySizeLimit: "100mb" }` globally.
Next buffers the whole body before the action runs, so the rate limit in
`submitApplication` (`src/actions/signup.ts:36`) only fires after 100 MB has
been read. That action is reachable unauthenticated from the sign-up page. A few
concurrent posts exhaust server memory at no cost to the sender.

Fix: lower the global limit to roughly one photo and move multi-photo upload to
an authenticated route that streams.

### S4. A localhost auth URL silently disables the rest of the production checks — [verified]

`src/lib/env-check.ts:20`:

```ts
if (authUrl && LOCAL.test(authUrl)) return problems;
```

This returns before the https, `RESEND_API_KEY` and `STORAGE_DRIVER` checks. A
deploy that sets the real site URL but leaves `BETTER_AUTH_URL` at its
`.env.example` value starts clean, and with no Resend key `src/lib/email.ts:12`
prints every email, including password-reset links, to stdout.

My own code from the previous round. Fix: require *both* URLs to be local, or
gate the carve-out behind an explicit opt-in variable.

### S5. Support staff can undo a lead's decision — [verified]

`src/actions/admin.ts:33` guards with `requireStaff(locale, "support")` and then
passes the staff-only `force` flag:

```ts
await enqueueSourceSync(sourceId, true, true);
```

`force` is what lets a run bypass the `disabled` check (`src/worker/sync.ts:35`),
and disabling a source requires `lead` (`admin.ts:49`). Objected sources are
still refused unconditionally, which contains the worst case.

Fix: pass `force` only for a lead.

---

## Performance

### P1. Every crawl flushes the entire public route cache — [verified]

`src/lib/listing-cache.ts:11` calls `revalidatePath("/[locale]/(public)", "layout")`,
which clears the whole public subtree in both locales. `src/worker/index.ts:37`
calls it after any run that changed something.

At 14 sources on hourly intervals that is roughly one flush every four minutes
against pages that revalidate every five, so the ISR pages serve a cached copy
almost never. At 200 sources the site is effectively fully dynamic. Sixteen
action call sites do the same global flush for a single-listing edit.

The listing detail page declares no `revalidate`, so this flush is also its only
refresh path — and it is flushed by every unrelated crawl.

This is the cache work I added earlier, and it is too blunt. Fix: revalidate the
specific paths a run touched, or move to tags.

### P2. Every listing insert sequentially scans the listing table — [verified]

`src/lib/queries/slug.ts:19` resolves a free slug with `slug = base OR slug LIKE 'base-%'`.
`EXPLAIN` with sequential scans disabled still chooses one, because under this
database's collation a `LIKE` prefix needs a `text_pattern_ops` index and there
is none:

```
Seq Scan on listing  (cost=10000000000.00..10000000004.81 rows=1)
  Filter: ((slug = 'x') OR (slug ~~ 'x-%'))
```

Invisible at 54 rows. At 100 000 listings a 500-item first crawl is 500 full
scans inside one transaction that already holds row locks. Fix is one index:
`CREATE INDEX listing_slug_pattern_idx ON listing (slug text_pattern_ops)`.

### P3. Missing indexes for four of six search sorts — [verified]

The declared indexes on `listing` are:

```
listing_landlord_idx, listing_location_gix, listing_muni_status_first_seen_idx,
listing_muni_status_rent_idx, listing_pkey, listing_slug_unique,
listing_status_first_seen_idx, listing_status_last_seen_idx
```

There is no index on `area_id`, so the municipality page's area counts scan the
table. And `listing_status_last_seen_idx` is on `last_seen_at` while the
"recently checked" sort orders by `last_checked_at`, so it cannot serve it.
Reported alongside: the rent, size and deadline sorts fall back to a full sort,
and the result count joins `landlord` even when no landlord filter is set,
which costs an index-only scan.

### P4. The landlord facet cache keys on fields the query ignores — [verified]

`src/lib/queries/listings.ts:128` strips the landlord filter and never reads
`page` or `sort`, but `memoize` keys on the whole argument list
(`src/lib/ttl-cache.ts:39`). Six sorts times every page times every landlord
subset become separate entries in a 500-entry cache, all holding the same
answer. Filtered traffic evicts itself.

### P5. The rate-limit store is unbounded — [verified]

`src/lib/rate-limit.ts:6` is a plain `Map` with no cap, swept by full scan. The
TTL cache beside it bounds itself at 500 entries (`ttl-cache.ts:47`). The
metrics dedupe writes one key per visitor per listing per day. Same root cause
as S2 above.

### Reported, not verified this pass

- Duplicate detection runs one candidate query per new listing, outside the run
  transaction (`src/worker/sync.ts:289`). A 500-item feed is 500 queries.
- The worker loads every area row on every run of every source
  (`src/worker/sync.ts:78`) and then linear-scans that array per item.
- Five call sites select whole `municipality`/`area` rows including the
  PostGIS geometry columns, among them the per-keystroke suggest endpoint
  (`src/lib/queries/places.ts:120`). Free today because boundaries are not
  loaded; expensive the moment they are. The pattern is handled correctly
  everywhere else.
- The portal homes list runs three correlated subqueries per row, up to 600 for
  one page (`src/lib/queries/portal.ts:76`); `listLandlords` runs three per row
  with no limit.
- The sitemap emits two entries per listing and is assembled in memory; it
  breaks somewhere past about 25 000 listings.
- The map page serialises up to 500 full card objects into the payload.

### Checked and clean

The client bundle contains no AWS SDK, Sentry, zod, sharp, Drizzle or pg-boss.
MapLibre is the only large chunk at 964 KB and the build manifest confirms only
the map page references it, so it loads on demand. No page is accidentally
dynamic. The worker's main sync loop is properly batched. Connection pooling,
the TTL cache mechanics and image handling are all sound.

---

## Code quality

### C1. Rejected applicants' user rows are never deleted — [verified]

`src/worker/retention.ts:27` passes the 180-day `abandonedBefore` cutoff to
`deleteUserIfOrphan` for **both** classes, but rejected applications are purged
at 90 days. `src/lib/queries/users.ts:18` only deletes when the user is older
than the cutoff, so a rejected applicant's user row fails the test, and the
application row was already deleted on the line before, so nothing ever revisits
it. The row survives permanently, which is the opposite of what the comment on
`retention.ts:13` promises. This is a GDPR retention claim that the code does
not keep.

### C2. Dead scaffolding hiding the bug it was meant to prevent — [verified]

`src/actions/admin.ts:207` declares `let sourceIdToSync: string | null = null;`,
nothing assigns it, and the guard at `:256` is unreachable. The actual
`enqueueSourceSync` happens at `:250`, **inside** the transaction. If a later
statement in that transaction fails, the source row rolls back but the queued
job is already committed on its own connection, and the worker then fails with
"source not found".

### C3. Any unique violation is treated as a slug clash — [verified]

`src/lib/queries/slug.ts:26` matches on SQLSTATE `23505` alone. The `landlord`
table has two unique constraints (confirmed: `landlord_org_number_unique` and
`landlord_slug_unique`), so creating a landlord with a duplicate organisation
number retries three times and then throws, instead of returning a validation
failure. Staff see a redacted error digest.

### C4. Dead code — [verified]

Zero references outside their own file: `placeLabel` and the re-exported
`stockholmDate` (`queries/listings.ts:307,311`), `ButtonLink` and
`ExternalButtonLink` (`ui/button.tsx:71,80`), `isLead` (`lib/access.ts:55`),
`listAreas` (`queries/places.ts:40`). `src/worker/normalise.ts:90` is
`if (...) return null; return null;` — the branch cannot change the result.

### Reported, not verified this pass

- A `needs_review` source that an owner runs manually and that fails is moved to
  `degraded`, which the scheduler picks up again, undoing the S11 guard
  (`src/worker/sync.ts:303`). Separately, `setSourceEnabled(true)` lets an owner
  re-arm a source staff had disabled (`src/actions/portal-sources.ts:105`).
- `findDuplicates` runs after the run transaction commits with no error guard,
  so a failure there fails a crawl that already succeeded.
- The "which listings are now orphaned" logic exists twice, in the crawl removal
  path and in `withdrawSources`, differing only in details.
- Three weak tests: the poison-item case asserts only that a boolean is a
  boolean; the terms test asserts a property of the seed rather than of any code
  path; the bad-photo test never checks why the write was refused.
- `src/lib/storage.test.ts` sets `UPLOAD_DIR` after the module already captured
  it, so the disk tests write into the repo and the temp-directory setup is
  dead. It also holds the only `as never` left in the codebase.
- `notify.ts:18` claims running the job twice is safe. It is not; nothing
  dedupes. What actually protects it is the single daily schedule with no retry.
- A crawled item whose municipality cannot be resolved is skipped after being
  marked seen, so existing rows freeze silently with no counter and no log.
- `storage.ts:73` says the S3 client is built lazily; it is constructed at module
  load when the driver is s3, and an import failure there becomes an unhandled
  rejection.

### Genuinely good

The reviewers singled out `queries/sql.ts` and its tests, `syncSource`'s failure
discipline, `env-check.ts`, the no-op-when-unconfigured design of
`observability.ts` and `revalidate.ts`, `secrets.ts`, `action-result.ts`,
`diffTracked`, `freeSlug`, and the end-to-end suite's habit of naming the
offending element in a failure message.

---

## Housekeeping

- `pnpm audit` is clean. Only Better Auth is behind, by one patch.
- No `.env` is tracked and no secret-shaped string appears in git history.
- Security headers are served correctly by a production build, and the portal is
  no-store and noindex.
- `next.config.ts:31` lists the OpenFreeMap tile host twice with the default
  configuration, and keeps the hardcoded host allowed even if the map provider
  changes. Untidy rather than dangerous.
- The content-security policy is still report-only with no reporting endpoint,
  so it currently neither blocks nor reports. The Sentry DSN plumbing now exists
  to receive reports.
- No TODO or FIXME markers remain in the source; the build emits no warnings.
