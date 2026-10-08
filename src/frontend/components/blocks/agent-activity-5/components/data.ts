export type OutcomeState = "completed" | "completedWithIssues" | "cancelled"

export type ItemState = "succeeded" | "failed" | "skipped" | "cancelled"

/** Did anything actually check this, or is the claim unbacked? */
export type Verdict = "verified" | "unsupported"

export type Evidence = {
  kind: "command" | "diff" | "record"
  label: string
}

/** Where a row lands when the scoped retry recovers it. Lives in data so the
    simulated retry stays swappable alongside the items it resolves. */
export type Recovery = {
  durationMs: number
  evidence: Evidence
}

export type OutcomeItem = {
  id: string
  label: string
  state: ItemState
  durationMs: number
  /** How long this row takes to be read back, in ms. Uneven on purpose: a
      report resolves row by row, not on a metronome. */
  readMs: number
  evidence?: Evidence
  verdict?: Verdict
  /** Failed and skipped rows only. */
  reason?: string
  /** True when no retry will help until a person does something. */
  needsYou?: string
  /** Labels the control that clears the blocker, e.g. a scope grant. */
  needsYouAction?: string
  /** A skipped row with this set runs once the named item recovers. */
  blockedBy?: string
  recovered?: Recovery
  /** Set when the partial result is kept: the row keeps its state and reason
      on record, and no retry is offered for it. */
  closed?: boolean
}

/** The band state and duration derive from ITEMS, so the state word can never
    contradict the ledger beneath it. */
export type RunOutcome = {
  id: string
  label: string
}

export const OUTCOME: RunOutcome = {
  id: "run_7c31be",
  label: "Reproduce webhook failure",
}

export const ITEMS: OutcomeItem[] = [
  {
    id: "item_1",
    readMs: 520,
    label: "Reproduce the 500 on charge.refunded",
    state: "succeeded",
    durationMs: 148_000,
    verdict: "verified",
    evidence: {
      kind: "command",
      label: "pnpm test src/api/__tests__/stripe-webhook.test.ts",
    },
  },
  {
    id: "item_2",
    readMs: 760,
    // Succeeded but unbacked: the diff landed and no test runs the refund
    // branch, so the row must say so instead of reading as done.
    label: "Patch the refund branch in stripe-webhook.ts",
    state: "succeeded",
    durationMs: 92_000,
    verdict: "unsupported",
  },
  {
    id: "item_3",
    readMs: 900,
    label: "Drain the 41 queued events",
    state: "failed",
    durationMs: 31_000,
    reason:
      "Stripe returned 429 on the replay endpoint. The limit resets in 60s",
    recovered: {
      durationMs: 57_000,
      evidence: {
        kind: "record",
        label: "41 of 41 events replayed",
      },
    },
  },
  {
    id: "item_4",
    readMs: 480,
    label: "Restart the events worker",
    state: "skipped",
    durationMs: 0,
    reason: "Waiting on the queue drain above",
    blockedBy: "item_3",
    recovered: {
      durationMs: 9_000,
      evidence: {
        kind: "command",
        label: "pm2 restart events-worker",
      },
    },
  },
  {
    id: "item_5",
    readMs: 840,
    label: "File the regression in Linear",
    state: "failed",
    durationMs: 12_000,
    reason: "The Linear server holds no issues:create scope",
    needsYou:
      "A workspace admin has to grant the scope. A retry alone will fail again.",
    needsYouAction: "Grant issues:create",
    recovered: {
      durationMs: 18_000,
      evidence: {
        kind: "record",
        label: "Filed HAL-482 in Linear",
      },
    },
  },
]

/** The ledger as plain text, for pasting into a ticket or a message. One line
    per item, in the order the report read them back. */
export function itemLine(item: OutcomeItem): string {
  // A closed row keeps its word, so the copy matches both chips on screen.
  const word = item.closed
    ? `${ITEM_WORD[item.state]}, closed`
    : ITEM_WORD[item.state]
  return (
    `${item.label} [${word}] ${formatDuration(item.durationMs)}` +
    (item.reason ? ` - ${item.reason}` : "")
  )
}

export function reportText(items: OutcomeItem[]): string {
  const lines = items.map((item) => `- ${itemLine(item)}`)
  return [`${OUTCOME.label} (${OUTCOME.id})`, ...lines].join("\n")
}

/** Every ItemState is terminal, so every row counts as settled, failures
    included. The succeeded count is the only number that moves. */
export function tally(items: OutcomeItem[]) {
  const succeeded = items.filter((item) => item.state === "succeeded").length
  return { succeeded, total: items.length }
}

export function totalMs(items: OutcomeItem[]) {
  return items.reduce((sum, item) => sum + item.durationMs, 0)
}

/** Compact wall clock: 4m 51s, or 12s under a minute. */
export function formatDuration(ms: number) {
  if (ms === 0) return "0s"
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (!minutes) return `${rest}s`
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

export const STATE_WORD: Record<OutcomeState, string> = {
  completed: "Completed",
  completedWithIssues: "Completed with issues",
  cancelled: "Discarded",
}

export const ITEM_WORD: Record<ItemState, string> = {
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
  cancelled: "Cancelled",
}