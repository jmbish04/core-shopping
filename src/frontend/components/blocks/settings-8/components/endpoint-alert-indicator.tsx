import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ALERT_CONFIG, type EndpointAlert } from "./data"
import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react"

// ── Endpoint Alert Indicator ──

export function EndpointAlertIndicator({ alert }: { alert: EndpointAlert }) {
  const config = ALERT_CONFIG[alert.tone]

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex rounded-sm p-0.5 focus-visible:ring-2 focus-visible:ring-offset-2",
              config.toneClassName
            )}
            aria-label={`${alert.badgeLabel}. ${alert.detail}`}
          />
        }
      >
        {alert.tone === "success" ? (
          <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />
        ) : alert.tone === "critical" ? (
          <CircleXIcon className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
        )}
      </TooltipTrigger>

      {/* Content */}
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="flex items-center gap-2">
          <Badge variant={config.badgeVariant}>{alert.badgeLabel}</Badge>
          <p>{alert.detail}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}