import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "lucide-react"

// ── Workflow ──

export function NavbarWorkflow() {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button size="icon-sm" variant="ghost">
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
      </Button>
      <span className="text-muted-foreground text-sm">Workflows</span>
    </div>
  )
}