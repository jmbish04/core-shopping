/**
 * @fileoverview `/runs/{id}` — one run's full story (maestro cs-fe-10-2).
 *
 * Adapted from the ReUI Pro block `solution-agents-3` (its run header, step
 * trace on a timeline, and facts panel), with the tool-call table from
 * `agent-activity-4` as a Data Grid. Everything is read from
 * `GET /api/runs/{id}`; nothing is demo data.
 *
 * Removed from the stock block because nothing backs them: owners, approve,
 * retry-step and pause actions, editable run settings, and screenshot thumbnails
 * (a run stores a screenshot key, but no route serves the image).
 *
 * A browser run gets a Refresh action: `POST /api/runs/{id}/sync` copies new
 * core-browser job events into the run, then the page reloads the run.
 * Surface is `frame`.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  BanIcon,
  CircleCheckIcon,
  CircleXIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react";
import { useTable, type ColumnDef } from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/shared";
import { apiGet, apiSend } from "@/lib/api";
import { duration, money, relativeTime } from "@/lib/format";

/** A run happens within minutes, so its times need the clock, not just the day. */
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
import { cn } from "@/lib/utils";
import type { McpToolCall, RunEvent } from "@/shared/contracts";

import {
  apiErrorMessage,
  browserJobId,
  buildTrace,
  formatOffset,
  syncSummary,
  type RunDetailView,
} from "./run-detail-model";
import { CLIENT_LABELS, formatScore, safeSessionUrl } from "./run-rows";

const STATUS_META = {
  running: { label: "Running", variant: "info-light", icon: LoaderCircleIcon },
  failed: { label: "Failed", variant: "destructive-light", icon: CircleXIcon },
  succeeded: { label: "Succeeded", variant: "success-light", icon: CircleCheckIcon },
  abandoned: { label: "Abandoned", variant: "secondary", icon: BanIcon },
} as const;

const LEVEL_VARIANT: Record<RunEvent["level"], "outline" | "info-light" | "warning-light" | "destructive-light"> = {
  debug: "outline",
  info: "info-light",
  warn: "warning-light",
  error: "destructive-light",
};

/** `browser.ai_decision` reads as "AI decision"; a kind without a dot reads as itself. */
function kindLabel(kind: string): string {
  const words = (kind.includes(".") ? kind.slice(kind.indexOf(".") + 1) : kind).replace(/_/g, " ");
  const text = words.replace(/\bai\b/gi, "AI");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground min-w-0 truncate text-right text-sm tabular-nums">{children}</dd>
    </div>
  );
}

const TOOL_COLUMNS: ColumnDef<DataGridFeatures, McpToolCall>[] = [
  {
    id: "tool",
    header: "Tool",
    size: 240,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="text-foreground truncate font-mono text-xs font-medium">{row.original.tool}</span>
        <span className="text-muted-foreground truncate text-xs">{row.original.operation}</span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    size: 100,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "ok" ? "success-light" : "destructive-light"}>
        {row.original.status === "ok" ? "OK" : "Error"}
      </Badge>
    ),
  },
  {
    id: "latency",
    header: "Latency",
    size: 90,
    cell: ({ row }) => <span className="text-muted-foreground text-sm tabular-nums">{duration(row.original.latency_ms)}</span>,
  },
  {
    id: "at",
    header: "At",
    size: 150,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm tabular-nums" title={row.original.at}>
        {stamp(row.original.at)}
      </span>
    ),
  },
  {
    id: "error",
    header: "Error",
    size: 260,
    cell: ({ row }) =>
      row.original.error ? (
        <span className="text-destructive truncate text-xs" title={row.original.error}>
          {row.original.error}
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      ),
  },
];

function ToolCallsFrame({ calls, isBrowser }: { calls: McpToolCall[]; isBrowser: boolean }) {
  const table = useTable({
    features: dataGridFeatures,
    data: calls,
    columns: TOOL_COLUMNS,
    getRowId: (row) => row.id,
  });
  return (
    <DataGrid
      table={table}
      recordCount={calls.length}
      tableLayout={{ dense: true, rowBorder: true, headerSticky: false, width: "fixed" }}
    >
      <Frame stacked spacing="sm" className="w-full">
        <FrameHeader>
          <FrameTitle>Tool calls</FrameTitle>
          <FrameDescription>
            {calls.length.toLocaleString("en-US")} MCP {calls.length === 1 ? "call" : "calls"}, oldest first
          </FrameDescription>
        </FrameHeader>
        <FramePanel className="p-0!">
          {calls.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<WrenchIcon />}
                title="No tool calls"
                description={
                  isBrowser
                    ? "A browser run works through core-browser, not MCP tools. Its steps are in the trace."
                    : "This run made no MCP tool calls."
                }
              />
            </div>
          ) : (
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          )}
        </FramePanel>
      </Frame>
    </DataGrid>
  );
}

