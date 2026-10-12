export type PlanAudience = "Individuals" | "Teams" | "Companies"

export type PlanVisibility = "Public" | "Private" | "Archived"

export interface PricingPlan {
  id: string
  name: string
  code: string
  audience: PlanAudience
  price: number
  seats: number
  trialDays: number
  visibility: PlanVisibility
  featured: boolean
}

/**
 * The one-row edit draft. Numeric fields are held as raw input text so an
 * in-progress value like "" or "1." is never lost to an early Number() parse;
 * Save converts them back to numbers.
 */
export interface PlanDraft {
  name: string
  audience: PlanAudience
  price: string
  seats: string
  trialDays: string
  visibility: PlanVisibility
  featured: boolean
}

export interface PlanDraftErrors {
  name: string | null
  price: string | null
  seats: string | null
  trialDays: string | null
}

export const PLAN_AUDIENCES: PlanAudience[] = [
  "Individuals",
  "Teams",
  "Companies",
]

export const PLAN_VISIBILITIES: PlanVisibility[] = [
  "Public",
  "Private",
  "Archived",
]

export const PLANS: PricingPlan[] = [
  {
    id: "plan-free",
    name: "Free",
    code: "plan_free",
    audience: "Individuals",
    price: 0,
    seats: 1,
    trialDays: 0,
    visibility: "Public",
    featured: false,
  },
  {
    id: "plan-starter",
    name: "Starter",
    code: "plan_starter",
    audience: "Individuals",
    price: 12,
    seats: 3,
    trialDays: 14,
    visibility: "Public",
    featured: false,
  },
  {
    id: "plan-pro",
    name: "Pro",
    code: "plan_pro",
    audience: "Teams",
    price: 29,
    seats: 10,
    trialDays: 14,
    visibility: "Public",
    featured: true,
  },
  {
    id: "plan-business",
    name: "Business",
    code: "plan_business",
    audience: "Teams",
    price: 79,
    seats: 25,
    trialDays: 30,
    visibility: "Public",
    featured: false,
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    code: "plan_enterprise",
    audience: "Companies",
    price: 299,
    seats: 100,
    trialDays: 30,
    visibility: "Private",
    featured: false,
  },
]

// Formatting: raw values live above, display strings are derived here.

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatPrice(value: number) {
  return PRICE_FORMATTER.format(value)
}

export function formatTrial(value: number) {
  return value === 0 ? "No trial" : `${value}-day`
}

// Cell validators return an error message or null when valid.

export function validatePlanName(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Name is required."
  if (value.length < 2) return "Use at least 2 characters."
  if (value.length > 40) return "Keep under 40 characters."
  return null
}

export function validatePrice(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Price is required."
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return "Enter a valid number."
  if (parsed < 0) return "Price cannot be negative."
  if (parsed > 100000) return "Price looks too high."
  return null
}

export function validateSeats(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Seats is required."
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return "Enter a whole number."
  if (parsed < 1) return "Use at least 1 seat."
  if (parsed > 10000) return "Seats looks too high."
  return null
}

export function validateTrialDays(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Trial is required."
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return "Enter a whole number."
  if (parsed < 0) return "Trial cannot be negative."
  if (parsed > 90) return "Use 90 days or fewer."
  return null
}

/** Snapshot a saved plan into an editable string draft when a row is checked out. */
export function planToDraft(plan: PricingPlan): PlanDraft {
  return {
    name: plan.name,
    audience: plan.audience,
    price: String(plan.price),
    seats: String(plan.seats),
    trialDays: String(plan.trialDays),
    visibility: plan.visibility,
    featured: plan.featured,
  }
}

/** Convert a validated draft back into a committed plan, preserving id and code. */
export function draftToPlan(base: PricingPlan, draft: PlanDraft): PricingPlan {
  return {
    ...base,
    name: draft.name.trim(),
    audience: draft.audience,
    price: Number(draft.price),
    seats: Number(draft.seats),
    trialDays: Number(draft.trialDays),
    visibility: draft.visibility,
    featured: draft.featured,
  }
}

export function getPlanDraftErrors(draft: PlanDraft): PlanDraftErrors {
  return {
    name: validatePlanName(draft.name),
    price: validatePrice(draft.price),
    seats: validateSeats(draft.seats),
    trialDays: validateTrialDays(draft.trialDays),
  }
}

export function hasPlanDraftError(errors: PlanDraftErrors): boolean {
  return Boolean(
    errors.name || errors.price || errors.seats || errors.trialDays
  )
}