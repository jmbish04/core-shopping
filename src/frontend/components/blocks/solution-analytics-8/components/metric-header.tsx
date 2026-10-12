import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  METRIC,
  PERIODS,
  TOAST_INFO_ICON,
  TOAST_SUCCESS_ICON,
  metricHealthVariant,
  type PeriodValue,
} from "./data"
import { BarChart3Icon, EyeIcon, EyeOffIcon, RefreshCwIcon, MoreHorizontalIcon, FileTextIcon, ImageIcon, PencilIcon } from "lucide-react"

// Content-level header reused from application/navbar/navbar-6: a breadcrumb
// identity row over a title-plus-actions row. Rendered content-level (no sticky,
// no global nav) per the solutions header rule.
export function MetricHeader({
  period,
  onPeriodChange,
}: {
  period: PeriodValue
  onPeriodChange: (value: PeriodValue) => void
}) {
  const [watching, setWatching] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const lead = METRIC.owners.find((owner) => owner.id === METRIC.leadOwnerId)

  function handleToggleWatch() {
    const next = !watching
    setWatching(next)
    if (next) {
      toast.success("Watching Activation rate", {
        description: "Activation drop alerts now route to you.",
        icon: TOAST_SUCCESS_ICON,
      })
    } else {
      toast("Stopped watching Activation rate", {
        description: "You keep edit access but alerts stop reaching you.",
        icon: TOAST_INFO_ICON,
      })
    }
  }

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    window.setTimeout(() => {
      setRefreshing(false)
      toast.success("Metric refreshed", {
        description: "Activation rate recomputed from events through 14:20.",
        icon: TOAST_SUCCESS_ICON,
      })
    }, 1100)
  }

  return (
    <div className="flex flex-col gap-4 border-b pb-5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" className="flex items-center gap-1">
              <BarChart3Icon className="text-muted-foreground size-3.5" aria-hidden="true" />
              Metrics
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{METRIC.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        {/* Identity */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {METRIC.name}
            </h1>
            <Badge variant={metricHealthVariant[METRIC.health]}>
              {METRIC.health}
            </Badge>
            <span className="text-muted-foreground font-mono text-xs">
              {METRIC.id}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <AvatarGroup className="-space-x-1">
              {METRIC.owners.map((owner) => (
                <Avatar key={owner.id} className="size-6">
                  {owner.avatar ? (
                    <AvatarImage src={owner.avatar} alt={owner.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {owner.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <p className="text-muted-foreground inline-flex flex-wrap items-center gap-x-1.5 text-xs">
              <span>
                Owned by{" "}
                <span className="text-foreground font-medium">
                  {lead?.name}
                </span>
              </span>
              <span
                className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                aria-hidden="true"
              />
              <span>{METRIC.window}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) => onPeriodChange(value as PeriodValue)}
            items={PERIODS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          >
            <SelectTrigger className="w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent sideOffset={9} align="end">
              {PERIODS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={watching ? "default" : "outline"}
            onClick={handleToggleWatch}
          >
            {watching ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeOffIcon aria-hidden="true" />
            )}
            <span className="hidden md:block">
              {watching ? "Watching" : "Watch"}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh metric"
          >
            {refreshing ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCwIcon aria-hidden="true" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="More actions" />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={9} align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <FileTextIcon className="size-4 opacity-60" aria-hidden="true" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ImageIcon className="size-4 opacity-60" aria-hidden="true" />
                  Export PNG
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <PencilIcon className="size-4 opacity-60" aria-hidden="true" />
                  Edit definition
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}