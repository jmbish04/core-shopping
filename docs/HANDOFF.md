# core-shopping — session handoff

Updated 2026-10-25 (sixth session). Read "This session (2026-10-25)" first.

## This session (2026-10-25, sixth) — the configuration layer and the four gaps

**Six PRs, stacked. Review and merge in this order:** #19 schema, #20 API,
#21 wishlist, #22 occasions, #23 idea bank, #24 config snapshot. Each is cut
from the one before, so merging out of order means resolving the stack by hand.

| PR | Task | What landed |
|---|---|---|
| #19 | `cs-be-1-6` | the twelve config tables, migration 0004 |
| #20 | `cs-be-2-8`, `cs-c-08` | `/api/config/*` CRUD + bulk, `GET /api/integrations` |
| #21 | `cs-gap-wishlist` | `wishlist_items`, migration 0005 |
| #22 | `cs-gap-occasion-calendar` | `occasions` + `goal_occasions`, migration 0006 |
| #23 | `cs-gap-idea-bank` | `ideas` + `idea_entities`, migration 0007, `/brain` |
| #24 | `cs-gap-config-asof` | `config_snapshots`, migration 0008 |

**All nine migrations are applied to `core_shopping` and read back** — 9 in the
ledger against 9 bundled — so `/api/health`'s migration check stays green.
Every config table is empty: no fixture leaked.

**Four rules this layer added, each with a test behind it:**

- **`neutral` is a stance, not an absence.** The brief calls the gap between
  ideal and frowned-upon travel ranges "an opportunity for the agent to
  persuide us the ROI is there". A date no window covers is a DIFFERENT fact
  and must resolve to null, matching `calendar_checks.window_stance = unknown`.
- **An unmeasured loyalty balance is null, never 0.** Paired with a nullable
  `balance_as_of`, and the contract refuses a balance with no read date.
- **A bulk save that DELETES has to ask.** `PUT /api/config/{resource}` takes
  `mode`: `upsert` (default) leaves unmentioned rows alone, `replace` deletes
  them. A client sending a partial list under a default of `replace` would
  silently destroy the rest.
- **`/api/integrations` is a DECLARED list, never discovered.** Seven
  integrations including the four that do not exist, each naming its task. An
  endpoint reporting only what it can find answers "all clear" for a deleted
  binding. `not_built` never degrades the verdict; a written-down gap is not an
  outage.

**Five things that cost real time, worth not rediscovering:**

1. **Drizzle's `transaction()` on node-postgres issues BEGIN/COMMIT, not a
   savepoint.** Calling it inside a manual `begin` COMMITS the outer
   transaction, and the closing `rollback` has nothing to undo. **Five fixture
   rows reached the real database that way**; the leftover-row assertion is the
   only reason it was noticed. In a verify script the outer transaction must be
   `db.transaction` itself; a NESTED `tx.transaction()` does use a savepoint,
   which is what makes a partial-write rollback testable.
2. **`now()` is constant inside a transaction.** `set updated_at = now()` in a
   verify fixture is a no-op, so a check written that way is PRE-SATISFIED. One
   was, and it hid a real bug.
3. **A Drizzle row is keyed by TypeScript property names.** `created_at`
   arrives as `createdAt`. A snake_case exclusion list matched nothing and the
   filter was dead code. Print the keys rather than assuming them.
4. **Drizzle WRAPS pg errors**: a constraint message is on `error.cause`, not
   `error.message`. Matching on `error.message` made a correct `restrict` look
   like a defect.
5. **A plant that does not apply reads exactly like a passing test.** One
   `sed` with the wrong indentation left the code untouched and the check went
   green against code believed broken. Every plant now asserts its edit landed
   before the run is trusted.

**`scripts/selfcheck-schema-drift.mjs` is new and matters repo-wide.** Every
other structural self-check asserts the GENERATED migration, so a regression in
the Drizzle schema stays green — a peer session proved it by making the hotel
brand index case-sensitive. This runs `drizzle-kit generate` into a scratch
directory and fails if it would emit a migration, which covers every table at
once. Note: **drizzle-kit exits 0 even when it fails internally**, so the
assertion on "No schema changes, nothing to migrate" is what proves the
comparison happened.

