# core-shopping — session handoff

Updated 2026-10-15 (fourth session, at hand-off). Everything below is merged
to `main` (PR #15, `a66e371`), built by Workers Builds, and probed live.
PRs #11–#14 (core-browser binding, browser runs, sightings) landed between the
third and fourth sessions; their record is in Maestro, not here.

**Start by checking the newest build**, not by assuming it:
`workers_builds_list` for `core-shopping`. A merge is not a deploy until the
build says so. The Builds REST API refuses every account token on this machine
(`12006 Invalid token`); the self-hosted Cloudflare API MCP
(`cloudflare-api-mcp.hacolby.workers.dev/mcp`, bearer `WORKER_API_KEY`) works,
and so does reading the `Workers Builds` check run on the commit in GitHub.

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
