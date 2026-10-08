import { useCallback, useState } from "react"
import { toast } from "sonner"

import { AgentToolbar } from "./agent-toolbar"
import { TOAST_INFO_ICON, TOAST_SUCCESS_ICON, type IRun } from "./data"
import { IncidentTimeline } from "./incident-timeline"
import { RunQueue } from "./run-queue"
import { type RunAction } from "./run-queue-columns"
import { RunThroughputChart } from "./run-throughput-chart"
import { SummaryCards } from "./summary-cards"

const RUN_ACTION_COPY: Record<
  RunAction,
  { title: string; description: string }
> = {
  inspect: {
    title: "Inspect run",
    description:
      "Open the run trace to review tool calls, inputs, and outputs.",
  },
  retry: {
    title: "Run queued for retry",
    description: "The run will replay from its last successful checkpoint.",
  },
  pause: {
    title: "Run paused",
    description:
      "The agent will hold at the next safe step until you resume it.",
  },
  assign: {
    title: "Assign owner",
    description: "Pick an operator to own follow-up on this run.",
  },
}

export function AgentDashboard() {
  const [range, setRange] = useState("24h")

  const handleExport = useCallback(() => {
    toast.success("Operations report queued", {
      description:
        "Your agent operations report is being generated and will download shortly.",
      icon: TOAST_SUCCESS_ICON,
    })
  }, [])

  const handleNewAgent = useCallback(() => {
    toast("New agent", {
      description:
        "Open the agent builder to configure tools, guardrails, and approval gates.",
      icon: TOAST_INFO_ICON,
    })
  }, [])

  const handleMoreAction = useCallback(
    (action: "duplicate" | "share" | "settings") => {
      const copy = {
        duplicate: {
          title: "Duplicate view",
          description:
            "A copy of this dashboard view was created in your workspace.",
        },
        share: {
          title: "Share dashboard",
          description: "Generate a read-only link for your operations team.",
        },
        settings: {
          title: "Workspace settings",
          description:
            "Manage environments, alert routing, and approval policies.",
        },
      }[action]

      toast(copy.title, {
        description: copy.description,
        icon: TOAST_INFO_ICON,
      })
    },
    []
  )

  const handleRunAction = useCallback((action: RunAction, run: IRun) => {
    const copy = RUN_ACTION_COPY[action]
    const description = `${run.agent} (${run.runKey}) - ${copy.description}`

    if (action === "retry") {
      toast.success(copy.title, { description, icon: TOAST_SUCCESS_ICON })
      return
    }

    toast(copy.title, { description, icon: TOAST_INFO_ICON })
  }, [])

  return (
    <div className="bg-background flex min-h-svh w-full flex-col">
      <div className="mx-auto w-full max-w-[1320px] p-3 md:p-4">
        <div className="@container w-full">
          {/* Content-level secondary header */}
          <AgentToolbar
            range={range}
            onRangeChange={setRange}
            onExport={handleExport}
            onNewAgent={handleNewAgent}
            onMoreAction={handleMoreAction}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 @4xl:grid-cols-3">
            {/* Row 1 - 3 (full width): summary cards (card-3) */}
            <SummaryCards className="@4xl:col-span-3" />

            {/* Row 2 - 1/2: throughput chart (2) beside incident timeline (1) */}
            <RunThroughputChart className="h-full @4xl:col-span-2" />
            <IncidentTimeline className="h-full @4xl:col-span-1" />

            {/* Row 3 - 3 (full width): run queue data-grid */}
            <RunQueue
              className="@4xl:col-span-3"
              onRunAction={handleRunAction}
            />
          </div>
        </div>
      </div>
    </div>
  )
}