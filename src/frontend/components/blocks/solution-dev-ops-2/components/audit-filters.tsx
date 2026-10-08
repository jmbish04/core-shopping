import { type ReactNode } from "react"
import { type FilterOperatorLabels } from "@/components/reui/filters/filters-operators"
import {
  createFilterQuery,
  createFilterRule,
  flattenFilterRules,
  isFilterRuleComplete,
} from "@/components/reui/filters/filters-query"
import {
  type FilterField,
  type FilterNode,
  type FilterQuery,
  type FilterValueDisplayContext,
} from "@/components/reui/filters/filters-types"

import { reviewState } from "./audit-query"
import {
  ACTOR_ORDER,
  ACTORS,
  CATEGORY_LABEL,
  ENV_LABEL,
  EVENTS,
  OUTCOME_CONFIG,
  RESOURCE_TYPE_LABEL,
  REVIEW_CONFIG,
  SOURCE_LABEL,
  type AuditEvent,
  type ResourceType,
  type SavedView,
} from "./data"
import {
  CATEGORY_ICONS,
  FIELD_ICONS,
  RESOURCE_ICONS,
  SOURCE_ICONS,
} from "./icons"
import {
  ActorAvatar,
  ActorFace,
  CategoryFace,
  EnvironmentFace,
  FirstFacePlus,
  OutcomeFace,
  ResourceFace,
  ReviewStateFace,
  SourceFace,
} from "./value-faces"

export const EMPTY_FILTER_QUERY: FilterQuery = createFilterQuery()

/** Short operator words keep the chip and its menu narrow. */
export const COMPACT_OPERATORS: FilterOperatorLabels = {
  is_not: "is not",
  is_any_of: "any of",
  is_none_of: "none of",
  not_contains: "excludes",
  starts_with: "starts with",
  empty: "empty",
  not_empty: "not empty",
}

/** Option rows draw the value's own face, keeping the plain label only for
 *  search and the accessible name. */
const FACE_MENU =
  "[&_[data-slot=filter-menu-icon]]:text-foreground [&_[data-slot=filter-menu-icon]+span]:sr-only"

/** Badge faces take the 32px row a select item gives them, not the 28px text row. */
const BADGE_MENU = `${FACE_MENU} [&_[role=option]]:min-h-8`

const faceValue = (face: (value: string) => ReactNode, empty: string) =>
  function FaceValue({ values }: FilterValueDisplayContext) {
    return (
      <FirstFacePlus values={values.map(String)} face={face} empty={empty} />
    )
  }

// Typed keys of the label maps, so a stored filter value narrows safely.
const keysOf = <K extends string>(record: Record<K, unknown>) =>
  Object.keys(record).filter((key): key is K => key in record)
const isKey =
  <K extends string>(record: Record<K, unknown>) =>
  (value: string): value is K =>
    value in record

const isActorId = isKey(ACTORS)
const isCategory = isKey(CATEGORY_LABEL)
const isEnvironment = isKey(ENV_LABEL)
const isOutcome = isKey(OUTCOME_CONFIG)
const isResourceType = isKey(RESOURCE_TYPE_LABEL)
const isReviewState = isKey(REVIEW_CONFIG)
const isSource = isKey(SOURCE_LABEL)

const ACTIONS = Array.from(new Set(EVENTS.map((event) => event.action))).sort()

/** Each resource name with the type its glyph comes from. */
const RESOURCE_TYPES = new Map<string, ResourceType>(
  EVENTS.map((event) => [event.resource.name, event.resource.type])
)
const RESOURCE_NAMES = Array.from(RESOURCE_TYPES.keys()).sort()

