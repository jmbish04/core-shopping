"use client"

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Badge, badgeVariants } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { FieldLabel } from "@/components/ui/field"
import {
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  DEFAULT_RUN_SETTINGS,
  PRIORITY_OPTIONS,
  RETRY_POLICY_OPTIONS,
  RUN_OWNERS,
  RUN_TIMESTAMPS,
  STATUS_OPTIONS,
  TOAST_SUCCESS_ICON,
  type RunOwner,
  type RunSelectOption,
  type RunSettingsValue,
} from "./data"
import { EditableDetailRow } from "./editable-detail-row"
import { CircleCheckIcon, AlertTriangleIcon, CircleDotIcon, ZapIcon, RefreshCwIcon, BellIcon, HashIcon, ClockIcon } from "lucide-react"

const FORM_ID = "run-settings"
const SAVE_DELAY_MS = 1800

type EditableRowId = keyof RunSettingsValue

function cloneRunSettingField<TKey extends keyof RunSettingsValue>(
  value: RunSettingsValue[TKey]
): RunSettingsValue[TKey] {
  if (Array.isArray(value)) {
    return [...value] as RunSettingsValue[TKey]
  }

  return value
}

function cloneRunSettings(value: RunSettingsValue): RunSettingsValue {
  return {
    ...value,
    ownerIds: [...value.ownerIds],
  }
}

function getOptionLabel<TValue extends string>(
  options: RunSelectOption<TValue>[],
  value: TValue
) {
  return options.find((option) => option.value === value)?.label ?? value
}

function getOwners(ids: string[]) {
  const selectedIds = new Set(ids)

  return RUN_OWNERS.filter((owner) => selectedIds.has(owner.id))
}

