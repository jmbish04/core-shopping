# core-shopping — session handoff

Written 2026-10-08. Branch `claude/colby-maestro-shopping-plan-40e575`, pushed,
head `b984692`. Nothing is merged to `main` yet.

## Where this stands

**M1 is complete.** M2 is in flight.

Live and verified on `https://core-shopping.hacolby.workers.dev` (version
`1d950df9`): `POST /api/health/run` returns `healthy`, 6 of 6 checks ok.

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
- **Goals API** is live and exercised against real data (see below).
- **Frontend**: 52 ReUI block directories installed, template pages re-pathed
  under `/lab/*` with nothing deleted, 9 shopper routes rendering real empty
  states, radar icon set serving.

## Do these first

1. **Review and merge PR #5** — the Runs API (`cs-be-2-3`, farm job
   `b7deecc4`, succeeded). Review it the way the last two were reviewed: run
   `pnpm run typecheck`, `pnpm run selfcheck`, `node scripts/ui-guard.mjs`, then
   **plant a regression in one of its pure helpers and confirm the self-check
   goes red**. A suite nobody has seen fail has not been seen to work. Then
   merge, deploy, and curl `/api/runs` on the deployed Worker.
2. **Build the Goals console yourself** (`cs-fe-2-1`, status `todo`). Farm job
   `4c61fcc4` FAILED with "No commits between …" — codex produced nothing, so
   there is no PR. Justin's standing instruction is that a failed farm job comes
   back to Claude Code. The full spec is in the task's worklog and in the
   frontend plan; the API it needs is live.

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
cd /Volumes/Projects/workers/core-shopping/.claude/worktrees/colby-maestro-shopping-plan-40e575
pnpm run typecheck && node scripts/ui-guard.mjs && pnpm run selfcheck
bash scripts/check.sh                 # build into a throwaway dir
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
