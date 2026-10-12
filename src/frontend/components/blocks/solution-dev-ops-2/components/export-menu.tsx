import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { downloadFile, toCsv, toJsonPayload } from "./audit-query"
import { REFERENCE_DATE, type AuditEvent, type TimeRange } from "./data"
import { TOAST_ERROR_ICON, TOAST_SUCCESS_ICON, UI_ICONS } from "./icons"

type ExportScope = "filtered" | "selected"
type ExportFormat = "csv" | "json"

/** Writes the file and answers with exactly one toast either way. */
export function exportEvents(
  events: AuditEvent[],
  format: ExportFormat,
  range: TimeRange
) {
  const filename = `harbor-audit-${range}-${REFERENCE_DATE.slice(0, 10)}.${format}`
  const saved =
    format === "csv"
      ? downloadFile(filename, toCsv(events), "text/csv")
      : downloadFile(
          filename,
          JSON.stringify(events.map(toJsonPayload), null, 2),
          "application/json"
        )
  if (saved) {
    toast.success("Export ready", {
      description: `${events.length} ${events.length === 1 ? "event" : "events"} in ${filename}`,
      icon: TOAST_SUCCESS_ICON,
    })
  } else {
    toast.error("Export failed", {
      description: "This browser blocked the download.",
      icon: TOAST_ERROR_ICON,
    })
  }
}

export function ExportMenu({
  filtered,
  selected,
  range,
}: {
  filtered: AuditEvent[]
  selected: AuditEvent[]
  range: TimeRange
}) {
  const [scope, setScope] = useState<ExportScope>("filtered")
  // An emptied selection falls back to the filtered set, never to nothing.
  const effectiveScope =
    scope === "selected" && selected.length ? scope : "filtered"
  const events = effectiveScope === "selected" ? selected : filtered

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" disabled={filtered.length === 0} />}
      >
        {UI_ICONS.download}
        Export
        {UI_ICONS.chevronDown}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup
          aria-label="Scope"
          value={effectiveScope}
          onValueChange={(next) => {
            if (next === "filtered" || next === "selected") setScope(next)
          }}
        >
          <DropdownMenuLabel>Scope</DropdownMenuLabel>
          <DropdownMenuRadioItem value="filtered">
            Filtered events
            <span className="text-muted-foreground ms-auto text-xs tabular-nums">
              {filtered.length}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="selected"
            disabled={selected.length === 0}
          >
            Selected events
            <span className="text-muted-foreground ms-auto text-xs tabular-nums">
              {selected.length}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="Format">
          <DropdownMenuLabel>Format</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => exportEvents(events, "csv", range)}>
            {UI_ICONS.fileSpreadsheet}
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportEvents(events, "json", range)}>
            {UI_ICONS.fileJson}
            Download JSON
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}