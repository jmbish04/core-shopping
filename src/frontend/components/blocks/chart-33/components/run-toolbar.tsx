"use client"

/** The header toolbar: how many runs to chart, Run now, and the job menu. */
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

import { RUN_WINDOWS, type RunWindow } from "./data"
import { TOAST_ERROR_ICON, TOAST_SUCCESS_ICON, UI_ICONS } from "./icons"

const windowOf = (value: unknown) =>
  RUN_WINDOWS.find((option) => String(option) === value)

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`, {
      icon: TOAST_SUCCESS_ICON,
      description: value,
    })
  } catch {
    toast.error("Copy failed", {
      icon: TOAST_ERROR_ICON,
      description: "The browser blocked clipboard access.",
    })
  }
}

export function RunToolbar({
  runWindow,
  onRunWindowChange,
  running,
  paused,
  lastRunId,
  onRunNow,
  onTogglePause,
  onExport,
}: {
  runWindow: RunWindow
  onRunWindowChange: (next: RunWindow) => void
  running: boolean
  paused: boolean
  lastRunId: string
  onRunNow: () => void
  onTogglePause: () => void
  onExport: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Re-clicking the pressed item sends an empty array; the guard keeps
          a window selected. */}
      <ToggleGroup
        multiple={false}
        value={[String(runWindow)]}
        onValueChange={(value) => {
          const next = windowOf(value[0])
          if (next) onRunWindowChange(next)
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Runs shown"
      >
        {RUN_WINDOWS.map((option) => (
          <ToggleGroupItem
            key={option}
            value={String(option)}
            aria-label={`Last ${option} runs`}
            className="text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground tabular-nums"
          >
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={running}
        onClick={onRunNow}
      >
        {UI_ICONS.play}
        Run now
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
            />
          }
        >
          {UI_ICONS.more}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Schedule</DropdownMenuLabel>
            <DropdownMenuItem onClick={onTogglePause}>
              {paused ? UI_ICONS.play : UI_ICONS.pause}
              {paused ? "Resume schedule" : "Pause schedule"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Data</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => copyText(lastRunId, "Run ID")}>
              {UI_ICONS.copy}
              Copy last run ID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              {UI_ICONS.download}
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}