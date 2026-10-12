import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Switch } from "@/components/ui/switch"

import {
  getEndpointAlerts,
  type WebhookEndpoint,
  type WebhookEndpointActionHandlers,
} from "./data"
import { EndpointActionsMenu } from "./endpoint-actions-menu"
import { EndpointAlertIndicator } from "./endpoint-alert-indicator"
import { EndpointUrlCopy } from "./endpoint-url-copy"
import { StatusIndicator } from "./status-indicator"

type EndpointRowProps = WebhookEndpointActionHandlers & {
  endpoint: WebhookEndpoint
  onToggle: (id: string, enabled: boolean) => void
}

// ── Endpoint Row ──

export function EndpointRow({
  endpoint,
  onToggle,
  onManage,
  onViewDeliveries,
  onRotateSecret,
  onRemove,
}: EndpointRowProps) {
  const isEnabled = endpoint.status !== "disabled"
  const alerts = getEndpointAlerts(endpoint)

  return (
    <Item variant="outline" className="border-x-0 border-t-0 last:border-b-0">
      {/* Media */}
      <ItemMedia variant="icon" className="translate-y-0! self-center!">
        <Item className="border-border flex size-10 items-center justify-center border p-0 [&_svg]:opacity-60">
          {endpoint.icon}
        </Item>
      </ItemMedia>

      {/* Content */}
      <ItemContent className="min-w-0 gap-1">
        <ItemTitle className="min-w-0 gap-2">
          <span className="min-w-0 truncate">{endpoint.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            {alerts.map((alert) => (
              <EndpointAlertIndicator key={alert.id} alert={alert} />
            ))}
          </span>
          <StatusIndicator status={endpoint.status} />
        </ItemTitle>

        <ItemDescription className="min-w-0">
          <EndpointUrlCopy endpointName={endpoint.name} url={endpoint.url} />
        </ItemDescription>
      </ItemContent>

      {/* Actions */}
      <ItemActions className="gap-2 self-start sm:self-center">
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => onToggle(endpoint.id, checked)}
          aria-label={`Toggle ${endpoint.url}`}
        />

        <EndpointActionsMenu
          endpoint={endpoint}
          onManage={onManage}
          onViewDeliveries={onViewDeliveries}
          onRotateSecret={onRotateSecret}
          onRemove={onRemove}
        />
      </ItemActions>
    </Item>
  )
}