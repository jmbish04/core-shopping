import { RunFacts } from "./run-facts"
import { RunHeader } from "./run-header"
import { RunTrace } from "./run-trace"

// One run's full story: header with live actions, then the step trace (with
// each step's tool calls inline) beside the row-editable run settings panel.

export function RunDetail() {
  return (
    <div className="@container flex w-full flex-col gap-4">
      <RunHeader />

      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-3">
        <div className="min-w-0 @4xl:col-span-2">
          <RunTrace />
        </div>
        <div className="min-w-0">
          <RunFacts />
        </div>
      </div>
    </div>
  )
}