export interface CancellationReasonOption {
  id: string
  label: string
}

export const CANCELLATION_REASON_OPTIONS: CancellationReasonOption[] = [
  {
    id: "single-launch",
    label: "Only needed one launch",
  },
  {
    id: "budget",
    label: "Budget changed",
  },
  {
    id: "missing-patterns",
    label: "Missing a few patterns",
  },
  {
    id: "internal-kit",
    label: "Moved back in-house",
  },
  {
    id: "not-our-stack",
    label: "Not the right stack fit",
  },
  {
    id: "figma-parity",
    label: "Wanted better Figma parity",
  },
  {
    id: "quality-consistency",
    label: "Output felt inconsistent",
  },
  {
    id: "other",
    label: "Something else",
  },
]