export const AUDIT_FILTER_FIELDS: FilterField[] = [
  {
    id: "actor",
    label: "Actor",
    icon: FIELD_ICONS.actor,
    type: "select",
    searchable: true,
    options: ACTOR_ORDER.map((id) => ({
      value: id,
      label: ACTORS[id].name,
      icon: <ActorAvatar actorId={id} />,
    })),
    renderValue: faceValue(
      (value) => (isActorId(value) ? <ActorFace actorId={value} /> : value),
      "anyone"
    ),
  },
  {
    id: "action",
    label: "Action",
    icon: FIELD_ICONS.action,
    type: "select",
    searchable: true,
    className: FACE_MENU,
    options: ACTIONS.map((action) => ({
      value: action,
      label: action,
      icon: (
        <span aria-hidden="true" className="font-mono text-xs">
          {action}
        </span>
      ),
    })),
    renderValue: faceValue(
      (value) => <span className="truncate font-mono text-xs">{value}</span>,
      "any action"
    ),
  },
  {
    id: "category",
    label: "Category",
    icon: FIELD_ICONS.category,
    type: "select",
    options: keysOf(CATEGORY_LABEL).map((category) => ({
      value: category,
      label: CATEGORY_LABEL[category],
      icon: CATEGORY_ICONS[category],
    })),
    renderValue: faceValue(
      (value) =>
        isCategory(value) ? <CategoryFace category={value} /> : value,
      "any category"
    ),
  },
  {
    id: "resource",
    label: "Resource",
    icon: FIELD_ICONS.resource,
    type: "select",
    searchable: true,
    options: RESOURCE_NAMES.map((name) => ({
      value: name,
      label: name,
      icon: RESOURCE_ICONS[RESOURCE_TYPES.get(name) ?? "service"],
    })),
    renderValue: faceValue(
      (value) => (
        <ResourceFace
          resource={{
            type: RESOURCE_TYPES.get(value) ?? "service",
            name: value,
            id: "",
          }}
          showId={false}
        />
      ),
      "any resource"
    ),
  },
  {
    id: "resourceType",
    label: "Resource Type",
    icon: FIELD_ICONS.resourceType,
    type: "select",
    options: keysOf(RESOURCE_TYPE_LABEL).map((type) => ({
      value: type,
      label: RESOURCE_TYPE_LABEL[type],
      icon: RESOURCE_ICONS[type],
    })),
    renderValue: faceValue(
      (value) => (isResourceType(value) ? RESOURCE_TYPE_LABEL[value] : value),
      "any type"
    ),
  },
  {
    id: "environment",
    label: "Environment",
    icon: FIELD_ICONS.environment,
    type: "select",
    className: BADGE_MENU,
    options: keysOf(ENV_LABEL).map((environment) => ({
      value: environment,
      label: ENV_LABEL[environment],
      icon: (
        <span aria-hidden="true">
          <EnvironmentFace environment={environment} />
        </span>
      ),
    })),
    renderValue: faceValue(
      (value) =>
        isEnvironment(value) ? <EnvironmentFace environment={value} /> : value,
      "any environment"
    ),
  },
  {
    id: "source",
    label: "Source",
    icon: FIELD_ICONS.source,
    type: "select",
    options: keysOf(SOURCE_LABEL).map((source) => ({
      value: source,
      label: SOURCE_LABEL[source],
      icon: SOURCE_ICONS[source],
    })),
    renderValue: faceValue(
      (value) => (isSource(value) ? <SourceFace source={value} /> : value),
      "any source"
    ),
  },
  {
    id: "outcome",
    label: "Outcome",
    icon: FIELD_ICONS.outcome,
    type: "select",
    className: BADGE_MENU,
    options: keysOf(OUTCOME_CONFIG).map((outcome) => ({
      value: outcome,
      label: OUTCOME_CONFIG[outcome].label,
      icon: (
        <span aria-hidden="true">
          <OutcomeFace outcome={outcome} />
        </span>
      ),
    })),
    renderValue: faceValue(
      (value) => (isOutcome(value) ? <OutcomeFace outcome={value} /> : value),
      "any outcome"
    ),
  },
  {
    id: "ip",
    label: "IP Address",
    icon: FIELD_ICONS.ip,
    type: "text",
    placeholder: "203.0.113.",
    operators: [
      { value: "contains", label: "contains" },
      { value: "starts_with", label: "starts with" },
      { value: "is", label: "is" },
    ],
  },
  {
    id: "review",
    label: "Review",
    icon: FIELD_ICONS.review,
    type: "select",
    className: BADGE_MENU,
    options: keysOf(REVIEW_CONFIG).map((state) => ({
      value: state,
      label: REVIEW_CONFIG[state].label,
      icon: (
        <span aria-hidden="true">
          <ReviewStateFace state={state} />
        </span>
      ),
    })),
    renderValue: faceValue(
      (value) =>
        isReviewState(value) ? <ReviewStateFace state={value} /> : value,
      "any state"
    ),
  },
]

// ── Saved views ──

const view = (
  id: string,
  name: string,
  rules: { field: string; operator: string; value: unknown }[]
): SavedView => ({
  id,
  name,
  builtIn: true,
  query: createFilterQuery(
    rules.map((rule) =>
      createFilterRule({
        id: `${id}-${rule.field}`,
        path: [rule.field],
        operator: rule.operator,
        value: rule.value,
      })
    )
  ),
})

export const ALL_EVENTS_VIEW_ID = "view-all"
/** Exactly the Denied Attempts queue, so Review all lands on its count. */
export const OPEN_DENIALS_VIEW_ID = "view-open-denials"

