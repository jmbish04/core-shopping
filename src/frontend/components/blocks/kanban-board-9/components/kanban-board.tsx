import { useState, type ComponentProps, type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import {
  Kanban,
  KanbanBoard as KanbanBoardPrimitive,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/reui/kanban"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "@/lib/utils"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Item, ItemMedia } from "@/components/ui/item"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import {
  BOARD_DESCRIPTION,
  BOARD_TITLE,
  INITIAL_CANDIDATES,
  RECRUITING_COLUMNS,
  SCORECARD_STATE_META,
  type RecruitingCandidate,
  type RecruitingColumn,
} from "./data"
import { FilterIcon, UserPlusIcon, MapPinIcon, CalendarClockIcon, CircleDollarSignIcon, PlusIcon, GripVerticalIcon } from "lucide-react"

const RECRUITING_COLUMN_BY_ID = new Map(
  RECRUITING_COLUMNS.map((column) => [column.id, column])
)

const MATCH_PROGRESS_CLASSNAME: Record<
  RecruitingCandidate["matchTone"],
  string
> = {
  calibrated: "**:data-[slot=progress-indicator]:bg-violet-500",
  exceptional: "**:data-[slot=progress-indicator]:bg-emerald-500",
  risk: "**:data-[slot=progress-indicator]:bg-amber-500",
  strong: "**:data-[slot=progress-indicator]:bg-sky-500",
}

const MATCH_TEXT_CLASSNAME: Record<RecruitingCandidate["matchTone"], string> = {
  calibrated: "text-violet-600 dark:text-violet-400",
  exceptional: "text-emerald-600 dark:text-emerald-400",
  risk: "text-amber-600 dark:text-amber-400",
  strong: "text-sky-600 dark:text-sky-400",
}

function BoardScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className="relative w-full min-w-0 pb-3"
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 w-full rounded-lg transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          className="w-max min-w-full"
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        data-slot="scroll-area-scrollbar"
        data-orientation="horizontal"
        orientation="horizontal"
        className="flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent"
      >
        <ScrollAreaPrimitive.Thumb
          data-slot="scroll-area-thumb"
          className="bg-foreground/15 relative flex-1 rounded-full"
        />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function PipelineToolbar() {
  return (
    <header className="px-1" aria-label="Recruiting pipeline toolbar">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-sm leading-5 font-semibold">
            {BOARD_TITLE}
          </h2>
          <p className="text-muted-foreground line-clamp-1 text-xs leading-4">
            {BOARD_DESCRIPTION}
          </p>
        </div>

        <div
          className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end"
          role="group"
          aria-label="Recruiting pipeline actions"
        >
          <Button type="button" variant="outline" size="sm">
            <FilterIcon data-icon="inline-start" aria-hidden="true" />
            Filters
          </Button>

          <Button type="button" size="sm">
            <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
            Add candidate
          </Button>
        </div>
      </div>
    </header>
  )
}

function CandidateMetaRow({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-h-5 min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-2 text-sm leading-5">
      <Item
        render={<span />}
        className="text-muted-foreground flex size-4 items-center justify-center border-0 p-0"
        aria-hidden="true"
      >
        <ItemMedia variant="icon" className="size-auto">
          {icon}
        </ItemMedia>
      </Item>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function CandidateMatch({ candidate }: { candidate: RecruitingCandidate }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm leading-none font-medium">
          Match score
        </span>
        <span
          className={cn(
            "text-sm leading-none font-semibold tabular-nums",
            MATCH_TEXT_CLASSNAME[candidate.matchTone]
          )}
        >
          {candidate.matchScore}%
        </span>
      </div>

      <Progress
        value={candidate.matchScore}
        className={cn(
          "**:data-[slot=progress-track]:bg-muted gap-0 **:data-[slot=progress-indicator]:rounded-full **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-track]:rounded-full",
          MATCH_PROGRESS_CLASSNAME[candidate.matchTone]
        )}
      >
        <ProgressLabel className="sr-only">
          {candidate.candidate} match score
        </ProgressLabel>
      </Progress>
    </div>
  )
}

function CandidateCardHeader({
  candidate,
}: {
  candidate: RecruitingCandidate
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Avatar size="sm" className="mt-0.5 size-7 shrink-0">
        <AvatarImage
          src={candidate.assignee.avatar}
          alt={candidate.assignee.name}
        />
        <AvatarFallback className="text-[0.625rem] font-semibold">
          {candidate.assignee.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div
          className="truncate text-base leading-5 font-semibold"
          title={candidate.candidate}
        >
          {candidate.candidate}
        </div>
        <div
          className="text-muted-foreground truncate text-sm leading-5"
          title={candidate.role}
        >
          {candidate.role}
        </div>
      </div>
    </div>
  )
}

function CandidateCardDetails({
  candidate,
}: {
  candidate: RecruitingCandidate
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <CandidateMetaRow
        icon={
          <MapPinIcon className="size-3.5" aria-hidden="true" />
        }
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate" title={candidate.location}>
            {candidate.location}
          </span>
          <span className="text-muted-foreground shrink-0">
            {candidate.timezone}
          </span>
        </div>
      </CandidateMetaRow>

      <CandidateMetaRow
        icon={
          <CalendarClockIcon className="size-3.5" aria-hidden="true" />
        }
      >
        <span className="truncate" title={candidate.interviewDate}>
          {candidate.interviewDate}
        </span>
      </CandidateMetaRow>

      <CandidateMetaRow
        icon={
          <CircleDollarSignIcon className="size-3.5" aria-hidden="true" />
        }
      >
        <span
          className="truncate tabular-nums"
          title={candidate.compensationBand}
        >
          {candidate.compensationBand}
        </span>
      </CandidateMetaRow>
    </div>
  )
}

function CandidateCardStatus({
  candidate,
}: {
  candidate: RecruitingCandidate
}) {
  const scorecard = SCORECARD_STATE_META[candidate.scorecardState]

  return (
    <div className="mt-auto flex min-w-0 items-center justify-between gap-2">
      <Badge
        variant={scorecard.variant}
        className="min-w-0 shrink truncate"
        title={scorecard.label}
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            scorecard.dotClassName
          )}
          aria-hidden="true"
        />
        {scorecard.label}
      </Badge>

      {candidate.riskLabel ? (
        <Badge
          variant={candidate.riskVariant}
          className="min-w-0 shrink truncate"
          title={candidate.riskLabel}
        >
          {candidate.riskLabel}
        </Badge>
      ) : (
        <span
          className="text-muted-foreground truncate text-sm leading-5"
          title="Scorecard tracked"
        >
          Scorecard tracked
        </span>
      )}
    </div>
  )
}

interface CandidateCardProps extends Omit<
  ComponentProps<typeof KanbanItem>,
  "value" | "children"
> {
  candidate: RecruitingCandidate
  isOverlay?: boolean
}

function CandidateCard({ candidate, isOverlay, ...props }: CandidateCardProps) {
  const cardPanel = (
    <FramePanel
      className={cn(
        "hover:border-foreground/20 flex min-h-50 flex-col gap-2.5 p-3 transition-[border-color,box-shadow] hover:shadow-sm",
        isOverlay && "shadow-lg"
      )}
    >
      <CandidateCardHeader candidate={candidate} />
      <CandidateMatch candidate={candidate} />
      <CandidateCardDetails candidate={candidate} />
      <CandidateCardStatus candidate={candidate} />
    </FramePanel>
  )

  const card = isOverlay ? (
    <Frame variant="ghost" spacing="sm" className="p-0">
      {cardPanel}
    </Frame>
  ) : (
    cardPanel
  )

  return (
    <KanbanItem value={candidate.id} {...props}>
      {isOverlay ? (
        card
      ) : (
        <KanbanItemHandle className="block">{card}</KanbanItemHandle>
      )}
    </KanbanItem>
  )
}

function EmptyColumn({ column }: { column: RecruitingColumn }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="text-muted-foreground hover:text-foreground bg-background/70 min-h-24 w-full border-dashed"
      aria-label={column.addLabel}
    >
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {column.addLabel}
    </Button>
  )
}

