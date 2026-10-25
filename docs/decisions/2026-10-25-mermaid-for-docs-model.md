# Whether to add `mermaid` so `/docs/model`'s ER diagram renders

- **Date:** 2026-10-25
- **Status:** open — needs Justin's call, default stated below
- **Author:** Claude Code (session: config layer and the four spec gaps)
- **Affects:** `src/frontend/pages/docs/model.astro`

## What happened

`/docs/model` carries the domain model's ER diagram as **Mermaid source in a
`CodeBlock`**, not as a rendered diagram. The session that built `/docs`
(2026-10-17) deliberately did not add a `mermaid` package for one page, and
recorded that in `cs-gap-docs-page`'s worklog.

This session grew that diagram substantially. PR #19 added the configuration
relationships and PRs #21 to #24 added the wishlist, the occasion calendar, the
idea bank and the config snapshot. The diagram is now **49 relationship lines
across 30-odd tables**, where it was 29 lines when the decision was taken.

Reading 49 lines of Mermaid source to understand how the tables connect is a
different proposition from reading 29. The page's own description says it shows
"how they connect", and as source it mostly does not.

## Why it matters to you

`/docs/model` is the page a new session or a new person reads to learn the
schema. As source it is a wall of text they have to compile in their head; the
repo-wide briefings say a data change owes a Mermaid diagram precisely because
the picture is the point.

Against that: `mermaid` is a browser dependency of roughly 2.8 MB minified, for
one page, on a Worker whose startup CPU budget this project has not yet had to
think about. It would be the largest single frontend dependency in the repo.

## The question

Should `/docs/model` render its ER diagram, and if so how?

## Options

1. **Render it at BUILD time, not in the browser** (recommended). Generate the
   SVG during `astro build` and inline it, so the page ships a picture and the
   browser downloads no Mermaid at all. Costs a dev dependency and a build
   step; costs the runtime bundle nothing. This is the option the earlier
   decision did not consider — it rejected "a browser dependency for one page",
   which is option 2, not this one.
2. **Add `mermaid` as a client dependency** and render on the client, lazily
   behind `client:visible`. Simplest to write, and the diagram stays live if
   someone edits the source. Adds ~2.8 MB to what the page can pull.
3. **Leave it as source.** Nothing to do. The diagram stays correct and stays
   unreadable at this size. Keeps the earlier decision as taken.

## What I will do if you say nothing

Leave it as source (option 3), which keeps the 2026-10-17 decision standing. I
did not want to reverse another session's recorded decision without asking,
which is why this is a question rather than a commit.

## Decision

_(unanswered)_
