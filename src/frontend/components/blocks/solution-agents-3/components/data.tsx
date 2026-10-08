import { type ReactNode } from "react"
import { CircleCheckIcon, InfoIcon } from "lucide-react"

export type RunStatus = "running" | "failed" | "completed"
export type RunPriority = "low" | "medium" | "high" | "urgent"
export type RetryPolicy = "none" | "fixed" | "exponential"
export type StepStatus = "completed" | "active" | "failed" | "pending"
export type ToolCallStatus = "Succeeded" | "Failed"

export type RunSelectOption<TValue extends string = string> = {
  value: TValue
  label: string
  description?: string
}

export type RunOwner = {
  id: string
  name: string
  role: string
  initials: string
  avatarSrc?: string
}

export type RunSettingsValue = {
  status: RunStatus
  priority: RunPriority
  ownerIds: string[]
  retryPolicy: RetryPolicy
  maxRetries: string
  notifyOnFailure: boolean
}

export type ToolCall = {
  id: string
  name: string
  status: ToolCallStatus
  latency: string
  note?: string
}

export type RunStep = {
  id: number
  title: string
  status: StepStatus
  duration?: string
  summary: string
  toolCalls: ToolCall[]
  error?: { title: string; detail: string }
}

export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="size-[18px] text-green-600" aria-hidden="true" />
)

export const TOAST_INFO_ICON = (
  <InfoIcon className="text-muted-foreground size-[18px]" aria-hidden="true" />
)

export const RUN_IDENTITY = {
  key: "RUN-4822",
  agent: "Refund Resolver",
  environment: "Production",
}

export const RUN_TIMESTAMPS = {
  started: "Jun 10, 12:38",
  lastActivity: "8 min ago",
}

export const STATUS_OPTIONS: RunSelectOption<RunStatus>[] = [
  {
    value: "running",
    label: "Running",
    description: "Executing steps and streaming output.",
  },
  {
    value: "failed",
    label: "Failed",
    description: "Stopped at a step and waiting on an operator.",
  },
  {
    value: "completed",
    label: "Completed",
    description: "Finished every step and wrote its results.",
  },
]

export const PRIORITY_OPTIONS: RunSelectOption<RunPriority>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export const RETRY_POLICY_OPTIONS: RunSelectOption<RetryPolicy>[] = [
  {
    value: "none",
    label: "No retries",
    description: "Fail the run on the first step error.",
  },
  {
    value: "fixed",
    label: "Fixed delay",
    description: "Retry every 30 seconds.",
  },
  {
    value: "exponential",
    label: "Exponential backoff",
    description: "Retry at 30s, 2m, then 8m.",
  },
]

export const RUN_OWNERS: RunOwner[] = [
  {
    id: "owner-maya",
    name: "Maya Perez",
    role: "Operations lead",
    initials: "MP",
    avatarSrc:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "owner-noa",
    name: "Noa Kim",
    role: "Reliability engineer",
    initials: "NK",
    avatarSrc:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "owner-emil",
    name: "Emil Novak",
    role: "Platform engineer",
    initials: "EN",
    avatarSrc:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "owner-lara",
    name: "Lara Chen",
    role: "Support automation",
    initials: "LC",
    avatarSrc:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "owner-pavel",
    name: "Pavel Singh",
    role: "Growth engineer",
    initials: "PS",
    avatarSrc:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80",
  },
  {
    id: "owner-jonas",
    name: "Jonas Reed",
    role: "Safety reviewer",
    initials: "JR",
  },
]

export const DEFAULT_RUN_SETTINGS: RunSettingsValue = {
  status: "failed",
  priority: "high",
  ownerIds: ["owner-maya", "owner-noa"],
  retryPolicy: "exponential",
  maxRetries: "3",
  notifyOnFailure: true,
}

export const RUN_STEPS: RunStep[] = [
  {
    id: 1,
    title: "Plan the refund approach",
    status: "completed",
    duration: "14s",
    summary: "Matched the return to its original charge and picked a partial capture.",
    toolCalls: [
      {
        id: "call-1a",
        name: "kb.search",
        status: "Succeeded",
        latency: "320ms",
        note: "2 refund runbooks retrieved",
      },
      {
        id: "call-1b",
        name: "orders.lookup",
        status: "Succeeded",
        latency: "410ms",
        note: "ORD-99102, 3 line items",
      },
    ],
  },
  {
    id: 2,
    title: "Validate the refund policy",
    status: "completed",
    duration: "9s",
    summary: "Partial return of $182.40 fits the 30 day window and needs no second approval.",
    toolCalls: [
      {
        id: "call-2a",
        name: "policies.refunds.check",
        status: "Succeeded",
        latency: "280ms",
        note: "under the $500 finance threshold",
      },
    ],
  },
  {
    id: 3,
    title: "Capture the partial refund",
    status: "failed",
    duration: "12s",
    summary: "The processor declined the partial capture on the original card.",
    error: {
      title: "Partial Capture Declined",
      detail:
        "payments.refunds.create returned 402 card_declined. Retry with a manual amount or credit the account instead.",
    },
    toolCalls: [
      {
        id: "call-3a",
        name: "payments.refunds.create",
        status: "Failed",
        latency: "6.1s",
        note: "402 card_declined, attempt 1 of 3",
      },
      {
        id: "call-3b",
        name: "payments.refunds.create",
        status: "Failed",
        latency: "5.8s",
        note: "402 card_declined, attempt 2 of 3",
      },
    ],
  },
  {
    id: 4,
    title: "Verify the refund landed",
    status: "pending",
    summary: "Waits for the capture to settle before checking the ledger.",
    toolCalls: [],
  },
  {
    id: 5,
    title: "Notify the customer",
    status: "pending",
    summary: "Sends the confirmation email with the credited amount.",
    toolCalls: [],
  },
  {
    id: 6,
    title: "Write back to the order record",
    status: "pending",
    summary: "Marks ORD-99102 refunded and closes the return.",
    toolCalls: [],
  },
]