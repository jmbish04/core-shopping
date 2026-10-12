/**
 * @fileoverview The Overview KPI strip (maestro cs-fe-1-1).
 *
 * Adapted from the ReUI Pro block `chart-2` (a framed row of metric cards,
 * each with a delta badge and a corner sparkline). Two departures from the
 * stock block, both because its decoration had no real backing here:
 *
 * - the corner sparkline is drawn only on the runs tile, the one KPI with a
 *   dense daily series behind it (`runs_per_day`); and
 * - a tile with no comparison draws no badge, rather than a "0%" one.
 *
 * All formatting decisions live in `kpi-tiles.ts`, which the self-check pins.
 * Surface is `frame` — one surface for the screen.
 */

"use client";

import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

import { Badge, type BadgeProps } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { STRIP_KPI_IDS, type DeltaTone, type KpiTile, type SparkPoint } from "./kpi-tiles";

const TONE_VARIANT: Record<DeltaTone, BadgeProps["variant"]> = {
  good: "success-light",
  bad: "destructive-light",
  flat: "secondary",
};

const SPARK_CONFIG: ChartConfig = {
  value: { label: "Runs", color: "var(--chart-1)" },
};

/** The sparkline's hover readout: the day and its run count. */
function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: SparkPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="bg-popover rounded-lg border px-2 py-1.5 text-[11px] shadow-sm">
      <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase">
        {shortDate(`${point.date}T00:00:00Z`)}
      </div>
      <div className="text-popover-foreground font-semibold tabular-nums">
        {point.value.toLocaleString("en-US")} {point.value === 1 ? "run" : "runs"}
      </div>
    </div>
  );
}

/** The corner sparkline, drawn only for a tile that has a real series. */
function Sparkline({ points }: { points: SparkPoint[] }) {
  return (
    <ChartContainer
      config={SPARK_CONFIG}
      className="absolute top-5 right-4 z-10 aspect-auto h-8 w-[76px]"
      initialDimension={{ width: 76, height: 32 }}
    >
      <LineChart accessibilityLayer data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <XAxis dataKey="date" hide />
        {/* A zero-run week sits on the floor of the box, not at its top. */}
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
        <ChartTooltip
          allowEscapeViewBox={{ x: true, y: true }}
          content={<SparkTooltip />}
          cursor={false}
          position={{ x: -70, y: 32 }}
          wrapperStyle={{ zIndex: 30 }}
        />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 2.5, fill: "var(--background)", stroke: "var(--color-value)", strokeWidth: 1.5 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

/** One tile's border classes, so the grid reads as one framed strip at every width. */
function cellBorders(index: number, total: number): string {
  const isLast = index === total - 1;
  return cn(
    "border-border/60",
    !isLast && "border-b",
    index % 2 === 0 && !isLast && "@2xl:border-r",
    index >= total - (total % 2 === 0 ? 2 : 1) ? "@2xl:border-b-0" : "@2xl:border-b",
    "@5xl:border-b-0",
    isLast ? "@5xl:border-r-0" : "@5xl:border-r",
  );
}

function DeltaBadge({ delta }: { delta: NonNullable<KpiTile["delta"]> }) {
  const Icon = delta.direction === "up" ? TrendingUpIcon : delta.direction === "down" ? TrendingDownIcon : MinusIcon;
  return (
    <Badge size="sm" variant={TONE_VARIANT[delta.tone]} className="border-0">
      <Icon aria-hidden="true" className="size-3.5" />
      <span>{delta.text}</span>
    </Badge>
  );
}

function KpiCell({ tile, index, total }: { tile: KpiTile; index: number; total: number }) {
  return (
    <div className={cn("relative min-h-[102px] overflow-hidden p-4", cellBorders(index, total))}>
      {tile.sparkline ? <Sparkline points={tile.sparkline} /> : null}

      <div className="flex min-h-[70px] flex-col justify-between gap-4">
        <div className={cn("flex flex-col gap-0.5", tile.sparkline && "pr-24")}>
          <div className="text-xl font-semibold tabular-nums" title={tile.unavailableReason ?? undefined}>
            {tile.value}
          </div>
          <h3 className="text-muted-foreground text-xs leading-none">{tile.title}</h3>
          {tile.unavailableReason ? (
            <p className="text-muted-foreground text-xs">{tile.unavailableReason}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          {tile.secondary ? (
            <div className="text-xs" title={tile.secondary.reason ?? undefined}>
              <span className="text-muted-foreground">{tile.secondary.label}: </span>
              <span className="font-medium tabular-nums">{tile.secondary.value}</span>
              {tile.secondary.reason ? (
                <span className="text-muted-foreground"> · {tile.secondary.reason}</span>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            {tile.delta ? <DeltaBadge delta={tile.delta} /> : null}
            <span className="text-muted-foreground text-xs">
              {tile.delta ? tile.comparison : "no comparison yet"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The framed row of KPI tiles.
 *
 * @param props.tiles - From `buildKpiTiles`; null while the payload loads.
 */
export function KpiStrip({ tiles }: { tiles: KpiTile[] | null }) {
  const total = tiles?.length ?? STRIP_KPI_IDS.length;
  return (
    <div className="@container w-full">
      <Frame className="w-full">
        <FramePanel className="p-0!">
          <div className="grid overflow-hidden @2xl:grid-cols-2 @5xl:grid-cols-5">
            {tiles
              ? tiles.map((tile, index) => <KpiCell key={tile.id} tile={tile} index={index} total={total} />)
              : STRIP_KPI_IDS.map((id, index) => (
                  <div key={id} className={cn("flex min-h-[102px] flex-col gap-3 p-4", cellBorders(index, total))}>
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
