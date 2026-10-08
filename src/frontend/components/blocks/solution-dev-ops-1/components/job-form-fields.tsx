import { type ReactNode } from "react"
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/reui/number-field"
import { cn } from "@/lib/utils"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

import { describeCron, nextFires, parseCron, validateSchedule } from "./cron"
import {
  ALERT_CHANNEL,
  CLUSTER_OPTIONS,
  CONCURRENCY_BY_ID,
  CONCURRENCY_OPTIONS,
  ENVIRONMENT_OPTIONS,
  formatDateTime,
  formatRelative,
  offsetOf,
  PERSON_OPTIONS,
  PRESET_BY_ID,
  REFERENCE_MS,
  SCHEDULE_PRESETS,
  SERVICE_OPTIONS,
  TIMEZONE_BY_ID,
  TIMEZONES,
  type JobDraft,
} from "./data"
import { UI_ICONS } from "./icons"
import { SECTION_TRIGGER } from "./job-overview-tab"
import { EnvironmentFace, OwnerFace, ServiceFace } from "./value-faces"

export type DraftErrors = Partial<
  Record<"name" | "command" | "schedule", string>
>

export function validateDraft(draft: JobDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.name.trim()) errors.name = "Name the job."
  if (!draft.command.trim()) errors.command = "Enter the command to run."
  const schedule = validateSchedule(
    draft.schedule,
    offsetOf(draft.timezone),
    REFERENCE_MS
  )
  if (!schedule.ok) errors.schedule = schedule.error
  return errors
}

/** The input each error belongs to, by the id suffix the fields give it. */
const ERROR_INPUT = {
  name: "name",
  command: "command",
  schedule: "cron",
} satisfies Record<keyof DraftErrors, string>

/** The Settings sections in render order; the job sheet opens them all first. */
export const SETTINGS_SECTIONS = ["schedule", "execution", "ownership"]

/** The Settings section that holds each error's field. */
const ERROR_SECTION = {
  name: "ownership",
  command: "execution",
  schedule: "schedule",
} satisfies Record<keyof DraftErrors, string>

/** The open sections plus every one holding an error, so a refused save shows it. */
export function withErrorSections(open: string[], errors: DraftErrors) {
  const failing = (Object.keys(errors) as (keyof DraftErrors)[]).map(
    (key) => ERROR_SECTION[key]
  )
  return SETTINGS_SECTIONS.filter(
    (section) => open.includes(section) || failing.includes(section)
  )
}

/** Resolves once every finite timed animation under the node has ended; the
 *  scroll-driven fade edges never finish, so they are left out. */
function animationsSettled(node: HTMLElement) {
  return Promise.all(
    node
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation.timeline === document.timeline &&
          animation.effect?.getComputedTiming().endTime !== Infinity
      )
      .map((animation) => animation.finished.catch(() => undefined))
  )
}

/** After a refused submit: focus the first invalid field in form order and
 *  scroll it into view inside the sheet body only, so the page never moves. */
export async function focusFirstError(
  scroller: HTMLElement | null,
  idPrefix: string,
  errors: DraftErrors
) {
  const selector = (Object.keys(errors) as (keyof DraftErrors)[])
    .map((key) => `#${idPrefix}-${ERROR_INPUT[key]}`)
    .join(", ")
  const input = scroller && selector ? scroller.querySelector(selector) : null
  if (!scroller || !(input instanceof HTMLElement)) return
  input.focus({ preventScroll: true })
  // A section the submit just opened is still growing: measure its full height.
  await animationsSettled(scroller)
  const field = input.closest<HTMLElement>("[data-slot=field]") ?? input
  const view = scroller.getBoundingClientRect()
  const box = field.getBoundingClientRect()
  // The body's own scroll padding keeps the field clear of its fade edges.
  const inset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop)
  const pad = Number.isFinite(inset) ? inset : 0
  const delta =
    box.top < view.top + pad
      ? box.top - view.top - pad
      : box.bottom > view.bottom - pad
        ? box.bottom - view.bottom + pad
        : 0
  if (delta === 0) return
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  scroller.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" })
}

