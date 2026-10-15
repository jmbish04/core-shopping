/**
 * @fileoverview Run throughput and incidents (maestro cs-fe-1-2).
 *
 * Adapted from the ReUI Pro block `solution-agents-1`: its throughput chart
 * beside its incident timeline. Departures, each because the stock decoration
 * had no backing here:
 *
 * - the chart is runs per day STACKED BY OUTCOME (the block draws one line),
 *   because `runs_per_day` carries outcomes, and a stack shows failures as
 *   part of the volume rather than beside it. The x-axis is time, so the bars
 *   stand vertically;
 * - there is no period picker: the window is the overview's own `window_days`;
 * - incidents are real failed runs and stale goals, each linking to the thing
 *   it is about. Browser runs are marked, because core-browser failures (the
 *   VM not ready, a tripped cost guard) arrive as failed browser runs.
 *
 * The run queue preview is the footer link and the running count; the recent
 * runs themselves are in the activity feed below, not listed twice.
 */

"use client";

import { AlertTriangleIcon, ArrowRightIcon, CircleXIcon, GlobeIcon, ShieldCheckIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/shared";
import { relativeTime } from "@/lib/format";
import type { RunsPerDay } from "@/shared/contracts";

import { throughputTotals, utcDayLabel, type Incident } from "./overview-sections";

// Outcomes are states, not categories, so they take the state tokens the goal
// strips and badges use. chart-1..5 would have drawn "failed" green.
const CHART_CONFIG = {
  succeeded: { label: "Succeeded", color: "var(--success)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  abandoned: { label: "Abandoned", color: "var(--muted-foreground)" },
  running: { label: "Running", color: "var(--info)" },
} satisfies ChartConfig;

const OUTCOMES = ["succeeded", "failed", "abandoned", "running"] as const;


function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-xl leading-none font-semibold tabular-nums">
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

/** Runs per day, stacked by outcome. */
export function RunThroughput({ days, windowDays }: { days: RunsPerDay[]; windowDays: number }) {
  const totals = throughputTotals(days);
  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Run throughput</FrameTitle>
        <FrameDescription>Runs started per day over the last {windowDays} days, by outcome</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex grow flex-col gap-4">
        <div className="flex flex-wrap gap-6">
          <Figure label="Runs" value={totals.total} />
          <Figure label="Failed" value={totals.failed} />
          <Figure label="Browser runs" value={totals.browser} />
          <Figure label="MCP agent runs" value={totals.total - totals.browser} />
        </div>
        {totals.total === 0 ? (
          <EmptyState
            title="No runs in this window"
            description="A run is one agent session working a goal. The chart fills in as runs start."
          />
        ) : (
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[220px] w-full">
            {/* ui-guard-allow no-vertical-bar: x-axis is a daily time series */}
            <BarChart accessibilityLayer data={days} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={utcDayLabel} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelFormatter={(label) => utcDayLabel(String(label))} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {OUTCOMES.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="runs"
                  fill={`var(--color-${key})`}
                  radius={index === OUTCOMES.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </FramePanel>
      <FrameFooter className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm">
          {totals.running > 0
            ? `${totals.running.toLocaleString("en-US")} running now`
            : "Nothing running now"}
        </span>
        <Button type="button" variant="ghost" size="sm" render={<a href="/runs" />}>
          Open the run queue
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </FrameFooter>
    </Frame>
  );
}

/** Failed runs and stale goals, newest first. */
export function IncidentList({ incidents }: { incidents: Incident[] }) {
  const shown = incidents.slice(0, 4);
  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader>
        <FrameTitle>Incidents</FrameTitle>
        <FrameDescription>Failed runs and overdue goals</FrameDescription>
      </FrameHeader>
      <FramePanel className="flex grow flex-col">
        {shown.length === 0 ? (
          <EmptyState
            icon={<ShieldCheckIcon />}
            title="No incidents"
            description="No recent run failed and every goal is inside its cadence."
          />
        ) : (
          <Timeline>
            {shown.map((incident, index) => (
              <TimelineItem key={incident.id} step={index + 1} className="ms-8 pb-5 last:pb-0">
                <TimelineHeader>
                  <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-6" />
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <TimelineTitle className="min-w-0 truncate text-sm font-semibold">
                      <a href={incident.href} className="hover:text-primary transition-colors">
                        {incident.title}
                      </a>
                    </TimelineTitle>
                    <Badge variant={incident.kind === "failed_run" ? "destructive-light" : "warning-light"}>
                      {incident.kind === "failed_run" ? "Failed run" : "Overdue"}
                    </Badge>
                    {incident.browser ? (
                      <Badge variant="outline">
                        <GlobeIcon aria-hidden="true" />
                        Browser
                      </Badge>
                    ) : null}
                  </div>
                  <TimelineIndicator className="bg-muted text-muted-foreground flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-6">
                    {incident.kind === "failed_run" ? (
                      <CircleXIcon className="text-destructive size-3.5" />
                    ) : (
                      <AlertTriangleIcon className="text-warning size-3.5" />
                    )}
                  </TimelineIndicator>
                </TimelineHeader>
                <TimelineContent className="mt-1">
                  <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed break-words" title={incident.detail}>
                    {incident.detail}
                  </p>
                  {incident.at ? (
                    <span className="text-muted-foreground text-xs" title={incident.at}>
                      {relativeTime(incident.at)}
                    </span>
                  ) : null}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </FramePanel>
      {incidents.length > shown.length ? (
        <FrameFooter>
          <Button type="button" variant="ghost" size="sm" render={<a href="/runs?attention=failed" />}>
            All failed runs
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        </FrameFooter>
      ) : null}
    </Frame>
  );
}
