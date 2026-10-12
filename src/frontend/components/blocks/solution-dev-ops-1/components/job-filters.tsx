import { type ReactNode } from "react"
import { type FilterOperatorLabels } from "@/components/reui/filters/filters-operators"
import { createFilterQuery } from "@/components/reui/filters/filters-query"
import {
  type FilterField,
  type FilterNode,
  type FilterQuery,
  type FilterValueDisplayContext,
} from "@/components/reui/filters/filters-types"
import {
  FREQUENCY_OPTIONS,
  frequencyOfJob,
  PERSON_OPTIONS,
  RUN_STATUS,
  RUN_STATUS_OPTIONS,
  SERVICE_OPTIONS,
  SERVICES,
  TEAM_OPTIONS,
  teamOf,
  type CronJob,
  type PersonId,
  type RunStatus,
  type ServiceId,
} from "./data"
import {
  FirstFacePlus,
  OwnerAvatar,
  OwnerFace,
  RunStatusFace,
  ServiceFace,
} from "./value-faces"
import { LayersIcon, UserRoundIcon, RepeatIcon, ActivityIcon, UsersIcon } from "lucide-react"

export const EMPTY_FILTER_QUERY: FilterQuery = createFilterQuery()

/** Short operator words keep the dropdown's operator column narrow. */
export const COMPACT_OPERATORS: FilterOperatorLabels = {
  is_any_of: "any of",
  is_none_of: "none of",
  empty: "empty",
  not_empty: "not empty",
}

// prettier-ignore
const FIELD_ICONS = {
  service:   <LayersIcon className="size-4" aria-hidden="true" />,
  owner:     <UserRoundIcon className="size-4" aria-hidden="true" />,
  frequency: <RepeatIcon className="size-4" aria-hidden="true" />,
  lastRun:   <ActivityIcon className="size-4" aria-hidden="true" />,
  team:      <UsersIcon className="size-4" aria-hidden="true" />,
}

/** Option rows show the value's face; a badge face stands in for its label,
 *  which stays for search and the accessible name. */
const FACE_MENU =
  "[&_[data-slot=filter-menu-icon]]:text-foreground [&_[data-slot=filter-menu-icon]+span]:sr-only [&_[role=option]]:min-h-8"

const faceValue = (face: (value: string) => ReactNode, empty: string) =>
  function FaceValue({ values }: FilterValueDisplayContext) {
    return (
      <FirstFacePlus values={values.map(String)} face={face} empty={empty} />
    )
  }

const isService = (value: string): value is ServiceId => value in SERVICES
const isPerson = (value: string): value is PersonId =>
  PERSON_OPTIONS.some((option) => option.value === value)
const isRunStatus = (value: string): value is RunStatus => value in RUN_STATUS

export const JOB_FILTER_FIELDS: FilterField[] = [
  {
    id: "service",
    label: "Service",
    icon: FIELD_ICONS.service,
    type: "select",
    searchable: true,
    options: SERVICE_OPTIONS.map((option) => ({
      ...option,
      icon: SERVICES[option.value].icon,
    })),
    renderValue: faceValue(
      (value) => (isService(value) ? <ServiceFace service={value} /> : value),
      "any service"
    ),
  },
  {
    id: "owner",
    label: "Owner",
    icon: FIELD_ICONS.owner,
    type: "select",
    searchable: true,
    options: PERSON_OPTIONS.map((option) => ({
      ...option,
      icon: <OwnerAvatar ownerId={option.value} />,
    })),
    renderValue: faceValue(
      (value) => (isPerson(value) ? <OwnerFace ownerId={value} /> : value),
      "anyone"
    ),
  },
  {
    id: "frequency",
    label: "Frequency",
    icon: FIELD_ICONS.frequency,
    type: "select",
    options: FREQUENCY_OPTIONS,
  },
  {
    id: "lastRun",
    label: "Last Run",
    icon: FIELD_ICONS.lastRun,
    type: "select",
    className: FACE_MENU,
    options: RUN_STATUS_OPTIONS.map((option) => ({
      ...option,
      icon: (
        <span aria-hidden="true">
          <RunStatusFace status={option.value} />
        </span>
      ),
    })),
    renderValue: faceValue(
      (value) =>
        isRunStatus(value) ? <RunStatusFace status={value} /> : value,
      "any status"
    ),
  },
  {
    id: "team",
    label: "Team",
    icon: FIELD_ICONS.team,
    type: "select",
    options: TEAM_OPTIONS,
  },
]

// ── Evaluation ──

function readJobPath(job: CronJob, path: string[]): unknown {
  switch (path[0]) {
    case "service":
      return job.service
    case "owner":
      return job.ownerId
    case "frequency":
      return frequencyOfJob(job)
    case "lastRun":
      return job.runs[0]?.status
    case "team":
      return teamOf(job)
    default:
      return undefined
  }
}

const list = (value: unknown) => (Array.isArray(value) ? value : [value])
const isBlank = (value: unknown) =>
  value === undefined || value === null || value === ""

const TESTS: Record<string, (actual: unknown, value: unknown) => boolean> = {
  is: (actual, value) => actual === value,
  is_not: (actual, value) => actual !== value,
  is_any_of: (actual, value) => list(value).includes(actual),
  is_none_of: (actual, value) => !list(value).includes(actual),
  empty: (actual) => isBlank(actual),
  not_empty: (actual) => !isBlank(actual),
}

/** A rule still being built (no value picked yet) constrains nothing. */
function isIncomplete(operator: string, value: unknown) {
  if (operator === "empty" || operator === "not_empty") return false
  if (isBlank(value)) return true
  return Array.isArray(value) && value.length === 0
}

/** null abstains: an unfinished rule must not satisfy an OR on its own. */
function evaluate(job: CronJob, node: FilterNode): boolean | null {
  if (node.type === "group") {
    const votes = node.rules
      .map((child) => evaluate(job, child))
      .filter((vote): vote is boolean => vote !== null)
    if (votes.length === 0) return null
    return node.combinator === "and"
      ? votes.every(Boolean)
      : votes.some(Boolean)
  }
  const test = TESTS[node.operator]
  if (!test || isIncomplete(node.operator, node.value)) return null
  const result = test(readJobPath(job, node.path), node.value)
  return node.negated ? !result : result
}

export const matchesJobFilters = (job: CronJob, query: FilterNode) =>
  evaluate(job, query) ?? true