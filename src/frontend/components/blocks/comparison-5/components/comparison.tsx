"use client"

import { Fragment, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  ALTERNATIVE_IDS,
  comparePrice,
  FEATURE_LIST,
  FOCUSED_PRODUCT_ID,
  getProduct,
  hasFeature,
  type FeatureDefinition,
  type Product,
  type ProductId,
} from "./data"
import { StarIcon, CheckIcon, MinusIcon, EyeIcon, ShoppingBagIcon, ArrowRightIcon } from "lucide-react"

function DotSeparator() {
  return (
    <span
      aria-hidden="true"
      className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
    />
  )
}

function ProductCategories({
  categories,
  className,
}: {
  categories: string[]
  className?: string
}) {
  if (categories.length === 0) return null
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs",
        className
      )}
      aria-label={`Categories: ${categories.join(", ")}`}
    >
      {categories.map((category, index) => (
        <Fragment key={category}>
          {index > 0 ? <DotSeparator /> : null}
          <a
            href={`#${category.toLowerCase().replace(/\s+/g, "-")}`}
            aria-label={`View ${category} products`}
            className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            {category}
          </a>
        </Fragment>
      ))}
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const clamped = Math.min(max, Math.max(0, value))
  const percentage = (clamped / max) * 100

  return (
    <span
      role="img"
      aria-label={`${clamped.toFixed(1)} out of ${max}`}
      className="relative inline-flex shrink-0"
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground/30 inline-flex items-center gap-0.5"
      >
        {Array.from({ length: max }, (_, index) => (
          <StarIcon key={index} className="size-3.5 fill-current" aria-hidden="true" />
        ))}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
        style={{ width: `${percentage}%` }}
      >
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: max }, (_, index) => (
            <StarIcon key={index} className="size-3.5 fill-current" aria-hidden="true" />
          ))}
        </span>
      </span>
    </span>
  )
}

function FeatureChecklist({
  product,
  ariaLabel,
}: {
  product: Product
  ariaLabel: string
}) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label={ariaLabel}>
      {FEATURE_LIST.map((feature) => {
        const available = hasFeature(product, feature.key)
        return (
          <FeatureRow
            key={feature.key}
            feature={feature}
            available={available}
          />
        )
      })}
    </ul>
  )
}