/** The fields a save writes; pause state is not part of the form. */
export function sameDraft(a: JobDraft, b: JobDraft) {
  return (
    a.name === b.name &&
    a.command === b.command &&
    a.schedule === b.schedule &&
    a.timezone === b.timezone &&
    a.service === b.service &&
    a.cluster === b.cluster &&
    a.environment === b.environment &&
    a.ownerId === b.ownerId &&
    a.concurrency === b.concurrency &&
    a.timeoutMin === b.timeoutMin &&
    a.retries === b.retries &&
    a.notifyOnFailure === b.notifyOnFailure
  )
}

type FieldsProps = {
  idPrefix: string
  values: JobDraft
  onChange: (patch: Partial<JobDraft>) => void
}

type FormProps = FieldsProps & {
  /** False until the first submit: before it, no field shows an error. */
  showErrors: boolean
}

/** The cron line before a submit: a neutral reminder, never an error. */
const CRON_HINT = "Five fields: minute hour day month weekday"

/** One row per upcoming fire: absolute time, then how far away it is. */
export function FireList({ fires }: { fires: number[] }) {
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {fires.map((at) => (
        <li key={at} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate tabular-nums">
            {formatDateTime(at)}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatRelative(at)}
          </span>
        </li>
      ))}
    </ol>
  )
}

const PRESET_ITEMS = SCHEDULE_PRESETS.map((preset) => ({
  value: preset.id,
  label: preset.label,
}))

/** Joined presets from sm up; below it six cannot fit, so one Select takes
 *  over. A cron no preset matches leaves both empty, read as Custom. */
