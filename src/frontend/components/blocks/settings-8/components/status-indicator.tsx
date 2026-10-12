import { Badge } from "@/components/reui/badge"

import { STATUS_CONFIG, type EndpointStatus } from "./data"

// ── Status Indicator ──

export function StatusIndicator({ status }: { status: EndpointStatus }) {
  const config = STATUS_CONFIG[status]

  return <Badge variant={config.variant}>{config.label}</Badge>
}