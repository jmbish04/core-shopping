import { type ActorId } from "./data"
import { ActorAvatar } from "./value-faces"

/** One column's open denials: its centre and the face of whoever drove them. */
export type DenialMark = {
  key: string
  cx: number
  actorId: ActorId
}

/** Open denials capping their columns' tracks with the faces the queue rows
 *  wear, or an amber dot when a column is too narrow. */
export function DenialLane({
  marks,
  plotTop,
  faces,
}: {
  marks: DenialMark[]
  /** The plot's top edge; the lane is the margin above it. */
  plotTop: number
  faces: boolean
}) {
  if (marks.length === 0) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {marks.map((mark) =>
        faces ? (
          <span
            key={mark.key}
            className="absolute flex size-5 items-center justify-center"
            style={{ left: mark.cx - 10, top: plotTop - 28 }}
          >
            <ActorAvatar actorId={mark.actorId} />
          </span>
        ) : (
          // 6px, so neighbours on a 9px pitch never touch.
          <span
            key={mark.key}
            className="bg-warning absolute size-1.5 rounded-full"
            style={{ left: mark.cx - 3, top: plotTop - 21 }}
          />
        )
      )}
    </div>
  )
}