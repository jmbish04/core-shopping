/**
 * @fileoverview Activity feed and the needs-review call to action
 * (maestro cs-fe-1-4).
 *
 * Adapted from the ReUI Pro block `agent-activity-5` (an outcome ledger: one
 * row per item with its verdict word and its evidence). Here a row is a recent
 * run or a recent proposal, newest first, from `recent_runs` and
 * `recent_proposals`. The block's retry, discard and export actions are
 * removed: no API does those from here.
 *
 * The call to action is the header's primary button, "Review N items", into
 * `/review`. It shows only when something is queued; when nothing is, the
 * header says so instead of showing a button that leads to an empty queue.
 */

"use client";

import { ArrowRightIcon, InboxIcon, LightbulbIcon, PlayIcon } from "lucide-react";

import { Badge } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/shared";
import { relativeTime } from "@/lib/format";
import type { DashboardOverview } from "@/shared/contracts";

import { CLIENT_LABELS, formatScore } from "@/components/runs/run-rows";

import { buildActivity, reviewCtaLabel, type ActivityItem } from "./overview-sections";

const RUN_STATE = {
  succeeded: { word: "Succeeded", variant: "success-light" },
  failed: { word: "Failed", variant: "destructive-light" },
  abandoned: { word: "Abandoned", variant: "secondary" },
  running: { word: "Running", variant: "info-light" },
} as const;

function Row({ item }: { item: ActivityItem }) {
  if (item.kind === "run") {
    const { run } = item;
    const state = RUN_STATE[run.status];
    return (
      <li className="flex items-start gap-3 py-2.5">
        <PlayIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <a
            href={`/runs/${encodeURIComponent(run.id)}`}
            className="text-foreground hover:text-primary truncate text-sm font-medium transition-colors"
            title={run.summary || undefined}
          >
            {run.goal_title ?? (run.summary || "Run")}
          </a>
          <span className="text-muted-foreground truncate text-xs">
            {CLIENT_LABELS[run.client]} run
            {run.sightings_count > 0
              ? ` · ${run.sightings_count.toLocaleString("en-US")} ${run.sightings_count === 1 ? "finding" : "findings"}`
              : " · no findings"}
            {run.status === "failed" && run.error ? ` · ${run.error}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={state.variant}>{state.word}</Badge>
          <span className="text-muted-foreground text-xs" title={item.at}>
            {relativeTime(item.at)}
          </span>
        </div>
      </li>
    );
  }

  const { proposal } = item;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <LightbulbIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-sm font-medium">{proposal.title}</span>
        <span className="text-muted-foreground truncate text-xs">
          Proposal{proposal.goal_title ? ` for ${proposal.goal_title}` : ""} · match {formatScore(proposal.match_score)}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={proposal.status === "queued" ? "warning-light" : "outline"} className="capitalize">
          {proposal.status.replace(/_/g, " ")}
        </Badge>
        <span className="text-muted-foreground text-xs" title={item.at}>
          {relativeTime(item.at)}
        </span>
      </div>
    </li>
  );
}

/** Recent runs and proposals, with the review call to action on top. */
export function ActivityFeed({ overview }: { overview: DashboardOverview }) {
  const items = buildActivity(overview);
  const cta = reviewCtaLabel(overview.review_backlog);
  const { snoozed, expiring_soon: expiring } = overview.review_backlog;
  return (
    <Frame spacing="sm" className="w-full">
      <FrameHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col">
          <FrameTitle>Recent activity</FrameTitle>
          <FrameDescription>
            {cta
              ? expiring > 0
                ? `${expiring.toLocaleString("en-US")} expiring within 48 hours`
                : "Proposals are waiting for your verdict"
              : snoozed > 0
                ? `Nothing to review now · ${snoozed.toLocaleString("en-US")} snoozed`
                : "Nothing is waiting for review"}
          </FrameDescription>
        </div>
        {cta ? (
          <Button type="button" render={<a href="/review" />}>
            <InboxIcon className="size-4" aria-hidden="true" />
            {cta}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </FrameHeader>
      <FramePanel>
        {items.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Runs and the proposals they make show up here as they happen."
          />
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {items.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </ul>
        )}
      </FramePanel>
    </Frame>
  );
}