**CI: the red `sync` check on all six PRs is NOT from these changes.**
`agents-sync` resolves its runner from `AGENTS_SYNC_RUNNER`, which is set to a
self-hosted Proxmox pool with no `gh` on it, so the job dies on
`gh: command not found`. No branch in the stack touches a workflow file. And
**these PRs have no build or test check at all** — `agents-sync` is the only
PR check; `Workers Builds` runs on `main`. The local gate is the only gate
these changes have had before merge.

**Two decisions are open for Justin**, recorded in `docs/decisions/`:
`2026-10-25-venue-stances-holds-countries.md` (the table is named for venues
and has to hold countries) and `2026-10-25-mermaid-for-docs-model.md` (the ER
diagram is now 49 relationship lines of unrendered source; the earlier decision
rejected a CLIENT dependency, which is not the same as rendering at build time).

**Still not built, and these PRs do not pretend otherwise:** `cs-be-3-2`'s
briefing (so the wishlist, idea and config slices are the functions it will
compose, not changes to a payload that exists), `cs-be-7-1`'s cron (so
`GET /api/goals/due` is the rule with no schedule calling it), and anything
that raises a proposal or writes a review — there is no `insert(proposals)` or
`insert(reviews)` anywhere in the repo.

## Earlier (2026-10-17, fifth)

