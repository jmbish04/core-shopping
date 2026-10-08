import { Frame, FramePanel } from "@/components/reui/frame"
import { cn } from "@/lib/utils"

import { Item, ItemMedia } from "@/components/ui/item"

import { SUMMARY_CARDS, type ICard } from "./data"

// ── Summary cards (reused verbatim from application/card/card-3) ──
// Re-declares card-3's CardItem (colored Item icon box + title link +
// description) and its CardGrid (one Frame + @container grid). Only the data
// is adapted to agent-ops summary stats.

function CardItem({ card }: { card: ICard }) {
  return (
    <FramePanel>
      <Item
        className={cn(
          "p-0",
          "border-background mb-3.5 flex size-9 items-center justify-center border-2 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border [&_svg]:size-4.5 [&_svg]:text-white",
          card.iconBg
        )}
      >
        <ItemMedia variant="icon" className="size-auto">
          {card.icon}
        </ItemMedia>
      </Item>
      <a
        href="#"
        className="hover:text-primary text-sm leading-tight font-medium"
      >
        {card.title}
      </a>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {card.description}
      </p>
    </FramePanel>
  )
}

export function SummaryCards({ className }: { className?: string }) {
  return (
    <Frame className={cn("@container w-full", className)}>
      {/* Grid */}
      <div className="grid gap-1 @2xl:grid-cols-2 @4xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <CardItem key={card.title} card={card} />
        ))}
      </div>
    </Frame>
  )
}