interface RecruitingColumnProps extends Omit<
  ComponentProps<typeof KanbanColumn>,
  "value" | "children"
> {
  column: RecruitingColumn
  candidates: RecruitingCandidate[]
  isOverlay?: boolean
}

function RecruitingColumn({
  column,
  candidates,
  isOverlay,
  ...props
}: RecruitingColumnProps) {
  return (
    <KanbanColumn
      value={column.id}
      className="w-[calc(100vw-3rem)] max-w-[18.5rem] shrink-0 self-start sm:w-[18.5rem]"
      {...props}
    >
      <Frame
        spacing="sm"
        className={cn("group/column", isOverlay && "shadow-lg")}
        aria-label={`${column.title}: ${column.description}`}
      >
        <FrameHeader className="flex min-h-9 flex-row items-center gap-2 px-2 py-1.5">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              column.dotClassName
            )}
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <FrameTitle
                className="truncate text-sm leading-5"
                title={column.title}
              >
                {column.title}
              </FrameTitle>
              <span className="text-muted-foreground shrink-0 text-xs leading-none font-medium tabular-nums">
                {candidates.length}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within/kanban-column:opacity-100 group-hover/kanban-column:opacity-100",
              isOverlay && "hidden"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={column.addLabel}
              className="text-muted-foreground hover:border-border! hover:bg-background! hover:text-foreground border border-transparent bg-transparent"
            >
              <PlusIcon aria-hidden="true" />
            </Button>

            <KanbanColumnHandle
              className="group-focus-within/kanban-column:opacity-100"
              render={({ className, ...handleProps }) => (
                <Button
                  {...handleProps}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${column.title} column`}
                  className={cn(
                    "text-muted-foreground hover:border-border! hover:bg-background! hover:text-foreground cursor-grab border border-transparent bg-transparent active:cursor-grabbing",
                    className
                  )}
                >
                  <GripVerticalIcon aria-hidden="true" />
                </Button>
              )}
            />
          </div>
        </FrameHeader>

        <KanbanColumnContent value={column.id} className="gap-2 p-0.5">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
          {candidates.length === 0 && <EmptyColumn column={column} />}
        </KanbanColumnContent>
      </Frame>
    </KanbanColumn>
  )
}

function findCandidate(
  columns: Record<string, RecruitingCandidate[]>,
  candidateId: string
) {
  for (const candidates of Object.values(columns)) {
    const candidate = candidates.find((item) => item.id === candidateId)

    if (candidate) {
      return candidate
    }
  }

  return null
}

export function KanbanBoard() {
  const [candidatesByColumn, setCandidatesByColumn] = useState(
    () => INITIAL_CANDIDATES
  )
  const columnEntries = Object.entries(candidatesByColumn)

  return (
    <section className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
      <PipelineToolbar />

      <Kanban
        value={candidatesByColumn}
        onValueChange={setCandidatesByColumn}
        getItemValue={(item) => item.id}
        className="w-full"
      >
        <BoardScrollArea>
          <KanbanBoardPrimitive className="flex min-w-full items-start gap-3 p-1">
            {columnEntries.map(([columnId, candidates]) => {
              const column = RECRUITING_COLUMN_BY_ID.get(columnId)

              if (!column) {
                return null
              }

              return (
                <RecruitingColumn
                  key={columnId}
                  column={column}
                  candidates={candidates}
                />
              )
            })}
          </KanbanBoardPrimitive>
        </BoardScrollArea>

        <KanbanOverlay>
          {({ value, variant }) => {
            if (variant === "column") {
              const column = RECRUITING_COLUMN_BY_ID.get(String(value))

              if (!column) {
                return null
              }

              return (
                <RecruitingColumn
                  column={column}
                  candidates={candidatesByColumn[String(value)] ?? []}
                  isOverlay
                />
              )
            }

            const candidate = findCandidate(candidatesByColumn, String(value))

            return candidate ? (
              <CandidateCard candidate={candidate} isOverlay />
            ) : null
          }}
        </KanbanOverlay>
      </Kanban>
    </section>
  )
}