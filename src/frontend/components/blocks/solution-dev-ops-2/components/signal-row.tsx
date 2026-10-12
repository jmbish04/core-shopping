import { useState } from "react"

import { bucketKeyOf, type BucketSpan } from "./audit-query"
import { type AuditEvent, type TimeRange } from "./data"
import { DeniedAttemptsList } from "./denied-attempts-list"
import { EventVolumeChart } from "./event-volume-chart"

/** The chart and the queue share one hover: a column lights its queue rows,
 *  and a queue row lights its column. */
export function SignalRow({
  events,
  priorTotal,
  range,
  selection,
  onSelectionChange,
  denied,
  inScope,
  currentId,
  onOpenEvent,
  onReview,
  onReviewAll,
}: {
  events: AuditEvent[]
  priorTotal: number
  range: TimeRange
  selection: BucketSpan | null
  onSelectionChange: (span: BucketSpan | null) => void
  /** Open denials in scope, newest first. */
  denied: AuditEvent[]
  /** Every denial in scope, reviewed or not, newest first. */
  inScope: AuditEvent[]
  currentId: string | null
  onOpenEvent: (id: string) => void
  onReview: (event: AuditEvent) => void
  onReviewAll: () => void
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null)
  // Resolved against the live queue, so a reviewed row never leaves a band.
  const linked = denied.find((event) => event.id === linkedEventId)
  const linkedBucketKey = linked ? bucketKeyOf(linked, range) : null
  // An unmounted row fires no leave; drop its id so it never relights.
  if (linkedEventId !== null && !linked) setLinkedEventId(null)

  return (
    <>
      <div className="min-w-0 @4xl:col-span-3">
        <EventVolumeChart
          events={events}
          priorTotal={priorTotal}
          range={range}
          selection={selection}
          onSelectionChange={onSelectionChange}
          activeLabel={activeLabel}
          onActiveLabelChange={setActiveLabel}
          linkedBucketKey={linkedBucketKey}
        />
      </div>
      <div className="min-w-0 @4xl:col-span-2">
        <DeniedAttemptsList
          denied={denied}
          inScope={inScope}
          scoped={selection !== null}
          range={range}
          litBucketKey={activeLabel}
          linkedEventId={linkedEventId}
          onLinkEvent={setLinkedEventId}
          onClearSelection={() => onSelectionChange(null)}
          currentId={currentId}
          onOpenEvent={onOpenEvent}
          onReview={onReview}
          onReviewAll={onReviewAll}
        />
      </div>
    </>
  )
}