export const BUILT_IN_VIEWS: SavedView[] = [
  view(ALL_EVENTS_VIEW_ID, "All events", []),
  view("view-prod-deploys", "Production deploys", [
    { field: "category", operator: "is", value: "deploy" },
    { field: "environment", operator: "is", value: "production" },
  ]),
  view("view-secrets-keys", "Secrets and keys", [
    {
      field: "resourceType",
      operator: "is_any_of",
      value: ["secret", "apikey"],
    },
  ]),
  view("view-access", "Access changes", [
    { field: "category", operator: "is", value: "access" },
  ]),
  view("view-needs-review", "Needs review", [
    { field: "review", operator: "is", value: "needs_review" },
  ]),
  view(OPEN_DENIALS_VIEW_ID, "Open denials", [
    { field: "outcome", operator: "is", value: "denied" },
    { field: "review", operator: "is", value: "needs_review" },
  ]),
  view("view-denied-failed", "Denied and failed", [
    { field: "outcome", operator: "is_any_of", value: ["denied", "failed"] },
  ]),
]

// ── Evaluation ──

function readPath(event: AuditEvent, path: string[]): unknown {
  switch (path[0]) {
    case "actor":
      return event.actorId
    case "action":
      return event.action
    case "category":
      return event.category
    case "resource":
      return event.resource.name
    case "resourceType":
      return event.resource.type
    case "environment":
      return event.environment
    case "source":
      return event.source
    case "outcome":
      return event.outcome
    case "ip":
      return event.ip
    case "review":
      return reviewState(event)
    default:
      return undefined
  }
}

const list = (value: unknown) => (Array.isArray(value) ? value : [value])
const text = (value: unknown) => String(value ?? "").toLowerCase()
const isBlank = (value: unknown) =>
  value === undefined || value === null || value === ""

const TESTS: Record<string, (actual: unknown, value: unknown) => boolean> = {
  is: (actual, value) => actual === value,
  is_not: (actual, value) => actual !== value,
  is_any_of: (actual, value) => list(value).includes(actual),
  is_none_of: (actual, value) => !list(value).includes(actual),
  contains: (actual, value) => text(actual).includes(text(value)),
  not_contains: (actual, value) => !text(actual).includes(text(value)),
  starts_with: (actual, value) => text(actual).startsWith(text(value)),
  ends_with: (actual, value) => text(actual).endsWith(text(value)),
  empty: (actual) => isBlank(actual),
  not_empty: (actual) => !isBlank(actual),
}

/** A rule still being built (no value yet) constrains nothing. */
function isIncomplete(operator: string, value: unknown) {
  if (operator === "empty" || operator === "not_empty") return false
  if (isBlank(value)) return true
  return Array.isArray(value) && (value.length === 0 || value.some(isBlank))
}

/** null abstains: an unfinished rule must not satisfy an OR on its own. */
function evaluate(event: AuditEvent, node: FilterNode): boolean | null {
  if (node.type === "group") {
    const votes = node.rules
      .map((child) => evaluate(event, child))
      .filter((vote): vote is boolean => vote !== null)
    if (votes.length === 0) return null
    return node.combinator === "and"
      ? votes.every(Boolean)
      : votes.some(Boolean)
  }
  const test = TESTS[node.operator]
  if (!test || isIncomplete(node.operator, node.value)) return null
  const result = test(readPath(event, node.path), node.value)
  return node.negated ? !result : result
}

export const matchesAuditFilters = (event: AuditEvent, query: FilterNode) =>
  evaluate(event, query) ?? true

/** What a query means, ignoring unfinished chips: equal keys filter alike. */
export function activeRulesKey(query: FilterQuery) {
  return JSON.stringify([
    query.combinator,
    flattenFilterRules(query)
      .filter(
        (rule) =>
          isFilterRuleComplete(rule) && !isIncomplete(rule.operator, rule.value)
      )
      .map((rule) => [rule.path, rule.operator, rule.value, !!rule.negated]),
  ])
}

/** Adds a rule, replacing any top-level rule on the same field. */
export function withRule(
  query: FilterQuery,
  rule: { field: string; operator: string; value: string }
): FilterQuery {
  return {
    ...query,
    rules: [
      ...query.rules.filter(
        (node) => node.type !== "rule" || node.path[0] !== rule.field
      ),
      createFilterRule({
        id: `narrow-${rule.field}-${rule.value}`,
        path: [rule.field],
        operator: rule.operator,
        value: rule.value,
      }),
    ],
  }
}