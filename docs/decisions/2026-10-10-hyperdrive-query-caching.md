# Hyperdrive query caching made the Goals console lie about its own writes

- **Date:** 2026-10-10
- **Status:** decided and applied — noting it, no action needed from Justin
- **Author:** Claude Code (session: core-shopping M2 continuation)
- **Affects:** every read in core-shopping that goes through Hyperdrive

## What happened

Pausing a goal from the new Goals console wrote to Postgres correctly and then
read back the **pre-pause** state for about a minute. The switch would flip,
the row would refetch, and the goal would look active again.

Hyperdrive caches read queries by default — `max_age` 60 seconds,
`stale_while_revalidate` 15 seconds — and **does not invalidate that cache when
the application writes**. The Hyperdrive binding in `wrangler.jsonc` carried no
caching options, so core-shopping had the defaults.

Measured on the deployed Worker (version `3f6423d9`), against the one real goal
`concerts-and-comedy-in-sf`:

| | Postgres | `GET /api/goals/{id}` |
| --- | --- | --- |
| before the pause | `active` rev 12 | `active` rev 10 |
| `POST /pause` → 200 | `paused` rev 13 | `active` rev 10 |
| t+2s | `paused` rev 13 | `active` rev 10 |
| t+15s | `paused` rev 13 | `active` rev 10 |
| **t+36s** | `paused` rev 13 | **`paused` rev 13** |

Cache-busting the URL changed nothing, and no `cf-cache-status` header was
present: the cache is Hyperdrive's, keyed on the SQL, not Cloudflare's edge
cache keyed on the URL.

## Why only some reads were stale, which is what made it confusing

The defect was invisible on exactly the reads that happen to be uncacheable.
Hyperdrive treats a query that references a volatile function as uncacheable,
and this schema's `stale` flag is
`coalesce((last_run_at + cadence) < now(), false)`:

| Read | Contains `now()`? | Behaviour |
| --- | --- | --- |
| `GET /api/goals` — the `items` array | yes, `stale` is in the selection | always fresh |
| the same request's `total` | no — the count query is `count(*)` + the WHERE | **stale** |
| a filter on `stale` (the healthy and stale tabs) | yes, in the WHERE | always fresh |
| a filter on `status` alone (the paused tab) | no | **stale** |
| `GET /api/goals/{id}` — `loadGoal` selects plain columns | no | **stale** |

So the list looked right while its own total disagreed with it, and the paused
tab stayed empty while the healthy tab correctly emptied. Two instruments
pointed at the same fact and only one of them could fail.

## Why it matters

Every write surface in this app is read-after-write by nature: pause a goal,
approve a proposal, record a verdict, file a lesson. The user's next action is
always a read of what they just changed. A 60-second window where the UI shows
the old answer reads as "the button did not work", and the obvious next move —
clicking it again — writes a second revision.

It also defeats verification. `POST /pause` answered 200, the revision trail
recorded `paused` then `resumed`, and the endpoint still reported `active`. A
check that reads through a cached query cannot see the write it is checking.

## The decision

**Query caching is disabled on the `core-shopping` Hyperdrive configuration**
(`a6e0ef9b307d4620993ba78d71e4efbf`):

```bash
npx wrangler hyperdrive update a6e0ef9b307d4620993ba78d71e4efbf --caching-disabled
```

Cloudflare's own guidance is to disable caching everywhere when most reads must
be fresh, and to keep it with a second cache-disabled binding when only some
must. Here it is "most": this is a single-operator console over one small
database, and connection pooling — the reason Hyperdrive is in front of
Postgres at all — is unaffected.

The options that were not taken, and why:

1. **A second cache-disabled binding, routed per query** (Cloudflare's
   recommendation for mixed workloads). Correct for a read-heavy public app;
   here it would mean classifying every query in the repo, and getting one
   wrong reintroduces exactly this bug on exactly the paths where it is hardest
   to see.
2. **Keep caching, lower `max_age` to a few seconds.** Shrinks the window
   rather than closing it, and a stale answer is still a wrong answer at the
   moment the user is looking.
3. **Disable it everywhere** — taken. Reversible with
   `--caching-enabled`/`--max-age` the moment read volume makes caching worth
   having, and at that point option 1 becomes the right shape.

Billing: Hyperdrive bills nothing for either setting, and this removes no
allowance. More queries reach Postgres on LXC 109, which at one goal and zero
runs is not a load question.

## Follow-ups filed, not fixed here

- The `stale` expression is what accidentally kept the list fresh. Nothing
  should depend on that: if `stale` is ever precomputed into a column, those
  reads become cacheable and the bug returns on a surface that has looked
  correct for months. Caching stays off rather than resting on a `now()` that
  happens to be in the query.
- `/api/health` has a `postgres_write_roundtrip` check that inserts a goal and
  reads it back through Hyperdrive, and it was green throughout. It could not
  have caught this: the insert and the read happen inside **one transaction**
  that is then rolled back, so they share a session and never consult the query
  cache. Catching a stale cached read needs a **committed** write followed by a
  **separate request's** read. Verdict `healthy`, 6 of 6 ok, while the console
  was showing month-old state — the instrument was fine and the thing it
  handled was not what happened.

## Decision

Applied 2026-10-10 by the session that found it, under the standing
authorization for Cloudflare configuration. Recorded here because it changes
the consistency model every future query in this project inherits, which is not
something a later session should have to rediscover from a flaky switch.
