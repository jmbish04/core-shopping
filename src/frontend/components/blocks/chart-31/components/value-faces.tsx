import { Badge } from "@/components/reui/badge"

import { JOB_HEALTH, type JobHealth } from "./data"

export function HealthFace({ health }: { health: JobHealth }) {
  return (
    <Badge variant={JOB_HEALTH[health].variant}>
      {JOB_HEALTH[health].label}
    </Badge>
  )
}