/** The Run detail island. */
export function RunDetailPage({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    apiGet<RunDetailView>(`runs/${encodeURIComponent(runId)}`)
      .then((res) => {
        if (!cancelled) setRun(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          (e as { status?: number }).status === 404
            ? "No run has this id. It may have been deleted, or the link is wrong."
            : apiErrorMessage(e, "Could not load this run."),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, reloadToken]);

  const jobId = run ? browserJobId(run) : null;
  const trace = useMemo(() => (run ? buildTrace(run) : { steps: [], screenshots: 0 }), [run]);

  const refresh = useCallback(() => {
    setSyncing(true);
    setSyncError(null);
    setSyncNote(null);
    apiSend<{ events_added: number; run_status: string; job_status: string }>("POST", `runs/${runId}/sync`)
      .then((res) => {
        setSyncNote(syncSummary(res));
        setReloadToken((n) => n + 1);
      })
      .catch((e) => setSyncError(apiErrorMessage(e, "Could not reach core-browser.")))
      .finally(() => setSyncing(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col gap-4">
        <a href="/runs" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to the run queue
        </a>
        <ErrorState message={error ?? "Could not load this run."} onRetry={() => setReloadToken((n) => n + 1)} />
      </div>
    );
  }

  const meta = STATUS_META[run.status] ?? STATUS_META.abandoned;
  const StatusIcon = meta.icon;
  const session = safeSessionUrl(run.session_url);

  return (
    <div className="@container flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Back to the run queue"
            render={<a href="/runs" />}
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">Run queue /</span>
              <h2 className="text-foreground line-clamp-2 min-w-0 text-lg leading-tight font-semibold tracking-tight break-words">
                {run.summary || "No summary recorded"}
              </h2>
              <Badge variant={meta.variant}>
                <StatusIcon className={cn(run.status === "running" && "animate-spin")} aria-hidden="true" />
                {meta.label}
              </Badge>
            </div>
            <p className="text-muted-foreground min-w-0 truncate text-sm">
              {CLIENT_LABELS[run.client]} · {run.model} · started {relativeTime(run.started_at)}
              {run.duration_ms !== null ? ` · took ${duration(run.duration_ms)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {session ? (
            <Button type="button" variant="outline" size="sm" render={<a href={session} target="_blank" rel="noreferrer noopener" />}>
              <ExternalLinkIcon className="size-4" aria-hidden="true" />
              Agent session
            </Button>
          ) : null}
          {jobId ? (
            <Button type="button" size="sm" onClick={refresh} disabled={syncing}>
              <RefreshCwIcon className={cn("size-4", syncing && "animate-spin")} aria-hidden="true" />
              {syncing ? "Refreshing" : "Refresh from core-browser"}
            </Button>
          ) : null}
        </div>
      </header>

      {syncNote ? <p className="text-muted-foreground text-sm">{syncNote}</p> : null}
      {syncError ? <ErrorState message={syncError} /> : null}

      {run.error ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Why the run failed</AlertTitle>
          <AlertDescription className="break-words">{run.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 @4xl:col-span-2">
          <Frame stacked spacing="sm" className="w-full">
            <FrameHeader>
              <FrameTitle>Step trace</FrameTitle>
              <FrameDescription>
                {trace.steps.length.toLocaleString("en-US")} {trace.steps.length === 1 ? "step" : "steps"}
                {trace.screenshots > 0
                  ? ` · ${trace.screenshots.toLocaleString("en-US")} screenshots taken (not viewable here)`
                  : ""}
              </FrameDescription>
            </FrameHeader>
            <FramePanel>
              {trace.steps.length === 0 ? (
                <EmptyState
                  title="No steps recorded"
                  description={
                    jobId
                      ? "core-browser has not reported any steps yet. Refresh to copy new ones in."
                      : "The agent reported no events for this run."
                  }
                />
              ) : (
                <Timeline defaultValue={trace.steps.length}>
                  {trace.steps.map((step, index) => (
                    <TimelineItem key={step.event.id} step={index + 1}>
                      <TimelineHeader>
                        <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-6" />
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <TimelineTitle className="text-sm font-semibold">{kindLabel(step.event.kind)}</TimelineTitle>
                          <span className="text-muted-foreground text-xs tabular-nums" title={step.event.at}>
                            {formatOffset(step.offsetMs)}
                          </span>
                          {step.event.level !== "info" ? (
                            <Badge variant={LEVEL_VARIANT[step.event.level]}>{step.event.level}</Badge>
                          ) : null}
                          {step.model ? <Badge variant="outline">{step.model}</Badge> : null}
                        </div>
                        <TimelineIndicator
                          className={cn(
                            "bg-muted text-muted-foreground flex size-5 items-center justify-center border-none",
                            step.event.level === "error" && "bg-destructive/10 text-destructive dark:bg-destructive/20",
                          )}
                        >
                          {step.event.level === "error" ? <CircleXIcon className="size-3" /> : <CircleCheckIcon className="size-3" />}
                        </TimelineIndicator>
                      </TimelineHeader>
                      <TimelineContent className="mt-1">
                        <p
                          className={cn(
                            "text-sm leading-5 break-words",
                            step.event.level === "error" ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {step.event.message}
                        </p>
                        {step.url ? (
                          <a
                            href={step.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-muted-foreground hover:text-foreground mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs transition-colors"
                          >
                            <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{step.url}</span>
                          </a>
                        ) : null}
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
            </FramePanel>
          </Frame>

          <ToolCallsFrame calls={run.tool_calls} isBrowser={run.client === "browser"} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Frame stacked spacing="sm" className="w-full">
            <FrameHeader>
              <FrameTitle>Run facts</FrameTitle>
            </FrameHeader>
            <FramePanel>
              <dl className="divide-border divide-y">
                <Fact label="Started">
                  <span title={run.started_at}>{stamp(run.started_at)}</span>
                </Fact>
                <Fact label="Finished">
                  {run.finished_at ? <span title={run.finished_at}>{stamp(run.finished_at)}</span> : "—"}
                </Fact>
                <Fact label="Duration">{duration(run.duration_ms)}</Fact>
                <Fact label="Quality">{formatScore(run.quality_score)}</Fact>
                <Fact label="Uniqueness">{formatScore(run.uniqueness_score)}</Fact>
                <Fact label="Sightings">{run.sightings_count.toLocaleString("en-US")}</Fact>
                <Fact label="New entities">{run.new_entities_count.toLocaleString("en-US")}</Fact>
                <Fact label="Proposals">{run.proposals_count.toLocaleString("en-US")}</Fact>
                {jobId ? (
                  <Fact label="core-browser job">
                    <span className="font-mono text-xs" title={jobId}>
                      {jobId.slice(0, 8)}
                    </span>
                  </Fact>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                <span className="text-muted-foreground text-xs">
                  {run.goals.length === 1 ? "Goal" : `Goals (${run.goals.length.toLocaleString("en-US")})`}
                </span>
                {run.goals.length === 0 ? (
                  <span className="text-muted-foreground text-sm">Not tied to a goal</span>
                ) : (
                  run.goals.map((goal) => (
                    <a
                      key={goal.id}
                      href={`/runs?goal=${encodeURIComponent(goal.id)}`}
                      title="Other runs for this goal"
                      className="text-foreground hover:text-primary truncate text-sm transition-colors"
                    >
                      {goal.title}
                    </a>
                  ))
                )}
              </div>
            </FramePanel>
          </Frame>

          <Frame stacked spacing="sm" className="w-full">
            <FrameHeader>
              <FrameTitle>Sightings</FrameTitle>
              <FrameDescription>What this run found, oldest first</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {run.sightings.length === 0 ? (
                <p className="text-muted-foreground text-sm">This run recorded no sightings.</p>
              ) : (
                <ul className="divide-border flex flex-col divide-y">
                  {run.sightings.map((s) => {
                    const href = safeSessionUrl(s.url);
                    return (
                      <li key={s.id} className="flex flex-col gap-1 py-2">
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer noopener" className="text-foreground hover:text-primary text-sm font-medium transition-colors">
                            {s.title}
                          </a>
                        ) : (
                          <span className="text-foreground text-sm font-medium">{s.title}</span>
                        )}
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs tabular-nums">
                          <span>{money(s.price_cents, s.currency ?? "USD")}</span>
                          <span>score {formatScore(s.agent_score)}</span>
                          <Badge variant={s.is_resighting ? "outline" : "success-light"}>
                            {s.is_resighting ? "Seen before" : "New"}
                          </Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FramePanel>
          </Frame>

          <Frame stacked spacing="sm" className="w-full">
            <FrameHeader>
              <FrameTitle>Proposals</FrameTitle>
              <FrameDescription>What this run put forward for review</FrameDescription>
            </FrameHeader>
            <FramePanel>
              {run.proposals.length === 0 ? (
                <p className="text-muted-foreground text-sm">This run made no proposals.</p>
              ) : (
                <ul className="divide-border flex flex-col divide-y">
                  {run.proposals.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 py-2">
                      <span className="text-foreground text-sm font-medium">{p.title}</span>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs tabular-nums">
                        <Badge variant="outline" className="capitalize">{p.status.replace(/_/g, " ")}</Badge>
                        <span className="capitalize">{p.kind}</span>
                        <span>match {formatScore(p.match_score)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FramePanel>
          </Frame>
        </div>
      </div>
    </div>
  );
}
