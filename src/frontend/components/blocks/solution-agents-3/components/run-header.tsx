import { Badge } from "@/components/reui/badge"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  RUN_IDENTITY,
  RUN_OWNERS,
  TOAST_INFO_ICON,
  TOAST_SUCCESS_ICON,
} from "./data"
import { ArrowLeftIcon, AlertTriangleIcon, CircleCheckIcon, RefreshCwIcon, PauseIcon, MoreHorizontalIcon, DownloadIcon, CopyIcon } from "lucide-react"

// Content-level secondary header (navbar-5 run-control grammar, non-sticky):
// left is the queue context and run identity, right is the live action bar.

const WATCHING_OWNERS = RUN_OWNERS.filter((owner) =>
  ["owner-maya", "owner-noa"].includes(owner.id)
)

export function RunHeader() {
  function handleApprove() {
    toast.success("Run approved", {
      description: `${RUN_IDENTITY.key} continues past the approval gate.`,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  function handleRetryStep() {
    toast.success("Step 3 requeued", {
      description:
        "Capture the partial refund replays with exponential backoff.",
      icon: TOAST_SUCCESS_ICON,
    })
  }

  function handlePause() {
    toast.info("Run paused", {
      description: `${RUN_IDENTITY.key} holds before step 4 until resumed.`,
      icon: TOAST_INFO_ICON,
    })
  }

  function handleExportTrace() {
    toast.info("Trace exported", {
      description: "The step and tool call trace is ready as JSON.",
      icon: TOAST_INFO_ICON,
    })
  }

  function handleCopyRunId() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(RUN_IDENTITY.key)
    }

    toast.success("Run id copied", {
      description: RUN_IDENTITY.key,
      icon: TOAST_SUCCESS_ICON,
    })
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: queue context + run identity */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Back to the run queue">
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">Run Queue /</span>
            <h2 className="text-foreground text-lg leading-tight font-semibold tracking-tight">
              {RUN_IDENTITY.key}
            </h2>
            <Badge variant="destructive-light">
              <AlertTriangleIcon aria-hidden="true" />
              Failed
            </Badge>
          </div>
          <p className="text-muted-foreground min-w-0 truncate text-sm">
            {RUN_IDENTITY.agent} · {RUN_IDENTITY.environment}
          </p>
        </div>
      </div>

      {/* Right: watching owners + run action bar */}
      <div className="flex shrink-0 items-center gap-2">
        <AvatarGroup aria-label="Owners watching this run" className="-space-x-1">
          {WATCHING_OWNERS.map((owner) => (
            <Avatar key={owner.id} className="ring-background size-6 ring-2">
              {owner.avatarSrc ? (
                <AvatarImage src={owner.avatarSrc} alt={owner.name} />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {owner.initials}
              </AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>

        <Separator orientation="vertical" className="my-auto h-4" />

        <Button type="button" variant="outline" size="sm" onClick={handleApprove}>
          <CircleCheckIcon className="size-4" aria-hidden="true" />
          <span className="hidden md:block">Approve</span>
        </Button>

        <Button type="button" size="sm" onClick={handleRetryStep}>
          <RefreshCwIcon className="size-4" aria-hidden="true" />
          <span className="hidden md:block">Retry Step</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pause the run"
          onClick={handlePause}
        >
          <PauseIcon className="size-4" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="More run actions"
              />
            }
          >
            <MoreHorizontalIcon className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleExportTrace}>
                <DownloadIcon className="opacity-60" aria-hidden="true" />
                Export Trace
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleCopyRunId}>
                <CopyIcon className="opacity-60" aria-hidden="true" />
                Copy Run Id
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}