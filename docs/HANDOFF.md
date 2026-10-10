# core-shopping — session handoff

Updated 2026-10-10 (second session). Branch
`claude/core-shopping-m2-continue-bfd492`, pushed, head `9cd9fca`. Nothing is
merged to `main` yet.

The previous branch, `claude/colby-maestro-shopping-plan-40e575`, ends at the
PR #5 merge (`2d6f5e5`) and is not being worked on. This branch continues from
it; the session that owned it confirmed it was finished before anything moved.

## Where this stands

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

## Done since the last handoff

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

## Do these next

1. **`cs-fe-1-1` Overview KPI strip.** Its contract and endpoint are both live
   and probed, and the payload already carries everything FE-1 asks for:
   KPI tiles with deltas, `runs_per_day` dense by outcome, per-goal last-20-run
   strips, the review backlog and recent proposals. Blocks are clear.
2. **`cs-fe-10-1` Runs queue**, which `GET /api/runs` now backs. One
   follow-up recorded on `cs-be-2-3` first: `?q=` searches `agentRuns.model`
   only, and `summary` belongs in `searchColumns` before that screen ships.
3. **`5492781d5118`** — a health check that commits a write and reads it back
   on a *separate request*. The existing `postgres_write_roundtrip` check was
   green for the whole hour the console was serving month-old state, because it
   writes and reads inside one transaction.

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
- **Do not let caching back on** without the check in `5492781d5118`. And if
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
cd /Volumes/Projects/workers/core-shopping/.claude/worktrees/core-shopping-m2-continue-bfd492
pnpm run typecheck && node scripts/ui-guard.mjs && pnpm run selfcheck   # 16 suites
pnpm run verify:dashboard             # the Overview SQL against real Postgres
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
- `cs-be-7-4` stays in review until a merge to `main` proves the CI path.
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
