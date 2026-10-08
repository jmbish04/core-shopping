import { AgentActivity } from "./components/agent-activity"

export function Page() {
  return (
    // Top aligned, not centred: rows expand and the card resolves from a
    // skeleton, and a centred card would slide on every one of those.
    <div className="flex min-h-svh w-full items-start justify-center p-6 pt-16">
      <AgentActivity />
    </div>
  )
}