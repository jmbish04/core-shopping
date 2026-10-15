/**
 * @fileoverview Per-goal run health strips (maestro cs-fe-1-3).
 *
 * Adapted from the ReUI Pro block `chart-34` (one row per job, its last runs as
 * outcome bars, a hover card per bar). Here a row is a goal and a bar is one of
 * its last {@link DASHBOARD_STRIP_RUNS} runs, oldest first, from `goal_strips`.
 *
 * Departures from the stock block:
 * - every bar is the same height. The block scales bars by duration; a running
 *   run has no duration, and scaling by it would draw a live run as a stub;
 * - a bar is a link to that run, and the hover card carries the run's summary
 *   and its findings count, both from the payload;
 * - a goal that never ran shows "No runs yet". It is not a goal in trouble, and
 *   it is not drawn as one.
 */

"use client";

import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { EmptyState } from "@/components/common/shared";
import { duration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DASHBOARD_STRIP_RUNS, type GoalRunStrip } from "@/shared/contracts";

import { stripSuccessRate } from "./overview-sections";

type StripRun = GoalRunStrip["runs"][number];

const STATUS = {
  succeeded: { label: "Succeeded", bar: "bg-success/50", badge: "success-light" },
  failed: { label: "Failed", bar: "bg-destructive", badge: "destructive-light" },
  abandoned: { label: "Abandoned", bar: "bg-muted-foreground/40", badge: "secondary" },
  running: { label: "Running", bar: "bg-info/60", badge: "info-light" },
} as const;

function RunBar({ run }: { run: StripRun }) {
  const meta = STATUS[run.status];
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <a
            href={`/runs/${encodeURIComponent(run.id)}`}
            aria-label={`${meta.label} run, ${relativeTime(run.started_at)}`}
            className="focus-visible:outline-ring/50 flex h-full min-w-0 items-end px-0.5 transition-opacity duration-150 group-hover/strip:opacity-40 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2"
          />
        }
      >
        <span aria-hidden="true" className={cn("h-full w-full rounded-[2px]", meta.bar)} />
      </HoverCardTrigger>
      <HoverCardContent className="flex w-72 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium" title={run.started_at}>
            {relativeTime(run.started_at)}
          </span>
          <Badge variant={meta.badge}>{meta.label}</Badge>
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs break-words">
          {run.summary || "No summary recorded."}
        </p>
        <dl className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="tabular-nums">{run.duration_ms === null ? "Still running" : duration(run.duration_ms)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Findings</dt>
            <dd className="tabular-nums">{run.sightings_count.toLocaleString("en-US")}</dd>
          </div>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

function StripRow({ strip }: { strip: GoalRunStrip }) {
  const rate = stripSuccessRate(strip);
  return (
    <div className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_7rem] md:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <a
          href={`/runs?goal=${encodeURIComponent(strip.goal_id)}`}
          className="text-foreground hover:text-primary truncate text-sm font-medium transition-colors"
          title={`Runs for ${strip.title}`}
        >
          {strip.title}
        </a>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {strip.category}
          </Badge>
          {strip.stale ? <Badge variant="warning-light">Overdue</Badge> : null}
        </div>
      </div>

      {strip.runs.length === 0 ? (
        <span className="text-muted-foreground text-sm">No runs yet</span>
      ) : (
        <div
          role="group"
          aria-label={`${strip.title}: last ${strip.runs.length} runs, oldest first`}
          className="group/strip -mx-0.5 grid h-8"
          style={{ gridTemplateColumns: `repeat(${DASHBOARD_STRIP_RUNS}, minmax(0, 1fr))` }}
        >
          {strip.runs.map((run, index) => (
            <div
              key={run.id}
              className="h-full min-w-0"
              // A shorter history sits against the newest (right) end.
              style={index === 0 ? { gridColumnStart: DASHBOARD_STRIP_RUNS - strip.runs.length + 1 } : undefined}
            >
              <RunBar run={run} />
            </div>
          ))}
        </div>
      )}

      <div className="text-muted-foreground flex flex-col text-xs tabular-nums md:items-end">
        <span>
          {rate === null ? "—" : `${Math.round(rate * 100)}%`} succeeded
        </span>
        <span>
          {strip.runs_total.toLocaleString("en-US")} {strip.runs_total === 1 ? "run" : "runs"} total
        </span>
      </div>
    </div>
  );
}

/** One row per goal, its last runs as outcome bars. */
export function GoalStrips({ strips }: { strips: GoalRunStrip[] }) {
  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Goal run health</FrameTitle>
        <FrameDescription>
          Each goal's last {DASHBOARD_STRIP_RUNS} runs, oldest on the left. Hover a bar for the run; click to open it.
        </FrameDescription>
      </FrameHeader>
      <FramePanel>
        {strips.length === 0 ? (
          <EmptyState
            title="No goals yet"
            description="A goal is something to shop for. Its runs line up here once it has some."
            action={
              <a href="/goals" className="text-primary inline-flex items-center gap-1 text-sm">
                Open goals
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </a>
            }
          />
        ) : (
          <div className="divide-border flex flex-col divide-y">
            {strips.map((strip) => (
              <StripRow key={strip.goal_id} strip={strip} />
            ))}
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}
