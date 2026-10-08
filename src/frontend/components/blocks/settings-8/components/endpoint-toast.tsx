import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CheckIcon } from "lucide-react"

// ── Show Endpoint Toast ──

export function showEndpointToast({
  title,
  description,
  variant = "info",
}: {
  title: string
  description: string
  variant?: "info" | "success"
}) {
  toast.custom((id) => (
    <div className="bg-invert text-invert-foreground flex w-[356px] items-start gap-3 rounded-md border border-transparent p-4 shadow-lg">
      <span
        className={cn(
          "flex h-5 shrink-0 items-center",
          variant === "success" ? "text-green-500" : "text-info"
        )}
      >
        <CheckIcon className="size-4" aria-hidden="true" />
      </span>

      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-invert-foreground/70 text-sm">{description}</p>

        <div className="mt-2 flex gap-2">
          <Button
            size="xs"
            variant="outline"
            className="bg-background/10 border-border/10 text-invert-foreground"
            onClick={() => toast.dismiss(id)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  ))
}