function SchedulePresets({
  presetId,
  onPick,
}: {
  presetId: string | null
  onPick: (id: string | null | undefined) => void
}) {
  return (
    <>
      <ToggleGroup
        multiple={false}
        value={presetId ? [presetId] : []}
        onValueChange={(value: string[]) => onPick(value[0])}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Schedule presets"
        className="hidden w-full sm:flex"
      >
        {SCHEDULE_PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset.id}
            value={preset.id}
            className="text-muted-foreground data-pressed:text-foreground flex-1"
          >
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="sm:hidden">
        <Select value={presetId} items={PRESET_ITEMS} onValueChange={onPick}>
          <SelectTrigger aria-label="Schedule preset" className="w-full">
            <SelectValue placeholder="Custom" />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            <SelectGroup>
              {SCHEDULE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

/** Presets, the cron input with its live description, timezone and preview. */
export function ScheduleFields({
  idPrefix,
  values,
  onChange,
  showErrors,
}: FormProps) {
  // Parsed apart from validated: a well-formed cron that never fires still
  // reads as a sentence, and only the submit calls it an error.
  const parsed = parseCron(values.schedule)
  const result = validateSchedule(
    values.schedule,
    offsetOf(values.timezone),
    REFERENCE_MS
  )
  const error = showErrors && !result.ok ? result.error : undefined
  const lineId = `${idPrefix}-cron-line`
  const zone = TIMEZONE_BY_ID.get(values.timezone)
  const matchingPreset = SCHEDULE_PRESETS.find(
    (preset) => preset.cron === values.schedule.trim()
  )
  const fires = result.ok
    ? nextFires(result.cron, offsetOf(values.timezone), REFERENCE_MS, 3)
    : []

  return (
    <FieldGroup className="gap-4">
      <SchedulePresets
        presetId={matchingPreset?.id ?? null}
        onPick={(id) => {
          const preset = id ? PRESET_BY_ID.get(id) : undefined
          if (preset) onChange({ schedule: preset.cron })
        }}
      />

      <Field data-invalid={!!error || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-cron`}>Cron Expression</FieldLabel>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            {UI_ICONS.schedule}
          </InputGroupAddon>
          <InputGroupInput
            id={`${idPrefix}-cron`}
            value={values.schedule}
            onChange={(event) => onChange({ schedule: event.target.value })}
            className="font-mono"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!!error || undefined}
            aria-describedby={lineId}
            placeholder="0 2 * * *"
          />
        </InputGroup>
        {error ? (
          <FieldError id={lineId}>{error}</FieldError>
        ) : (
          <FieldDescription id={lineId}>
            {parsed.ok ? (
              <>
                {describeCron(parsed.cron)} {zone?.short}
              </>
            ) : (
              CRON_HINT
            )}
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-timezone`}>Timezone</FieldLabel>
        <Select
          value={values.timezone}
          items={TIMEZONES}
          onValueChange={(next) => {
            const match = TIMEZONES.find((item) => item.value === next)
            if (match) onChange({ timezone: match.value })
          }}
        >
          <SelectTrigger id={`${idPrefix}-timezone`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            <SelectGroup>
              {TIMEZONES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <section className="flex flex-col gap-2" aria-live="polite">
        <h3 className="text-muted-foreground text-xs font-medium">
          Next 3 Runs
        </h3>
        {fires.length > 0 ? (
          <FireList fires={fires} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {parsed.ok
              ? "No upcoming runs."
              : "Enter a schedule to preview runs."}
          </p>
        )}
      </section>
    </FieldGroup>
  )
}

function OwnerSelect({ idPrefix, values, onChange }: FieldsProps) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-owner`}>Owner</FieldLabel>
      <Select
        value={values.ownerId}
        items={PERSON_OPTIONS}
        onValueChange={(next) => {
          const match = PERSON_OPTIONS.find((item) => item.value === next)
          if (match) onChange({ ownerId: match.value })
        }}
      >
        <SelectTrigger id={`${idPrefix}-owner`} className="w-full">
          <SelectValue>
            <OwnerFace ownerId={values.ownerId} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {PERSON_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <OwnerFace ownerId={option.value} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function ServiceSelect({ idPrefix, values, onChange }: FieldsProps) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-service`}>Service</FieldLabel>
      <Select
        value={values.service}
        items={SERVICE_OPTIONS}
        onValueChange={(next) => {
          const match = SERVICE_OPTIONS.find((item) => item.value === next)
          if (match) onChange({ service: match.value })
        }}
      >
        <SelectTrigger id={`${idPrefix}-service`} className="w-full">
          <SelectValue>
            <ServiceFace service={values.service} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {SERVICE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <ServiceFace service={option.value} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function ClusterSelect({ idPrefix, values, onChange }: FieldsProps) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-cluster`}>Cluster</FieldLabel>
      <Select
        value={values.cluster}
        items={CLUSTER_OPTIONS}
        onValueChange={(next) => {
          const match = CLUSTER_OPTIONS.find((item) => item.value === next)
          if (match) onChange({ cluster: match.value })
        }}
      >
        <SelectTrigger id={`${idPrefix}-cluster`} className="w-full">
          <SelectValue>
            <span className="truncate font-mono">{values.cluster}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {CLUSTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="font-mono">{option.label}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function EnvironmentSelect({ idPrefix, values, onChange }: FieldsProps) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-environment`}>Environment</FieldLabel>
      <Select
        value={values.environment}
        items={ENVIRONMENT_OPTIONS}
        onValueChange={(next) => {
          const match = ENVIRONMENT_OPTIONS.find((item) => item.value === next)
          if (match) onChange({ environment: match.value })
        }}
      >
        <SelectTrigger id={`${idPrefix}-environment`} className="w-full">
          <SelectValue>
            <EnvironmentFace environment={values.environment} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {ENVIRONMENT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <EnvironmentFace environment={option.value} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

/** One collapsible Settings section; its region is named by the header. */
function SettingsSection({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: ReactNode
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className={cn(SECTION_TRIGGER, "font-medium")}>
        {title}
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  )
}

/** Create lays the form flat; edit splits it into sections the sheet opens. */
type JobFormFieldsProps = FormProps &
  (
    | { variant: "create" }
    | {
        variant: "edit"
        openSections: string[]
        onOpenSectionsChange: (value: string[]) => void
      }
  )

/** The job form, shared by the New Job sheet and the job sheet's Settings tab.
 *  Errors wait for the owner's first submit, then follow every edit. */
export function JobFormFields(props: JobFormFieldsProps) {
  const { idPrefix, values, onChange, showErrors } = props
  const errors: DraftErrors = showErrors ? validateDraft(values) : {}
  const nameErrorId = `${idPrefix}-name-error`
  const commandErrorId = `${idPrefix}-command-error`
  const shared = { idPrefix, values, onChange }

  const nameField = (
    <Field data-invalid={!!errors.name || undefined}>
      <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
      <Input
        id={`${idPrefix}-name`}
        value={values.name}
        onChange={(event) => onChange({ name: event.target.value })}
        aria-invalid={!!errors.name || undefined}
        aria-describedby={errors.name ? nameErrorId : undefined}
        placeholder="Nightly ledger reconciliation"
      />
      {errors.name ? (
        <FieldError id={nameErrorId}>{errors.name}</FieldError>
      ) : null}
    </Field>
  )

  const commandField = (
    <Field data-invalid={!!errors.command || undefined}>
      <FieldLabel htmlFor={`${idPrefix}-command`}>Command</FieldLabel>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          {UI_ICONS.terminal}
        </InputGroupAddon>
        <InputGroupInput
          id={`${idPrefix}-command`}
          value={values.command}
          onChange={(event) => onChange({ command: event.target.value })}
          className="font-mono"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!!errors.command || undefined}
          aria-describedby={errors.command ? commandErrorId : undefined}
          placeholder="harbor run payments-api -- jobs:sync"
        />
      </InputGroup>
      {errors.command ? (
        <FieldError id={commandErrorId}>{errors.command}</FieldError>
      ) : null}
    </Field>
  )

  if (props.variant === "create") {
    return (
      <>
        {nameField}
        {commandField}
        <FieldSet>
          <FieldLegend variant="label">Schedule</FieldLegend>
          <ScheduleFields {...shared} showErrors={showErrors} />
        </FieldSet>
        <div className="grid gap-4 min-[360px]:grid-cols-2">
          <ServiceSelect {...shared} />
          <ClusterSelect {...shared} />
          <EnvironmentSelect {...shared} />
          <OwnerSelect {...shared} />
        </div>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${idPrefix}-enabled`}>
              Start enabled
            </FieldLabel>
            <FieldDescription>Runs on schedule once created.</FieldDescription>
          </FieldContent>
          <Switch
            id={`${idPrefix}-enabled`}
            size="sm"
            checked={values.enabled}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
          />
        </Field>
      </>
    )
  }

  const concurrency = CONCURRENCY_BY_ID.get(values.concurrency)

  return (
    <Accordion
      multiple
      value={props.openSections}
      onValueChange={props.onOpenSectionsChange}
    >
      <SettingsSection value="schedule" title="Schedule">
        <ScheduleFields {...shared} showErrors={showErrors} />
      </SettingsSection>

      <SettingsSection value="execution" title="Execution">
        <FieldGroup className="gap-4">
          {commandField}
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-concurrency`}>
              Concurrency
            </FieldLabel>
            <Select
              value={values.concurrency}
              items={CONCURRENCY_OPTIONS}
              onValueChange={(next) => {
                const match = CONCURRENCY_OPTIONS.find(
                  (item) => item.value === next
                )
                if (match) onChange({ concurrency: match.value })
              }}
            >
              <SelectTrigger id={`${idPrefix}-concurrency`} className="w-full">
                <SelectValue>
                  <span>{concurrency?.label}</span>
                  <span className="text-muted-foreground truncate">
                    {concurrency?.description}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" alignItemWithTrigger={false}>
                <SelectGroup>
                  {CONCURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span>{option.label}</span>
                      <span className="text-muted-foreground">
                        {option.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 min-[360px]:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-timeout`}>
                Timeout (min)
              </FieldLabel>
              <NumberField
                id={`${idPrefix}-timeout`}
                value={values.timeoutMin}
                min={1}
                max={240}
                onValueChange={(next: number | null) =>
                  onChange({ timeoutMin: next ?? 1 })
                }
              >
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput className="tabular-nums" />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-retries`}>Retries</FieldLabel>
              <NumberField
                id={`${idPrefix}-retries`}
                value={values.retries}
                min={0}
                max={10}
                onValueChange={(next: number | null) =>
                  onChange({ retries: next ?? 0 })
                }
              >
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput className="tabular-nums" />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            </Field>
          </div>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`${idPrefix}-alerts`}>
                Alert on failure
              </FieldLabel>
              <FieldDescription>Pages {ALERT_CHANNEL}.</FieldDescription>
            </FieldContent>
            <Switch
              id={`${idPrefix}-alerts`}
              size="sm"
              checked={values.notifyOnFailure}
              onCheckedChange={(checked) =>
                onChange({ notifyOnFailure: checked })
              }
            />
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSection value="ownership" title="Ownership">
        <FieldGroup className="gap-4">
          {nameField}
          <div className="grid gap-4 min-[360px]:grid-cols-2">
            <OwnerSelect {...shared} />
            <ServiceSelect {...shared} />
            <ClusterSelect {...shared} />
            <EnvironmentSelect {...shared} />
          </div>
        </FieldGroup>
      </SettingsSection>
    </Accordion>
  )
}