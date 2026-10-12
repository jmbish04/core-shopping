import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { TOAST_ERROR_ICON, UI_ICONS } from "./icons"

const COPIED_MS = 2000

/** Clipboard write with an inline "copied" state; only a failure toasts. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    }
  }, [])

  function copy(value: string) {
    const failed = () =>
      toast.error("Copy failed", {
        icon: TOAST_ERROR_ICON,
        description: "Clipboard access was blocked.",
      })
    // Clipboard access can be refused (an iframe, an insecure origin), so both paths answer.
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      failed()
      return
    }
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      // Frozen demo guard: ?demo=frozen pins the demo, so no timer starts.
      if (document.documentElement.dataset.demo === "frozen") return
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
    }, failed)
  }

  return { copied, copy }
}

/** A mono id with its own copy button; `display` shortens what is shown. */
export function CopyToken({
  value,
  label,
  display,
  className,
}: {
  value: string
  label: string
  display?: string
  className?: string
}) {
  const { copied, copy } = useCopyFeedback()

  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      <span
        className="text-foreground min-w-0 truncate font-mono text-xs"
        title={display ? value : undefined}
      >
        {display ?? value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        aria-label={
          copied
            ? `${label.charAt(0).toUpperCase()}${label.slice(1)} copied`
            : `Copy ${label}`
        }
        onClick={() => copy(value)}
      >
        {copied ? UI_ICONS.check : UI_ICONS.copy}
      </Button>
    </span>
  )
}