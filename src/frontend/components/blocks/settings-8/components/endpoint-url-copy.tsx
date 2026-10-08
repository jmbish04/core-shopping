"use client"

import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CopyIcon } from "lucide-react"

// ── Endpoint URL Copy ──

export function EndpointUrlCopy({
  endpointName,
  url,
}: {
  endpointName: string
  url: string
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard()

  return (
    <span className="group/url inline-flex max-w-full items-center gap-1 align-top">
      <code className="text-foreground/90 max-w-full min-w-0 truncate text-xs">
        {url}
      </code>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground shrink-0 opacity-100 transition-opacity duration-200 focus-visible:opacity-100 sm:opacity-0 sm:group-focus-within/url:opacity-100 sm:group-hover/url:opacity-100"
              aria-label={
                isCopied
                  ? `Copied endpoint URL for ${endpointName}`
                  : `Copy endpoint URL for ${endpointName}`
              }
              onClick={() => copyToClipboard(url)}
            />
          }
        >
          <CopyIcon aria-hidden="true" />
        </TooltipTrigger>

        <TooltipContent>{isCopied ? "Copied" : "Copy URL"}</TooltipContent>
      </Tooltip>
    </span>
  )
}