function FeatureRow({
  feature,
  available,
}: {
  feature: FeatureDefinition
  available: boolean
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-sm leading-snug",
        available ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {available ? (
        <CheckIcon className="text-success size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <MinusIcon className="text-muted-foreground/55 size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className={cn(!available && "line-through decoration-current/55")}>
        {feature.label}
      </span>
      <span className="sr-only">{available ? "included" : "not included"}</span>
    </li>
  )
}

function FocusedHero({ product }: { product: Product }) {
  return (
    <article
      className="bg-background border-border flex min-w-0 flex-col overflow-hidden rounded-lg border"
      aria-labelledby={`comparison-5-focused-${product.id}-name`}
    >
      <a
        href={product.href}
        aria-label={`View ${product.name}`}
        className="bg-muted/40 group/hero relative block aspect-[5/4] overflow-hidden"
      >
        <img
          src={product.image.src}
          alt={product.image.alt}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/hero:scale-[1.04]"
        />
        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          <Badge variant="success">
            <EyeIcon aria-hidden="true" />
            You&rsquo;re viewing
          </Badge>
          {product.badge ? (
            <Badge variant={product.badge.variant}>{product.badge.label}</Badge>
          ) : null}
        </span>
      </a>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <a
            id={`comparison-5-focused-${product.id}-name`}
            href={product.href}
            className="text-foreground hover:text-primary text-xl font-semibold tracking-tight underline-offset-4 transition-colors hover:underline sm:text-2xl"
          >
            {product.name}
          </a>
          <ProductCategories categories={product.categories} />
          <p className="text-muted-foreground mt-1 text-sm leading-snug">
            {product.tagline}
          </p>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice ? (
              <span className="text-muted-foreground text-sm tabular-nums line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs">
            <StarRating value={product.rating} />
            <span className="text-foreground font-medium tabular-nums">
              {product.rating.toFixed(1)}
            </span>
            <a
              href={`${product.href}#reviews`}
              aria-label={`Read ${product.reviewCount} reviews for ${product.name}`}
              className="text-muted-foreground hover:text-foreground underline-offset-4 transition-colors hover:underline"
            >
              ({product.reviewCount} reviews)
            </a>
          </div>
        </div>

        <div className="border-border flex flex-col gap-3 border-t pt-4">
          <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wider uppercase">
            Included features
          </p>
          <FeatureChecklist
            product={product}
            ariaLabel={`${product.name} included features`}
          />
        </div>

        <Button type="button" className="w-full">
          <ShoppingBagIcon data-icon="inline-start" className="size-4" aria-hidden="true" />
          Add to cart
        </Button>
      </div>
    </article>
  )
}

function AlternativeStrip({
  focused,
  alternative,
  onSwitch,
}: {
  focused: Product
  alternative: Product
  onSwitch: (id: ProductId) => void
}) {
  const priceDelta = comparePrice(focused.price, alternative.price)
  const priceDeltaText =
    priceDelta.kind === "same"
      ? null
      : `${priceDelta.kind === "cheaper" ? "−" : "+"}${formatCurrency(priceDelta.amount)}`
  const priceDeltaTone =
    priceDelta.kind === "cheaper"
      ? "text-success-foreground"
      : "text-muted-foreground"

  return (
    <article
      className="bg-background border-border flex min-w-0 flex-col gap-4 rounded-lg border p-4"
      aria-labelledby={`comparison-5-alt-${alternative.id}-name`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <a
          href={alternative.href}
          aria-label={`View ${alternative.name}`}
          className="bg-muted/40 group/image relative block aspect-square size-24 shrink-0 overflow-hidden rounded-md"
        >
          <img
            src={alternative.image.src}
            alt={alternative.image.alt}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/image:scale-105"
          />
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <a
              id={`comparison-5-alt-${alternative.id}-name`}
              href={alternative.href}
              className="text-foreground hover:text-primary truncate text-sm font-semibold tracking-tight underline-offset-4 transition-colors hover:underline"
            >
              {alternative.name}
            </a>
            {alternative.badge ? (
              <Badge variant={alternative.badge.variant} className="shrink-0">
                {alternative.badge.label}
              </Badge>
            ) : null}
          </div>
          <ProductCategories categories={alternative.categories} />
          <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
            <span className="text-foreground text-base font-semibold tabular-nums">
              {formatCurrency(alternative.price)}
            </span>
            {priceDeltaText ? (
              <span
                className={cn(
                  "text-base font-medium tabular-nums",
                  priceDeltaTone
                )}
              >
                {priceDeltaText}
              </span>
            ) : null}
          </div>
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <StarRating value={alternative.rating} />
            <span className="text-foreground font-medium tabular-nums">
              {alternative.rating.toFixed(1)}
            </span>
            <a
              href={`${alternative.href}#reviews`}
              aria-label={`Read ${alternative.reviewCount} reviews for ${alternative.name}`}
              className="text-muted-foreground hover:text-foreground underline-offset-4 transition-colors hover:underline"
            >
              ({alternative.reviewCount} reviews)
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-dashed pt-3">
        <FeatureChecklist
          product={alternative}
          ariaLabel={`${alternative.name} included features`}
        />
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => onSwitch(alternative.id)}
        >
          Switch to this
          <ArrowRightIcon data-icon="inline-end" className="size-4" aria-hidden="true" />
        </Button>
        <a
          href={alternative.href}
          aria-label={`See full details for ${alternative.name}`}
          className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 transition-colors hover:underline"
        >
          Details
        </a>
      </div>
    </article>
  )
}

export function Comparison() {
  const [focusedId, setFocusedId] = useState<ProductId>(FOCUSED_PRODUCT_ID)
  const focusedHeroRef = useRef<HTMLDivElement>(null)

  const focused = useMemo(() => getProduct(focusedId), [focusedId])
  const alternatives = useMemo(() => {
    // Keep the merchant's preferred ordering: focused product hidden, the
    // ALTERNATIVE_IDS list provides the canonical order, and any previously-
    // focused product slots back in at its natural data-array position.
    const focusedFirst = [FOCUSED_PRODUCT_ID, ...ALTERNATIVE_IDS] as ProductId[]
    const seen = new Set<ProductId>()
    const ordered: ProductId[] = []
    for (const id of focusedFirst) {
      if (id !== focusedId && !seen.has(id)) {
        ordered.push(id)
        seen.add(id)
      }
    }
    return ordered.map(getProduct)
  }, [focusedId])

  function handleSwitch(id: ProductId) {
    if (id === focusedId) return
    setFocusedId(id)
    // Smooth-scroll the focused hero into view so mobile users immediately
    // see the swapped product. No-op on desktop where the hero is already
    // alongside the alternatives.
    requestAnimationFrame(() => {
      focusedHeroRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      aria-labelledby="comparison-5-heading"
    >
      <header className="flex max-w-prose flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
          Before you decide
        </p>
        <h1
          id="comparison-5-heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Compare with similar models
        </h1>
        <p className="text-muted-foreground text-sm leading-5">
          See how {alternatives.length} alternatives stack up against{" "}
          {focused.name}. Switch any one in with a single tap.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div ref={focusedHeroRef} className="min-w-0 scroll-mt-6">
          <FocusedHero product={focused} />
        </div>

        <div className="flex flex-col gap-3">
          {alternatives.map((alternative) => (
            <Fragment key={alternative.id}>
              <AlternativeStrip
                focused={focused}
                alternative={alternative}
                onSwitch={handleSwitch}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}