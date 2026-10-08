"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { HistoryIcon, PlayIcon, MoreHorizontalIcon, DownloadIcon, CopyIcon, Share2Icon, Trash2Icon } from "lucide-react"

// ── Navbar controls (run, activate, history, more) ──

export function NavbarControls() {
  const [active, setActive] = useState(true)

  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Activate toggle */}
      <Label className="flex cursor-pointer items-center gap-2">
        <span className="text-foreground hidden text-sm md:block">
          {active ? "Active" : "Inactive"}
        </span>
        <Switch
          checked={active}
          onCheckedChange={setActive}
          size="sm"
          aria-label="Activate workflow"
        />
      </Label>

      <Separator orientation="vertical" className="my-auto h-4" />

      {/* Execution history */}
      <Button variant="ghost" size="icon">
        <HistoryIcon aria-hidden="true" />
      </Button>

      {/* Test run */}
      <Button>
        <PlayIcon aria-hidden="true" />
        <span className="hidden md:block">Test Run</span>
      </Button>

      {/* More options */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <DownloadIcon className="opacity-60" aria-hidden="true" />
              Export JSON
            </DropdownMenuItem>

            <DropdownMenuItem>
              <CopyIcon className="opacity-60" aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Share2Icon className="opacity-60" aria-hidden="true" />
              Share
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive">
              <Trash2Icon aria-hidden="true" />
              Delete workflow
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}