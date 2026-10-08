import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WebhookEndpoint, WebhookEndpointActionHandlers } from "./data"
import { EllipsisVerticalIcon, Settings2Icon, HistoryIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"

type EndpointActionsMenuProps = WebhookEndpointActionHandlers & {
  endpoint: WebhookEndpoint
}

export function EndpointActionsMenu({
  endpoint,
  onManage,
  onViewDeliveries,
  onRotateSecret,
  onRemove,
}: EndpointActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Open actions for ${endpoint.name}`}
          >
            <EllipsisVerticalIcon aria-hidden="true" />
          </Button>
        }
      />

      {/* Content */}
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onManage(endpoint)}>
            <Settings2Icon aria-hidden="true" />
            {endpoint.status === "failing"
              ? "Review endpoint"
              : "Manage endpoint"}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onViewDeliveries(endpoint)}>
            <HistoryIcon aria-hidden="true" />
            View deliveries
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onRotateSecret(endpoint)}>
            <RefreshCwIcon aria-hidden="true" />
            Rotate secret
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onClick={() => onRemove(endpoint)}
          >
            <Trash2Icon aria-hidden="true" />
            Remove endpoint
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}