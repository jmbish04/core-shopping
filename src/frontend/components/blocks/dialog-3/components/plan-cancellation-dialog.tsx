"use client"

import { useRef, useState } from "react"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CANCELLATION_REASON_OPTIONS } from "./data"
import { TriangleAlertIcon, InfoIcon } from "lucide-react"

const FEEDBACK_PLACEHOLDER = "Anything we should improve before you leave ReUI?"

export function PlanCancellationDialog() {
  const [open, setOpen] = useState(true)
  const [selectedReasonIds, setSelectedReasonIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState("")
  const [noticeVisible, setNoticeVisible] = useState(true)
  const keepPlanButtonRef = useRef<HTMLButtonElement | null>(null)

  const hasSelectedReason = selectedReasonIds.length > 0

  const handleReasonChange = (reasonId: string, nextChecked: boolean) => {
    setSelectedReasonIds((current) => {
      if (nextChecked) {
        return current.includes(reasonId) ? current : [...current, reasonId]
      }

      return current.filter((item) => item !== reasonId)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Actions */}
      <div className="flex min-h-[360px] items-center justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            setOpen(true)
            setNoticeVisible(true)
          }}
        >
          Open offboarding dialog
        </Button>
      </div>

      {/* Content */}
      <DialogContent
        className="**:data-[slot=dialog-close]:top-3 **:data-[slot=dialog-close]:right-3 sm:max-w-2xl"
        initialFocus={keepPlanButtonRef}
      >
        <DialogHeader className="mb-2 ps-1 pt-1 text-left">
          <DialogTitle>Cancel Your Plan</DialogTitle>
          <DialogDescription>
            Your workspace stays active through the current billing period.
          </DialogDescription>
        </DialogHeader>

        {noticeVisible ? (
          <div className="px-1">
            <Alert variant="warning" className="mb-3">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertTitle>Shared access pauses after expiry.</AlertTitle>
              <AlertDescription>
                Team access stays on until the current period ends.
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setNoticeVisible(false)}
                >
                  Dismiss
                </Button>
                <Button type="button" size="xs">
                  Manage
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : null}

        <FieldSet className="mb-1 gap-0 px-1">
          <FieldLegend className="sr-only">
            Select cancellation reasons
          </FieldLegend>
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            {CANCELLATION_REASON_OPTIONS.map((option) => {
              const inputId = `plan-cancellation-${option.id}`
              const checked = selectedReasonIds.includes(option.id)

              return (
                <FieldLabel
                  key={option.id}
                  htmlFor={inputId}
                  className="flex w-full min-w-0 cursor-pointer"
                >
                  <Field
                    orientation="horizontal"
                    className={cn(
                      "w-full items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors",
                      checked ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <FieldContent className="min-w-0 pr-2">
                      <FieldTitle
                        className={cn(
                          "text-sm font-medium",
                          checked && "text-primary"
                        )}
                      >
                        {option.label}
                      </FieldTitle>
                    </FieldContent>

                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        handleReasonChange(option.id, nextChecked === true)
                      }
                      aria-label={option.label}
                      className="shrink-0"
                    />
                  </Field>
                </FieldLabel>
              )
            })}
          </FieldGroup>
        </FieldSet>

        <Field className="mb-3 px-1">
          <FieldLabel htmlFor="plan-cancellation-feedback" className="sr-only">
            Additional feedback
          </FieldLabel>
          <Textarea
            id="plan-cancellation-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={FEEDBACK_PLACEHOLDER}
            className="min-h-24 resize-none rounded-lg border px-3 py-2"
          />
        </Field>

        <DialogFooter className="px-5 sm:items-center sm:justify-between">
          <TooltipProvider delay={150}>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex items-center gap-1.5 rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    />
                  }
                >
                  <InfoIcon className="size-4" aria-hidden="true" />
                  <span>Billing stays active</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-3">
                  Access and updates stay available until your current billing
                  period ends.
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button
              ref={keepPlanButtonRef}
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Keep plan
            </Button>
            <Button
              type="button"
              disabled={!hasSelectedReason}
              onClick={() => setOpen(false)}
            >
              Cancel plan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}