Read this next;
everything under "This session (2026-10-15, fourth)" and below is merged
to `main` (PR #15, `a66e371`), built by Workers Builds, and probed live.
PRs #11–#14 (core-browser binding, browser runs, sightings) landed between the
third and fourth sessions; their record is in Maestro, not here.

**Start by checking the newest build**, not by assuming it:
`workers_builds_list` for `core-shopping`. A merge is not a deploy until the
build says so. The Builds REST API refuses every account token on this machine
(`12006 Invalid token`); the self-hosted Cloudflare API MCP
(`cloudflare-api-mcp.hacolby.workers.dev/mcp`, bearer `WORKER_API_KEY`) works,
and so does reading the `Workers Builds` check run on the commit in GitHub.

## This session (2026-10-17, fifth)

**The original brief now lives in the repo: `docs/original-brief.md`.** It is
Justin's own words, verbatim, typos kept. Every plan and task in Maestro derives
from it, so it is the thing to audit against. Do not tidy it.

**Audited the built app against that brief.** The three Maestro plans cover it
closely — `trip_legs`, `itinerary_days`, `itinerary_items` with `fork_group_id`
forks and `depart_by`, `flight_options` with `points_amount` and
`transfer_path`, `hotel_options` with `violates_rule`, `calendar_checks` with
`days_since_last_trip` and `workdays_off_needed`, `flights.seat_product` for a
Mint Suite, `products` with brand, model and `msrp_cents`. Five things the brief
asks for had no home anywhere in the plan, and are now filed:

| Task | What the brief asked for that nothing held |
|---|---|
| `cs-gap-route-watch` | a newly announced nonstop, which has no dates and so no `flight` fingerprint |
| `cs-gap-occasion-calendar` | Prime Day and SF Restaurant Week: being due BEFORE a window, not during it |
| `cs-gap-wishlist` | a wanted thing as a row ("a shark slurpee machine"), not prose in one goal |
| `cs-gap-idea-bank` | "worth targeting next year" — neither a dated proposal nor a lesson |
| `cs-gap-config-asof` | reading a past review against the settings in force then |

Plus `cs-gap-docs-page`, because `/docs` was still the template's and told the
reader the database was D1.

- **`cs-gap-route-watch` — built, in `review`.** `route` is an entity kind with
  its own `routes` kind table and `ROUTE_STATUSES`; `attrsKey("route")` keys on
  `origin|destination|carrier` with **no date**, so two sites reporting one
  announcement collapse to one entity while a dated fare on the same city pair
  stays a separate `flight`. Migration `drizzle-pg/0003_thick_warhawk.sql`
  applied and read back: `entity_kind` lists `route`, `routes` has 8 columns, 4
  migrations in the ledger. `pnpm run selfcheck` is 20 files green including the
  new `selfcheck-route-watch.mjs` (11 checks), and it was proven able to fail
  twice — folding `service_starts_on` into the key, and a first-three-letters
  `airportCode` that turned "Taipei" into "TAI".
- **A flight finding used to lose its city pair.** `findingToSighting` passed
  only `departOn`, so `attrsKey("flight")` returned null and every browser-found
  fare deduped by URL — two sellers of one itinerary became two entities. It now
  passes `origin`, `destination`, `carrier` and `nonstop` for both kinds, and the
  browse prompt asks for IATA codes.
- **`cs-gap-docs-page` — built, in `review`.** Six pages under
  `pages/docs/`: `/docs`, `/docs/original-goals`, `/docs/model`,
  `/docs/agent-loop`, `/docs/surfaces`, `/docs/roadmap`, plus
  `components/docs/` (ReUI `Frame`, `Badge`, `CodeBlock`, tokens only) and a
  Documentation nav group in `lib/config.ts`. `/docs/model` **imports** the enum
  lists from `@/shared/contracts`, so a rename cannot leave the page stale.
  Three things left open and recorded in that task's worklog: the ER diagram is
  Mermaid **source** in a `CodeBlock` because no `mermaid` package is installed;
  the 2026-10-07 decision record says D1 keeps sessions and **there is no
  sessions table** (correct the record, not the page); and retention reads
  "meant to be purged" because `cs-be-7-1`'s cron does not exist.
- **The four other gaps are filed, not built**, because none is observable on its
  own: the occasion calendar needs the BE-7 cron's due-goal computation, and the
  wishlist, the idea bank and config history each need `cs-be-1-6` config tables
  plus the `cs-be-2-8` config API. Shipping a table nothing reads would read as
  progress and be none.
- **`067a29e7ed5b` goals findings count — fixed, in `review`.** `goals.ts` now
  has its own `qualified()` and both correlated subselects reference
  `"goals"."id"`. New `pnpm run verify:goal-counts` drives the real list query
  (now exported as `listGoals()`) against real Postgres with rows in a
  rolled-back transaction: two goals with different counts, three sightings of
  two entities, a goal with none, and a sighting with a null `goal_id`.
  Restoring the bug turned it red on `findings_count`, and `runs_count` stayed
  green — proof of the note in that task that `runs_count` was right only
  because `run_goals` has no `id` column. It is qualified now too.
- **The tokens SDK is intermittently flaky from a bare `node` run here.**
  `requireSecret("CORE_SHOPPING_PG_OWNER_PASSWORD")` threw "not found" twice
  while `tokens show` answered fine in the same shell, and worked under
  `pnpm exec node`. Pass the value in from the shell rather than debugging it.
  A direct `pg` client to 192.168.1.50 also needs `ssl: { rejectUnauthorized:
  false }`, same as `drizzle.pg.config.ts`, or it fails in `ClientAuthentication`.

## This session (2026-10-15, fourth)

- **`cs-fe-10-2` Run detail — done.** `/runs/{id}`: step trace, MCP tool
  calls, facts, goals, sightings, proposals; browser runs get **Refresh from
  core-browser** (`POST /api/runs/{id}/sync`). Queue rows link to it.
  `GET /api/runs/{id}` now returns `goals`, `sightings`, `proposals` as rows.
  New `pnpm run verify:run-detail`.
- **`cs-fe-1-2`, `1-3`, `1-4` Overview sections — done.** Throughput stacked by
  outcome, incidents, goal run strips, recent activity with **Review N items**.
  The payload gained `runs_per_day[].browser`, strip-run `summary` and
  `sightings_count`, and `recent_runs`. `verify:dashboard` covers all three.
- **`b0da7b27fea5` favicon — done.** Canonical and og tags use the request
  origin; no more `localhost:4321` in production.
- **Outcome colours are state tokens** (`--success`, `--destructive`,
  `--info`), not `chart-1..5`: in order, those drew "failed" green.
- **Local rendering:** run `wrangler dev` with `WORKER_API_KEY_DEV` set to a
  throwaway passcode, never the production key, and log in with that. After a
  rebuild, restart `wrangler dev`: it keeps the old asset list and serves pages
  with no CSS.

## Do these next

1. **`cs-fe-3-1` Goal viewport.** `/goals/{slug}` does not exist, so the goals
   console's open action and the Overview goal links have nowhere to go; the
   Overview links to `/runs?goal=<id>` until it lands.
2. **`4c72d164b9f5`** — `ApiError.message` is "[object Object]" for every
   `{ error: { code, message } }` envelope. Fix `lib/api.ts`, then drop
   `apiErrorMessage()` from `components/runs/run-detail-model.ts`.
3. **`f6159691a5bf`** — KPI sparkline tooltip shows the previous day west of
   UTC; use `utcDayLabel()` from `overview-sections.ts`.
4. **`cs-be-6-6` is `blocked`** in Maestro although PRs #12–#14 shipped work for
   it. 7 of the 8 live browser runs failed on model output ("content was not
   JSON", empty replies). Read its worklog before touching it.

## Earlier (2026-10-12, third)

- **Build check.** The M2 merge (`0ea4e27`) deployed. The later briefing-sync
  build (`2347c34`) failed on a Cloudflare API `504` during `wrangler deploy`,
  not on code; a manual rebuild passed.
- **`cs-fe-1-1` Overview KPI strip — done (PR #7).** `/` renders five tiles from
  `/api/dashboard/overview`, adapted from `chart-2`. Unknown values are an em
  dash with the server's reason; no badge without a baseline; the backlog's
  colour is inverted; only the runs tile has a sparkline (the one real daily
  series). `accept_rate` and a "target" are not drawn: FE-1 does not list the
  first, and the payload has no target.
- **`cs-fe-10-1` Runs queue — done (PR #8).** `/runs` is the run queue from
  `solution-agents-2`: grouped by status in triage order, attention filter
  (failed, running, quality < 50%, succeeded-but-unscored), agent and goal
  filters, URL state. `?q=` now searches `summary` too (closes the `cs-be-2-3`
  follow-up). `pnpm run verify:runs` is new: the real `listRuns()` query against
  real Postgres with rows seeded in a rolled-back transaction.
- **`5492781d5118` read-after-write health check — done (PR #9).**
  `postgres_read_after_write` primes, writes and reads back on three separate
  connections, using new table `health_probes` (migration `0002`, applied).
  Proven live: a throwaway Hyperdrive config with caching on turned it red 3 of
  3 times while the old roundtrip check stayed green. Throwaway deleted.
- **Filed `b0da7b27fea5`:** every page requests `http://localhost:4321/favicon.svg`
  because `astro.config.ts` falls back to localhost when `SITE` is unset.

The Overview island (`components/overview/overview-dashboard.tsx`) fetches the
payload once; each FE-1 section should take its slice from there, not refetch.

## Where this stands (as of the second session)

**M1 is complete.** M2 is in flight.

Live and verified on `https://core-shopping.hacolby.workers.dev` (version
`2af66f81`): `POST /api/health/run` returns `healthy`, 6 of 6 checks ok. Read
the caveat on that verdict under "Hyperdrive caches reads" below — it was green
throughout a real outage of correctness.

- **Postgres** `core_shopping` on `postgres-db.hacolby.app` (LXC 109, pgvector
  0.8.6), reached through Hyperdrive `a6e0ef9b307d4620993ba78d71e4efbf`.
  34 tables, migrations `0000` and `0001` applied. Two roles:
  `core_shopping_owner` (DDL, migrations from the LAN) and `core_shopping_app`
  (DML only — verified it cannot create tables). Passwords are in the tokens
  CLI, local only.
- **Auth** gates everything: pages redirect to `/login`, `/api` and `/mcp`
  answer 401 with `WWW-Authenticate`. Icons, `/_astro`, `/.well-known`, and
  `GET /api/ping` and `/api/health` are public. The ecosystem auth-check passes
  19 of 19 against this repo's copies.
- **Goals API, Runs API and the Overview endpoint** are live and exercised
  against real data. `accept_rate` is `null::real` for every goal until
  `cs-be-1-5` lands, which is why the em-dash rendering matters.
- **Frontend**: 52 ReUI block directories installed, template pages re-pathed
  under `/lab/*` with nothing deleted, 9 shopper routes rendering real empty
  states, radar icon set serving.

## Done in the second session

- **PR #5 merged** (`2d6f5e5`) — the Runs API, `cs-be-2-3`, now `done`.
  `GET /api/runs` and `/api/runs/{id}` are live and probed.
- **Goals console** (`cs-fe-2-1`, `done`) — `/goals` is the real console:
  Data Grid grouped by category, health tabs, the ReUI Filters builder, enable
  switches and a bulk pause/resume bar, all round-tripping through the API and
  the URL.
- **Overview contract and endpoint** (`cs-c-09`, `cs-be-2-9`, both `done`) —
  `GET /api/dashboard/overview` is live. **`cs-fe-1-1` is unblocked.**
- **Hyperdrive query caching disabled** — see the next section. This one
  changes the consistency model every query in this project inherits.

## Environment note before you start

The ReUI MCP (`mcp__reui__*`) may be down with `AUTH_HEADER_REJECTED`. It is not
a licence problem and not worth debugging again: `~/.claude.json` expands
`${REUI_LICENSE_KEY}` from the **app's own process environment**, and on a boot
where the app launches before any terminal it inherits an env without the key.
Measured 2026-10-10: boot 23:22:19, app 23:26:04, no key in any of the six app
processes while the launchd domain had it.

Fixed for future launches by `~/Library/LaunchAgents/com.colby.agent-env.plist`
(+ `~/.config/agent-env/setenv.sh`, which resolves from the tokens CLI at login
and writes no secret to disk; `~/.config/agent-env/setenv.log` records each run).
If reui is still down in your session, the app has not been relaunched since —
say so once and move on. It blocks nothing: every block FE-1 names is already
installed under `src/frontend/components/blocks/`, and the registry takes the
key over plain HTTPS if you need a new one.

## Hyperdrive caches reads, and it bit this project

**Measured and fixed 2026-10-10. Full record:
`docs/decisions/2026-10-10-hyperdrive-query-caching.md`.**

Hyperdrive caches read queries by default — `max_age` 60s — and **does not
invalidate on write**. Pausing a goal wrote correctly and then read back the
pre-pause state for about a minute. Query caching is now **disabled** on
configuration `a6e0ef9b307d4620993ba78d71e4efbf`.

Two things to carry rather than rediscover:

- **Only some reads were stale**, which is what made it hard to see. This
  schema's `stale` flag calls `now()`, so any query carrying it is uncacheable:
  a list's `items` stayed fresh while the same response's `total` (a plain
  count) was stale, and the healthy tab emptied correctly while the paused tab
  stayed empty. Three probe rounds went into suspecting the filter compiler.
- **Do not let caching back on.** The check from `5492781d5118` now exists and will turn `/api/health` red if it is. And if
  `stale` is ever precomputed into a column, those queries become cacheable and
  this returns on the surfaces where it is hardest to see.

## The loop that works, and why

Every delegated job so far was reviewed by **breaking it on purpose**, not by
reading it. That caught nothing in two PRs and would have caught a fake suite in
either. Keep doing it:

```bash
# in a throwaway worktree on the PR branch
git worktree add -q --detach "$SCRATCH/pr" origin/farm/codex-<id>
ln -s "$PWD/node_modules" "$SCRATCH/pr/node_modules"
```

Then break one function, confirm the self-check fails, restore, confirm green.

**An empty table means a live probe proves nothing.** `/api/runs` answered
200 with `[]` and `/api/dashboard/overview` answered 200 with zeros, because
`agent_runs` and `proposals` are empty — so neither probe touched the
aggregates, the window functions or the revision lateral. The move that works,
and that found three real bugs today, is to run the real SQL against real
Postgres with seeded rows **inside a transaction you roll back**:
`pnpm run verify:dashboard` is the worked example (30 assertions, all deltas
against a baseline measured in the same transaction, and it counts the seeded
rows afterwards to prove the rollback). No seed data ever reaches the repo or
survives the script.

**A deploy does not prove the thing works.** The Goals API typechecked, built
and deployed green while its revision diff listed `updated_at` on every change.
Only curling the deployed endpoint found it. Probe the live route after every
deploy.

**Right after a deploy, one request can still hit the old isolate.** A fix that
looks unapplied may simply be warm cache — check the built bundle before
concluding the code is wrong.

## Delegation

The farm is `claude-farm`, LXC 124 on the Proxmox box. It was **stopped**
mid-session once (jobs answered `destination_unavailable`) and later came back.
Check `farm.health` before dispatching. A job is held at `awaiting_approval`
until approved; Justin has standing approval for these, and a failure comes
back to Claude Code rather than being re-dispatched.

```bash
K=$(tokens show WORKER_API_KEY --value-only)
G=https://core-guardian.hacolby.workers.dev/api/toolkits
curl -s -X POST -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
  -d '{}' $G/farm.health
```

Give every job a **disjoint file list** and say what it must not touch.
`src/backend/api/index.ts` takes one import plus one `app.route` line per
router; that has been the only shared file so far and it has not collided.

## Verification commands

```bash
pnpm run typecheck && node scripts/ui-guard.mjs && pnpm run selfcheck   # 19 suite files
pnpm run verify:dashboard             # the Overview SQL against real Postgres
pnpm run verify:runs                  # the Runs queue SQL against real Postgres
bash scripts/check.sh                 # build into a throwaway dir

# `pnpm run deploy` needs the Cloudflare token in the environment or the D1
# migration step dies with "necessary to set a CLOUDFLARE_API_TOKEN".
export CLOUDFLARE_API_TOKEN="$(tokens show CLOUDFLARE_WRANGLER_API_TOKEN --value-only)"
export CLOUDFLARE_ACCOUNT_ID="$(tokens show CLOUDFLARE_ACCOUNT_ID --value-only)"
pnpm run deploy                       # build, D1 migrate, Postgres migrate, deploy
```

Local dev must start from `.claude/launch.json` (`astro-dev` or `worker-dev`),
never a bare `astro dev`: Hyperdrive needs a local connection string and the
Secret Store binding has no local value, so every page 500s without them. The
launch config reads both from the tokens CLI.

## Open decisions and known gaps

- `browseros-neo` MCP needs Justin to reconnect it via `/mcp`. The tunnel is
  up (`com.humuf.browseros` LaunchAgent, self-heals in ~4s) and BrowserOS on
  VM 130 is healthy with 24 tools. It is the right browser for any task needing
  his logged-in shopping accounts.
- The `browseros_vpc` health check in core-pve has never been forced red; its
  positive path is verified live.
- Two template proposals are filed in `colby-ecosystem`: the login open
  redirect (`4738dd054a7b`) and, unfiled, the `make-favicon.mjs` JSONC
  trailing-comma bug that silently hands two Workers the same palette.

## Rules this project has already paid for

- **No mock data, ever.** A screen shows real rows or a real empty state.
- `accept_rate` of `null` is not `0%`, and a never-run goal is not `stale`.
  Absence is not a verdict.
- Money is integer cents. Every quantity a person reads carries thousands
  separators.
- Selects go through `OptionSelect`/`FilterSelect`; a raw `<SelectValue>` paints
  the raw value on first paint and fails the build.
- A module a plain-Node self-check imports must avoid value imports that pull in
  unsupported TypeScript syntax — that is why `list-fetch.ts` is split from
  `list-query.ts`.
