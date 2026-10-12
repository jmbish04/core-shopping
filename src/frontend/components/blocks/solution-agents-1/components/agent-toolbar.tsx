"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RANGE_OPTIONS, type IOption } from "./data"
import { CalendarDaysIcon, PlusIcon, MoreHorizontalIcon, DownloadIcon, CopyIcon, Share2Icon, Settings2Icon } from "lucide-react"

// ── Agent operations header (content-level secondary header) ──
// A content-area section header, not a sticky layout navbar. Left: section
// title, live dot, and a one-line subtitle. Right: a simplified action bar
// (reporting range, primary action, and an overflow menu) vertically centered
// against the title block.

export function AgentToolbar({
  range,
  onRangeChange,
  onExport,
  onNewAgent,
  onMoreAction,
}: {
  range: string
  onRangeChange: (value: string) => void
  onExport: () => void
  onNewAgent: () => void
  onMoreAction: (action: "duplicate" | "share" | "settings") => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: section identity + live status */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <h2 className="text-foreground text-lg leading-tight font-semibold tracking-tight">
            Agent Operations
          </h2>
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground hidden text-sm sm:block">
              Live
            </span>
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Live run health, approvals, and incidents
        </p>
      </div>

      {/* Right: simplified action bar */}
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={range}
          onValueChange={(value) => value && onRangeChange(value)}
          items={RANGE_OPTIONS}
        >
          <SelectTrigger size="sm" className="w-[160px]">
            <CalendarDaysIcon className="text-muted-foreground size-4" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {RANGE_OPTIONS.map((option: IOption) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button size="sm" type="button" onClick={onNewAgent}>
          <PlusIcon aria-hidden="true" />
          <span className="hidden sm:block">New Agent</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="More options"
              />
            }
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onExport}>
                <DownloadIcon className="opacity-60" aria-hidden="true" />
                Export Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoreAction("duplicate")}>
                <CopyIcon className="opacity-60" aria-hidden="true" />
                Duplicate View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoreAction("share")}>
                <Share2Icon className="opacity-60" aria-hidden="true" />
                Share Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onMoreAction("settings")}>
                <Settings2Icon className="opacity-60" aria-hidden="true" />
                Workspace Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}