import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

import {
  TIME_RANGE_ORDER,
  TIME_RANGES,
  type AuditEvent,
  type TimeRange,
} from "./data"
import { ExportMenu } from "./export-menu"

const isRange = (value: unknown): value is TimeRange =>
  typeof value === "string" && value in TIME_RANGES

export function AuditHeader({
  range,
  appliedRange,
  onRangeChange,
  filtered,
  selected,
}: {
  range: TimeRange
  appliedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  filtered: AuditEvent[]
  selected: AuditEvent[]
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-foreground text-lg leading-tight font-semibold tracking-tight">
          Audit Log
        </h2>
        <p className="text-muted-foreground text-sm">
          Every change to production, secrets and access
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Re-clicking the pressed item sends an empty array; the guard keeps
            a range selected. */}
        <ToggleGroup
          multiple={false}
          value={[range]}
          onValueChange={(value) => {
            const next = value[0]
            if (isRange(next)) onRangeChange(next)
          }}
          variant="outline"
          spacing={0}
          aria-label="Time range"
        >
          {TIME_RANGE_ORDER.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              title={TIME_RANGES[option].label}
              className="tabular-nums"
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ExportMenu
          filtered={filtered}
          selected={selected}
          range={appliedRange}
        />
      </div>
    </div>
  )
}