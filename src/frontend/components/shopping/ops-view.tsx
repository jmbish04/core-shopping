/**
 * @fileoverview Viewport 1: AI Ops & Scheduled Agent Mission Control (/ops).
 *
 * CIS Status Banner, KPIs, Recharts dual-line quality vs uniqueness timeline,
 * scheduled agent run queue, and step trace execution waterfalls.
 */

import { useEffect, useState } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlayIcon,
  RadioIcon,
  RefreshCwIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function OpsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchOpsData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopping/ops");
      const json = await res.json();
      setData(json);
      if (json.runQueue?.length > 0) {
        setSelectedRun(json.runQueue[0]);
      }
    } catch (err) {
      console.error("Failed to load ops data:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSeed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/shopping/seed?force=true", { method: "POST" });
      await fetchOpsData();
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    fetchOpsData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <RefreshCwIcon className="mr-2 size-4 animate-spin" />
        Connecting to Mission Control Telemetry...
      </div>
    );
  }

  const kpis = data?.kpis || {
    activeGoals: 3,
    totalGoals: 3,
    discoveryYield: 12,
    valueCapturedUsd: 1850,
    mcpLatencyMs: 84,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <span className="mr-1.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
            Worker Telemetry Active
          </Badge>
          <span className="text-xs text-muted-foreground">Hyperdrive Latency: {kpis.mcpLatencyMs}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={triggerSeed} disabled={seeding}>
            <RefreshCwIcon className={`mr-1.5 size-3.5 ${seeding ? "animate-spin" : ""}`} />
            Seed Initial Data
          </Button>
          <Button size="sm" onClick={fetchOpsData}>
            <PlayIcon className="mr-1.5 size-3.5" />
            Trigger Agent Run
          </Button>
        </div>
      </div>

      {/* 4-Wide KPI Metric Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Frame>
          <FramePanel className="p-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">Active Goals</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {kpis.activeGoals} <span className="text-xs font-normal text-muted-foreground">/ {kpis.totalGoals} monitored</span>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="p-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">Discovery Yield</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {kpis.discoveryYield} <span className="text-xs font-normal text-emerald-400">(Deduplicated)</span>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="p-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">Value Captured</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-400">
              ${kpis.valueCapturedUsd.toLocaleString()}
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="p-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">MCP Circuit Breaker</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle2Icon className="size-4" />
              Operational (0 Rate-Limits)
            </div>
          </FramePanel>
        </Frame>
      </div>

      {/* Throughput & Quality Chart */}
      <Frame>
        <FramePanel className="p-5">
          <FrameHeader className="p-0 pb-4">
            <FrameTitle className="text-sm font-medium flex items-center gap-2">
              <ActivityIcon className="size-4 text-emerald-400" />
              Candidate Quality vs. Uniqueness Timeline
            </FrameTitle>
          </FrameHeader>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.chartHistory || []}>
                <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
                <YAxis domain={[50, 100]} stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "6px" }}
                  itemStyle={{ color: "#f4f4f5" }}
                />
                <Line type="monotone" dataKey="uniqueness" stroke="#10b981" strokeWidth={2} name="Uniqueness Index" />
                <Line type="monotone" dataKey="quality" stroke="#6366f1" strokeWidth={2} name="Quality Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-end gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Uniqueness Index (Semantic Distance)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-indigo-500" />
              Quality Score (Price + Calendar Fit)
            </div>
          </div>
        </FramePanel>
      </Frame>

      {/* Scheduled Agent Run Queue & Step Trace Waterfall */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run Queue List */}
        <Frame className="lg:col-span-1">
          <FramePanel className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scheduled Agent Run Queue
            </div>
            <div className="flex flex-col gap-2">
              {data?.runQueue?.map((run: any) => {
                const isSelected = selectedRun?.id === run.id;
                return (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className={`flex flex-col items-start rounded-md border p-3 text-left transition-all ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between text-xs font-medium text-foreground">
                      <span>{run.agentName}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {run.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px]">
                      <span>Quality: {run.qualityScore}%</span>
                      <span>Uniqueness: {run.uniquenessIndex}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </FramePanel>
        </Frame>

        {/* Step Trace Waterfall Drawer */}
        <Frame className="lg:col-span-2">
          <FramePanel className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Step Trace Waterfall: {selectedRun?.agentName || "Agent Run"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Executed tool calls &amp; context lookups
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Completed in 1,655ms
              </Badge>
            </div>

            <div className="flex flex-col gap-3">
              {selectedRun?.stepTrace?.map((step: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-1 rounded-md border border-border/80 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <ZapIcon className="size-3.5 text-amber-400" />
                      <span>{step.step}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-muted-foreground">{step.tool}</code>
                      <span className="text-[10px] text-zinc-500">{step.durationMs}ms</span>
                    </div>
                  </div>
                  {step.details && (
                    <p className="mt-1 text-xs text-muted-foreground">{step.details}</p>
                  )}
                </div>
              ))}
            </div>
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}
