import { useState } from "react"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ENDPOINTS, type WebhookEndpoint } from "./data"
import { EndpointRow } from "./endpoint-row"
import { showEndpointToast } from "./endpoint-toast"
import { PlusIcon } from "lucide-react"

export function WebhookEndpoints() {
  const [endpoints, setEndpoints] = useState(ENDPOINTS)

  const handleToggle = (id: string, enabled: boolean) => {
    const endpoint = endpoints.find((item) => item.id === id)

    setEndpoints((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: enabled ? ("active" as const) : ("disabled" as const),
            }
          : item
      )
    )

    if (!endpoint) return

    showEndpointToast({
      title: enabled ? "Endpoint enabled" : "Endpoint paused",
      description: enabled
        ? `${endpoint.name} is live again.`
        : `${endpoint.name} is no longer receiving events.`,
      variant: enabled ? "success" : "info",
    })
  }

  const handleManage = (endpoint: WebhookEndpoint) => {
    showEndpointToast({
      title:
        endpoint.status === "failing" ? "Review delivery" : "Endpoint settings",
      description:
        endpoint.status === "failing"
          ? `Check retries for ${endpoint.name}.`
          : `Open rules for ${endpoint.name}.`,
    })
  }

  const handleViewDeliveries = (endpoint: WebhookEndpoint) => {
    showEndpointToast({
      title: "Delivery history",
      description: endpoint.lastDelivery
        ? `${endpoint.name} delivered ${endpoint.lastDelivery}.`
        : `${endpoint.name} has no recent deliveries.`,
    })
  }

  const handleRotateSecret = (endpoint: WebhookEndpoint) => {
    setEndpoints((current) =>
      current.map((item) =>
        item.id === endpoint.id ? { ...item, secretRotation: "Just now" } : item
      )
    )

    showEndpointToast({
      title: "Secret rotated",
      description: `${endpoint.name} received a new signing secret.`,
      variant: "success",
    })
  }

  const handleRemove = (endpoint: WebhookEndpoint) => {
    setEndpoints((current) => current.filter((item) => item.id !== endpoint.id))

    showEndpointToast({
      title: "Endpoint removed",
      description: `${endpoint.name} was removed from delivery routes.`,
    })
  }

  return (
    <Frame className="w-full max-w-3xl">
      {/* Header */}
      <FrameHeader className="flex-row items-center justify-between gap-4 px-2! py-2.5!">
        <div className="space-y-px">
          <FrameTitle>Webhook Endpoints</FrameTitle>
          <FrameDescription>Routes and status</FrameDescription>
        </div>

        <Button
          onClick={() =>
            showEndpointToast({
              title: "Add endpoint",
              description: "Add a destination URL and subscribed events.",
            })
          }
        >
          <PlusIcon aria-hidden="true" />
          Add Endpoint
        </Button>
      </FrameHeader>

      {/* Content */}
      <FramePanel className="p-0!">
        {endpoints.map((endpoint, index) => (
          <div key={endpoint.id}>
            {index > 0 ? <Separator /> : null}
            <EndpointRow
              endpoint={endpoint}
              onToggle={handleToggle}
              onManage={handleManage}
              onViewDeliveries={handleViewDeliveries}
              onRotateSecret={handleRotateSecret}
              onRemove={handleRemove}
            />
          </div>
        ))}
      </FramePanel>
    </Frame>
  )
}