function DetailValue({
  icon,
  children,
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "text-foreground flex min-h-8 min-w-0 items-center gap-2 text-sm font-medium",
        className
      )}
    >
      {icon ? (
        <span className="text-muted-foreground flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

function StatusBadge({ status }: { status: RunSettingsValue["status"] }) {
  if (status === "completed") {
    return (
      <Badge variant="success-light">
        <CircleCheckIcon aria-hidden="true" />
        Completed
      </Badge>
    )
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive-light">
        <AlertTriangleIcon aria-hidden="true" />
        Failed
      </Badge>
    )
  }

  return (
    <Badge variant="info-light">
      <CircleDotIcon aria-hidden="true" />
      Running
    </Badge>
  )
}

function PriorityValue({
  priority,
}: {
  priority: RunSettingsValue["priority"]
}) {
  return (
    <DetailValue
      icon={
        <ZapIcon className="size-4" aria-hidden="true" />
      }
    >
      {getOptionLabel(PRIORITY_OPTIONS, priority)}
    </DetailValue>
  )
}

function RetryPolicyValue({
  retryPolicy,
}: {
  retryPolicy: RunSettingsValue["retryPolicy"]
}) {
  return (
    <DetailValue
      icon={
        <RefreshCwIcon className="size-4" aria-hidden="true" />
      }
    >
      {getOptionLabel(RETRY_POLICY_OPTIONS, retryPolicy)}
    </DetailValue>
  )
}

function NotifyValue({
  notifyOnFailure,
}: {
  notifyOnFailure: RunSettingsValue["notifyOnFailure"]
}) {
  return (
    <DetailValue
      icon={
        <BellIcon className="size-4" aria-hidden="true" />
      }
    >
      {notifyOnFailure ? "Notify owners" : "Silent"}
    </DetailValue>
  )
}

function SelectEditor<TValue extends string>({
  id,
  value,
  options,
  disabled,
  renderValue,
  renderOption,
  onValueChange,
}: {
  id: string
  value: TValue
  options: RunSelectOption<TValue>[]
  disabled: boolean
  renderValue?: (value: TValue) => ReactNode
  renderOption?: (option: RunSelectOption<TValue>) => ReactNode
  onValueChange: (value: TValue) => void
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
    >
      <SelectTrigger
        id={id}
        size="sm"
        disabled={disabled}
        className="h-8 min-w-0 flex-1 border-0 px-2.5 shadow-none focus:ring-0 focus-visible:ring-0"
      >
        <SelectValue>
          {renderValue ? renderValue(value) : getOptionLabel(options, value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-(--anchor-width)">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {renderOption ? renderOption(option) : option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function OwnersCombobox({
  selectedOwnerIds,
  disabled,
  onValueChange,
}: {
  selectedOwnerIds: string[]
  disabled: boolean
  onValueChange: (ownerIds: string[]) => void
}) {
  const anchor = useComboboxAnchor()
  const selectedOwners = getOwners(selectedOwnerIds)

  return (
    <Combobox
      multiple
      items={RUN_OWNERS}
      value={selectedOwners}
      disabled={disabled}
      itemToStringValue={(owner: RunOwner) => owner.name}
      isItemEqualToValue={(item, value) => item.id === value.id}
      onValueChange={(owners) => onValueChange(owners.map((owner) => owner.id))}
    >
      <ComboboxChips
        ref={anchor}
        className="h-auto! min-h-8! flex-1 flex-wrap! items-center gap-1.5 overflow-visible border-0 bg-transparent px-2 py-1! shadow-none ring-0 focus-within:ring-0 has-data-[slot=combobox-chip]:pl-1"
      >
        <ComboboxValue>
          {(owners: RunOwner[]) => (
            <Fragment>
              {owners.map((owner) => (
                <ComboboxChip
                  key={owner.id}
                  showRemove={true}
                  className={cn(
                    badgeVariants({ variant: "outline" }),
                    "min-w-0 gap-1.5"
                  )}
                >
                  <Avatar className="size-4">
                    {owner.avatarSrc ? (
                      <AvatarImage src={owner.avatarSrc} alt={owner.name} />
                    ) : null}
                    <AvatarFallback className="text-[8px]">
                      {owner.initials}
                    </AvatarFallback>
                  </Avatar>
                  {owner.name}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                disabled={disabled}
                placeholder=""
                className="min-w-20 flex-1 bg-transparent"
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent
        anchor={anchor}
        className="max-w-(--anchor-width) min-w-(--anchor-width)"
      >
        <ComboboxEmpty>No owners found.</ComboboxEmpty>
        <ComboboxList>
          {(owner) => (
            <ComboboxItem key={owner.id} value={owner}>
              <Item size="xs" className="p-0">
                <Avatar className="size-6">
                  {owner.avatarSrc ? (
                    <AvatarImage src={owner.avatarSrc} alt={owner.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {owner.initials}
                  </AvatarFallback>
                </Avatar>
                <ItemContent>
                  <ItemTitle className="whitespace-nowrap">
                    {owner.name}
                  </ItemTitle>
                  <ItemDescription>{owner.role}</ItemDescription>
                </ItemContent>
              </Item>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function OwnerList({ owners }: { owners: RunOwner[] }) {
  return (
    <span className="flex min-h-6 min-w-0 flex-wrap items-center gap-1.5 overflow-visible">
      {owners.map((owner) => (
        <Badge key={owner.id} variant="outline" className="min-w-0 gap-1.5">
          <Avatar className="size-3.5">
            {owner.avatarSrc ? (
              <AvatarImage src={owner.avatarSrc} alt={owner.name} />
            ) : null}
            <AvatarFallback className="text-[8px]">
              {owner.initials}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-32 truncate">{owner.name}</span>
        </Badge>
      ))}
    </span>
  )
}

export function RunFacts() {
  const [settings, setSettings] = useState<RunSettingsValue>(() =>
    cloneRunSettings(DEFAULT_RUN_SETTINGS)
  )
  const [draft, setDraft] = useState<RunSettingsValue>(() =>
    cloneRunSettings(DEFAULT_RUN_SETTINGS)
  )
  const [editingRows, setEditingRows] = useState<EditableRowId[]>([])
  const [savingRows, setSavingRows] = useState<EditableRowId[]>([])
  const saveTimersRef = useRef<number[]>([])

  const owners = getOwners(settings.ownerIds)
  const hasEditingRows = editingRows.length > 0
  const isSaving = savingRows.length > 0

  useEffect(() => {
    return () => {
      saveTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  function beginRowEditing(rowId: EditableRowId) {
    if (isSaving) {
      return
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      [rowId]: cloneRunSettingField(settings[rowId]),
    }))
    setEditingRows((currentRows) =>
      currentRows.includes(rowId) ? currentRows : [...currentRows, rowId]
    )
  }

  function cancelRowEditing(rowId: EditableRowId) {
    if (isSaving) {
      return
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      [rowId]: cloneRunSettingField(settings[rowId]),
    }))
    setEditingRows((currentRows) =>
      currentRows.filter((currentRow) => currentRow !== rowId)
    )
  }

  function updateDraft<TKey extends keyof RunSettingsValue>(
    key: TKey,
    value: RunSettingsValue[TKey]
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  function saveRowEditing(rowId: EditableRowId) {
    if (isSaving) {
      return
    }

    const nextValue = cloneRunSettingField(draft[rowId])

    setSavingRows([rowId])

    const timer = window.setTimeout(() => {
      setSettings((currentSettings) => ({
        ...currentSettings,
        [rowId]: nextValue,
      }))
      setEditingRows((currentRows) =>
        currentRows.filter((currentRow) => currentRow !== rowId)
      )
      setSavingRows([])
      saveTimersRef.current = saveTimersRef.current.filter(
        (currentTimer) => currentTimer !== timer
      )

      toast.success("Run setting saved", {
        description: "RUN-4822 applies it from the next step on.",
        icon: TOAST_SUCCESS_ICON,
      })
    }, SAVE_DELAY_MS)

    saveTimersRef.current = [...saveTimersRef.current, timer]
  }

  function saveAllEditing() {
    if (!hasEditingRows || isSaving) {
      return
    }

    const rowIds = [...editingRows]
    const nextSettings = cloneRunSettings(draft)

    setSavingRows(rowIds)

    const timer = window.setTimeout(() => {
      setSettings(nextSettings)
      setEditingRows([])
      setSavingRows([])
      saveTimersRef.current = saveTimersRef.current.filter(
        (currentTimer) => currentTimer !== timer
      )

      toast.success("Run settings saved", {
        description: "RUN-4822 applies them from the next step on.",
        icon: TOAST_SUCCESS_ICON,
      })
    }, SAVE_DELAY_MS)

    saveTimersRef.current = [...saveTimersRef.current, timer]
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveAllEditing()
  }

  function getEditableRowProps(rowId: EditableRowId) {
    return {
      editing: editingRows.includes(rowId),
      actionsDisabled: isSaving,
      saving: savingRows.includes(rowId),
      onEdit: () => beginRowEditing(rowId),
      onCancel: () => cancelRowEditing(rowId),
      onSave: () => saveRowEditing(rowId),
    }
  }

  return (
    <TooltipProvider delay={180}>
      <form id={FORM_ID} onSubmit={handleSubmit} className="w-full">
        <Frame stacked spacing="sm" className="group w-full">
          <FrameHeader>
            <div className="flex min-w-0 flex-col gap-0.5">
              <FrameTitle>Run Settings</FrameTitle>
              <FrameDescription className="hidden truncate sm:block">
                Applied to this run's retries and notifications.
              </FrameDescription>
            </div>
          </FrameHeader>

          <FramePanel className="p-0">
            <EditableDetailRow
              label="Status"
              {...getEditableRowProps("status")}
              display={<StatusBadge status={settings.status} />}
              renderEdit={(active) => (
                <SelectEditor
                  id="run-settings-status"
                  value={draft.status}
                  options={STATUS_OPTIONS}
                  disabled={!active}
                  renderValue={(value) => <StatusBadge status={value} />}
                  renderOption={(option) => (
                    <StatusBadge status={option.value} />
                  )}
                  onValueChange={(value) => updateDraft("status", value)}
                />
              )}
            />
            <Separator />

            <EditableDetailRow
              label="Priority"
              {...getEditableRowProps("priority")}
              display={<PriorityValue priority={settings.priority} />}
              renderEdit={(active) => (
                <SelectEditor
                  id="run-settings-priority"
                  value={draft.priority}
                  options={PRIORITY_OPTIONS}
                  disabled={!active}
                  renderValue={(value) => <PriorityValue priority={value} />}
                  renderOption={(option) => (
                    <PriorityValue priority={option.value} />
                  )}
                  onValueChange={(value) => updateDraft("priority", value)}
                />
              )}
            />
            <Separator />

            <EditableDetailRow
              label="Owners"
              align="start"
              hint="Notified on failures and approvals."
              {...getEditableRowProps("ownerIds")}
              display={<OwnerList owners={owners} />}
              renderEdit={(active) => (
                <OwnersCombobox
                  selectedOwnerIds={draft.ownerIds}
                  disabled={!active}
                  onValueChange={(ownerIds) =>
                    updateDraft("ownerIds", ownerIds)
                  }
                />
              )}
            />
            <Separator />

            <EditableDetailRow
              label="Retry Policy"
              {...getEditableRowProps("retryPolicy")}
              display={<RetryPolicyValue retryPolicy={settings.retryPolicy} />}
              renderEdit={(active) => (
                <SelectEditor
                  id="run-settings-retry-policy"
                  value={draft.retryPolicy}
                  options={RETRY_POLICY_OPTIONS}
                  disabled={!active}
                  renderValue={(value) => (
                    <RetryPolicyValue retryPolicy={value} />
                  )}
                  renderOption={(option) => (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{option.label}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {option.description}
                      </span>
                    </span>
                  )}
                  onValueChange={(value) => updateDraft("retryPolicy", value)}
                />
              )}
            />
            <Separator />

            <EditableDetailRow
              label="Max Retries"
              hint="Step 3 has used 2 of 3 retries."
              {...getEditableRowProps("maxRetries")}
              display={
                <DetailValue
                  icon={
                    <HashIcon className="size-4" aria-hidden="true" />
                  }
                >
                  {settings.maxRetries} per step
                </DetailValue>
              }
              renderEdit={(active) => (
                <>
                  <InputGroupAddon>
                    <InputGroupText>
                      <HashIcon className="text-muted-foreground size-4" aria-hidden="true" />
                    </InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="run-settings-max-retries"
                    value={draft.maxRetries}
                    disabled={!active}
                    inputMode="numeric"
                    onChange={(event) =>
                      updateDraft("maxRetries", event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        saveRowEditing("maxRetries")
                      }

                      if (event.key === "Escape") {
                        event.preventDefault()
                        cancelRowEditing("maxRetries")
                      }
                    }}
                    className="h-8 min-w-0 bg-transparent text-left text-sm font-medium focus-visible:ring-0!"
                  />
                </>
              )}
            />
            <Separator />

            <EditableDetailRow
              label="On Failure"
              {...getEditableRowProps("notifyOnFailure")}
              display={
                <NotifyValue notifyOnFailure={settings.notifyOnFailure} />
              }
              renderEdit={(active) => (
                <div className="flex h-8 min-w-0 flex-1 items-center justify-between gap-3 px-2.5">
                  <FieldLabel htmlFor="run-settings-notify">
                    <NotifyValue notifyOnFailure={draft.notifyOnFailure} />
                  </FieldLabel>
                  <Switch
                    id="run-settings-notify"
                    size="sm"
                    checked={draft.notifyOnFailure}
                    disabled={!active}
                    onCheckedChange={(checked) =>
                      updateDraft("notifyOnFailure", checked)
                    }
                  />
                </div>
              )}
            />
            <Separator />

            <EditableDetailRow
              label="Started"
              display={
                <DetailValue
                  icon={
                    <ClockIcon className="size-4" aria-hidden="true" />
                  }
                >
                  {RUN_TIMESTAMPS.started}
                </DetailValue>
              }
            />
            <Separator />

            <EditableDetailRow
              label="Last Activity"
              display={
                <DetailValue
                  icon={
                    <CircleCheckIcon className="size-4" aria-hidden="true" />
                  }
                >
                  {RUN_TIMESTAMPS.lastActivity}
                </DetailValue>
              }
            />
          </FramePanel>
        </Frame>
      </form>
    </TooltipProvider>
  )
}