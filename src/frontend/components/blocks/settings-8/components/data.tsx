import { type ReactNode } from "react"
import type { BadgeProps } from "@/components/reui/badge"
import { CreditCardIcon, UsersIcon, RepeatIcon, BanknoteIcon, ShieldAlertIcon } from "lucide-react"

// ── Types ──

export type EndpointStatus = "active" | "failing" | "disabled"

export type EndpointAlertTone = "success" | "warning" | "critical"

export interface EndpointAlert {
  id: string
  tone: EndpointAlertTone
  badgeLabel: string
  detail: string
}

export interface WebhookEvent {
  id: string
  label: string
}

export interface WebhookEndpoint {
  id: string
  name: string
  url: string
  description: string
  events: WebhookEvent[]
  status: EndpointStatus
  secret: string
  lastDelivery: string | null
  secretRotation: string
  owner: string
  icon: ReactNode
}

export type WebhookEndpointActionHandlers = {
  onManage: (endpoint: WebhookEndpoint) => void
  onViewDeliveries: (endpoint: WebhookEndpoint) => void
  onRotateSecret: (endpoint: WebhookEndpoint) => void
  onRemove: (endpoint: WebhookEndpoint) => void
}

// ── Config ──

export const STATUS_CONFIG: Record<
  EndpointStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  active: { label: "Delivering", variant: "success-light" },
  failing: { label: "Retrying", variant: "warning-light" },
  disabled: { label: "Paused", variant: "outline" },
}

export const ALERT_CONFIG: Record<
  EndpointAlertTone,
  {
    toneClassName: string
    badgeVariant: BadgeProps["variant"]
  }
> = {
  success: {
    toneClassName: "text-green-600",
    badgeVariant: "success",
  },
  warning: {
    toneClassName: "text-warning",
    badgeVariant: "warning",
  },
  critical: {
    toneClassName: "text-destructive",
    badgeVariant: "destructive",
  },
}

// ── Data ──

export const ENDPOINTS: WebhookEndpoint[] = [
  {
    id: "endpoint-billing",
    name: "Billing Pipeline",
    url: "https://events.acme.dev/webhooks/billing",
    description: "Invoices and disputes.",
    events: [
      { id: "invoice.paid", label: "invoice.paid" },
      { id: "invoice.failed", label: "invoice.failed" },
      { id: "charge.refunded", label: "charge.refunded" },
    ],
    status: "active",
    secret: "whsec_1h7qv4r9m2x6k8p3",
    lastDelivery: "2m ago",
    secretRotation: "12d ago",
    owner: "Revenue",
    icon: (
      <CreditCardIcon aria-hidden="true" />
    ),
  },
  {
    id: "endpoint-customers",
    name: "Customer Ledger",
    url: "https://ingest.acme.dev/webhooks/customers",
    description: "Customer lifecycle events.",
    events: [
      { id: "customer.created", label: "customer.created" },
      { id: "customer.updated", label: "customer.updated" },
    ],
    status: "active",
    secret: "whsec_8m1p6q4r2v7x3k9n",
    lastDelivery: "14m ago",
    secretRotation: "28d ago",
    owner: "Data",
    icon: (
      <UsersIcon aria-hidden="true" />
    ),
  },
  {
    id: "endpoint-subscriptions",
    name: "Subscription Orchestrator",
    url: "https://ops.acme.dev/webhooks/subscriptions",
    description: "Retries and plan changes.",
    events: [
      { id: "subscription.activated", label: "subscription.activated" },
      { id: "subscription.cancelled", label: "subscription.cancelled" },
      { id: "invoice.failed", label: "invoice.failed" },
    ],
    status: "failing",
    secret: "whsec_4x8m1r6q3p9k2v7n",
    lastDelivery: "9m ago",
    secretRotation: "5d left",
    owner: "Lifecycle",
    icon: (
      <RepeatIcon aria-hidden="true" />
    ),
  },
  {
    id: "endpoint-finance",
    name: "Finance Reconciliation",
    url: "https://ledger.acme.dev/webhooks/payouts",
    description: "Payout sync to ledger.",
    events: [
      { id: "payout.completed", label: "payout.completed" },
      { id: "balance.updated", label: "balance.updated" },
    ],
    status: "disabled",
    secret: "whsec_7v3q9m2k6r1p4x8n",
    lastDelivery: null,
    secretRotation: "Paused",
    owner: "Finance",
    icon: (
      <BanknoteIcon aria-hidden="true" />
    ),
  },
  {
    id: "endpoint-risk",
    name: "Risk Intake",
    url: "https://risk.acme.dev/webhooks/disputes",
    description: "Disputes and refund review.",
    events: [
      { id: "dispute.opened", label: "dispute.opened" },
      { id: "charge.refunded", label: "charge.refunded" },
    ],
    status: "active",
    secret: "whsec_5q9r2m7x1k4v8p3n",
    lastDelivery: "47m ago",
    secretRotation: "9d ago",
    owner: "Risk",
    icon: (
      <ShieldAlertIcon aria-hidden="true" />
    ),
  },
]

// ── Helpers ──

export function parseMinutesAgo(label: string | null) {
  const match = label?.match(/^(\d+)m ago$/)

  return match ? Number(match[1]) : null
}

export function parseRotationDaysAgo(label: string) {
  const match = label.match(/^(\d+)d ago$/)

  return match ? Number(match[1]) : null
}

export function getEndpointAlerts(endpoint: WebhookEndpoint): EndpointAlert[] {
  const alerts: EndpointAlert[] = []
  const deliveryMinutes = parseMinutesAgo(endpoint.lastDelivery)
  const rotationDaysAgo = parseRotationDaysAgo(endpoint.secretRotation)

  if (endpoint.status === "failing") {
    alerts.push({
      id: "delivery-failure",
      tone: "critical",
      badgeLabel: "Critical",
      detail: `${endpoint.name} has deliveries waiting for retry review.`,
    })
  } else if (endpoint.status === "disabled") {
    alerts.push({
      id: "delivery-paused",
      tone: "warning",
      badgeLabel: "Warning",
      detail: `${endpoint.name} is paused and not receiving new events.`,
    })
  }

  if (deliveryMinutes !== null && deliveryMinutes >= 30) {
    alerts.push({
      id: "delivery-lag",
      tone: "warning",
      badgeLabel: "Warning",
      detail: `Last delivery landed ${endpoint.lastDelivery}. Check if that delay is expected.`,
    })
  }

  if (endpoint.secretRotation === "5d left") {
    alerts.push({
      id: "rotation-due",
      tone: "warning",
      badgeLabel: "Warning",
      detail: "Signing secret rotation is due within 5 days.",
    })
  } else if (rotationDaysAgo !== null && rotationDaysAgo >= 21) {
    alerts.push({
      id: "rotation-stale",
      tone: "warning",
      badgeLabel: "Warning",
      detail: `Signing secret was rotated ${endpoint.secretRotation}. Consider refreshing it soon.`,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      tone: "success",
      badgeLabel: "Healthy",
      detail: `${endpoint.name} is delivering subscribed events normally.`,
    })
  }

  return alerts
}