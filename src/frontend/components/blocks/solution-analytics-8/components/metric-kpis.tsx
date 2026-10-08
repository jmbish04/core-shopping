import { Badge } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"

import { Separator } from "@/components/ui/separator"
import { KPIS } from "./data"
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react"

// KPI rail reused from application/stats/stats-1: Frame stat tiles with a value,
// an arrow delta badge, a separator, and a vs-prior footer. The per-tile
// overflow menu is trimmed for this read-focused detail page.
export function MetricKpis() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
      {KPIS.map((kpi) => (
        <Frame key={kpi.title}>
          <FramePanel className="flex flex-col gap-4">
            <h3 className="text-muted-foreground text-sm font-medium">
              {kpi.title}
            </h3>
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-foreground text-2xl font-medium tracking-tight tabular-nums">
                  {kpi.value}
                </span>
                <Badge variant={kpi.positive ? "success-light" : "destructive-light"}>
                  {kpi.up ? (
                    <ArrowUpIcon aria-hidden="true" />
                  ) : (
                    <ArrowDownIcon aria-hidden="true" />
                  )}
                  {kpi.deltaLabel}
                </Badge>
              </div>
              <Separator />
              <div className="text-muted-foreground text-xs">
                vs{" "}
                <span className="text-foreground font-medium">{kpi.prior}</span>
              </div>
            </div>
          </FramePanel>
        </Frame>
      ))}
    </div>
  )
}