# `venue_stances` is named for venues and has to hold countries

- **Date:** 2026-10-25
- **Status:** open — needs Justin's call, default stated below
- **Author:** Claude Code (session: config layer and the four spec gaps)
- **Affects:** `venue_stances` in `src/backend/pg/schemas/config/taste.ts`, PR #19

## What happened

`cs-be-1-6` names twelve config tables, one of them `venue_stances`. Building
it, the clearest stance in the whole brief turned out not to be about a venue:

> japan may be played out at this piont given my husband has been twice
> recently and i have been the 2nd leg with him

That is a stance about a **country**. The brief has no stance about a concert
venue at all. The other stance-shaped lines are about hotel brands, which have
their own table.

So the table either holds only venues, in which case the brief's own example
has nowhere to live, or it holds places generally under a name that says
otherwise.

## What I built, and why it is not the decision

`venue_stances` as `cs-be-1-6` names it, with an explicit `place_kind` column —
`venue | city | destination | country | region` — rather than leaving the kind
implied by the table name. It keys on a place **name** with an optional
`entity_id`, because "Japan is played out" is stated months before any
`destination` entity exists, so requiring a foreign key would make the row
unwritable at the only moment it is written.

That works today. What it leaves is a table whose name describes a fifth of
what it holds, which is the kind of thing that misleads the next person reading
the schema rather than the code.

I did not rename it, because the table name is in `cs-be-1-6`'s own
description, and a rename is a product decision about vocabulary rather than a
schema one.

## Why it matters to you

Only for readability and for what a settings page is called. Nothing is broken
either way: the data model is the same, `place_kind` already carries the truth,
and both readings store Japan correctly. The cost of leaving it is that
`venue_stances` is a slightly dishonest name; the cost of renaming it is one
migration plus an edit to the task description.

## The question

Should `venue_stances` be renamed `place_stances`?

## Options

1. **Rename to `place_stances`** (recommended). One migration — the table is
   empty, so it is a pure rename with no data move — plus the task description
   and the `/docs/model` entry. The name then matches what every row in it
   actually is, and the settings page can be called "Places" rather than
   "Venues" while listing countries.
2. **Leave it as `venue_stances`.** Nothing to do. `place_kind` carries the
   meaning and the schema comment explains the mismatch. Cheapest, and the task
   description stays accurate.
3. **Split it**: `venue_stances` for venues, `destination_stances` for places.
   I do not recommend this — it is two tables for one shape, and a stance about
   Tokyo would have to pick a side.

## What I will do if you say nothing

Leave it as `venue_stances` (option 2). It is the cheapest and it is what the
task names; the mismatch is documented in the schema file and on `/docs/model`,
so nobody is misled by the name alone.

## Decision

_(unanswered)_
