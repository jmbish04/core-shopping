# core-shopping architecture: five open decisions

- **Status:** open
- **Date:** 2026-10-07
- **Maestro task:** `cs-decisions` (project `core-shopping`)
- **Plans:** contract `886087a5f809`, frontend `99c7a1c3a4d3`, backend `82ec217595de`

## What happened

The full core-shopping plan (3 plans, 21 epics, 124 tasks) is in colby-maestro. Five
choices gate the first infrastructure tasks (`cs-be-0-1`, `cs-be-0-4`, `cs-be-6-2`,
`cs-be-6-3`, `cs-fe-0-1`).

## Why it matters

Each one is either hard to undo later (where the database lives) or spends a scarce
shared resource (Secret Store slots: the store is near its 100 cap).

## The questions

1. **Where does the Postgres database live?**
   1. New database `core_shopping` on `postgres-db.hacolby.app` with pgvector. Same host already behind the maestro, tesla, core_resumes and licenses Hyperdrives. **(recommended)**
   2. A new Supabase project.
2. **Spotify credentials.** A Worker reads them, so per the secrets gate they need Secret Store slots.
   1. `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` in the store; refresh token encrypted in Postgres. **(recommended)**
   2. Skip Spotify; enter taste manually.
3. **What happens to D1?**
   1. Domain data only in Postgres; D1 keeps sessions and mirrored logs; template demo pages and tables removed. **(recommended)**
   2. Keep the template demo surfaces alongside.
4. **App shell.**
   1. Keep the installed `app-shell-2` (repo standard). **(recommended)**
   2. Switch to ReUI `app-shell-10` (AI agents console shell).
5. **Cloudflare Images upload path.**
   1. Let spike task `cs-be-6-3` decide (binding vs API token). **(recommended)**

## Default if no answer

The recommended option for each, applied when `cs-be-0-1` starts.

## Decision

_(pending)_
