"use client"

import { Fragment } from "react"
import { Badge } from "@/components/reui/badge"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Item } from "@/components/ui/item"
import {
  FEATURE_LIST,
  getProduct,
  PRODUCTS,
  RECOMMENDATIONS,
  type FeatureName,
  type Product,
  type ProductId,
  type Recommendation,
  type SpecChip,
} from "./data"
import { StarIcon, CheckIcon, MinusIcon, ShoppingBagIcon, ArrowRightIcon, InfoIcon } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function DotSeparator() {
  return (
    <span
      aria-hidden="true"
      className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
    />
  )
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

function SpecStrip({ specs }: { specs: SpecChip[] }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="list" aria-label="Key specs">
      {specs.map((spec) => (
        <Item
          key={spec.label}
          variant="outline"
          size="sm"
          role="listitem"
          className="justify-between gap-2 border-dashed"
        >
          <span className="text-muted-foreground text-xs">{spec.label}</span>
          <span className="text-foreground text-sm font-medium tabular-nums">
            {spec.value}
          </span>
        </Item>
      ))}
    </div>
  )
}

function ProductCategories({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null
  return (
    <div
      className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
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

function FeatureList({ features }: { features: Record<FeatureName, boolean> }) {
  return (
    <ul className="space-y-1.5" aria-label="Included features">
      {FEATURE_LIST.map((feature) => {
        const available = features[feature]
        return (
          <li
            key={feature}
            className={cn(
              "flex items-center gap-2 text-sm leading-snug",
              available ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {available ? (
              <CheckIcon className="text-success size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <MinusIcon className="text-muted-foreground/50 size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(!available && "line-through decoration-current/55")}
            >
              {feature}
            </span>
            <span className="sr-only">
              {available ? "included" : "not included"}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function RecommendationCard({
  recommendation,
  product,
  highlighted,
  onAddToCart,
}: {
  recommendation: Recommendation
  product: Product
  highlighted: boolean
  onAddToCart: (id: ProductId) => void
}) {
  return (
    <article
      className={cn(
        "bg-background group/card flex min-w-0 flex-col overflow-hidden rounded-lg border",
        highlighted
          ? "border-foreground/15 shadow-md shadow-black/5"
          : "border-border"
      )}
      aria-labelledby={`comparison-3-${product.id}-name`}
    >
      <a
        href={product.href}
        aria-label={`View ${product.name}`}
        className="bg-muted/40 relative block aspect-[5/4] w-full overflow-hidden"
      >
        <img
          src={product.image.src}
          alt={product.image.alt}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
        />
        <span className="absolute top-3 left-3">
          <Badge variant={recommendation.badge.variant} className="shadow-sm">
            {recommendation.badge.label}
          </Badge>
        </span>
      </a>

      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <a
            id={`comparison-3-${product.id}-name`}
            href={product.href}
            className="text-foreground hover:text-primary text-base font-semibold tracking-tight underline-offset-4 transition-colors hover:underline"
          >
            {product.name}
          </a>
          <ProductCategories categories={product.categories} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
              ({product.reviewCount})
            </a>
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-snug">
          {recommendation.pitch}
        </p>

        <FeatureList features={recommendation.features} />

        <SpecStrip specs={recommendation.specs} />

        <div className="mt-auto pt-1">
          <Button
            type="button"
            className="w-full"
            onClick={() => onAddToCart(product.id)}
          >
            <ShoppingBagIcon data-icon="inline-start" className="size-4" aria-hidden="true" />
            Add to cart
          </Button>
        </div>
      </div>
    </article>
  )
}

const HIGHLIGHTED_PRODUCT: ProductId = "studio-pro"

export function Comparison() {
  function handleAddToCart(id: ProductId) {
    const product = getProduct(id)
    // Demo only - wire up your cart action here.
    console.info("Add to cart", product.name)
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      aria-labelledby="comparison-3-heading"
    >
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.08em] uppercase">
            Editor&rsquo;s picks
          </p>
          <h1
            id="comparison-3-heading"
            className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Find the one that fits you
          </h1>
          <p className="text-muted-foreground mt-1 max-w-prose text-sm leading-5">
            Three favorites from the lineup. Each one is the best pick for a
            different kind of buyer.
          </p>
        </div>
        <a
          href="#all-models"
          className="text-foreground hover:text-primary group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          Browse all models
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
      </header>

      <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {RECOMMENDATIONS.map((recommendation) => {
          const product = getProduct(recommendation.productId)
          return (
            <RecommendationCard
              key={recommendation.productId}
              recommendation={recommendation}
              product={product}
              highlighted={recommendation.productId === HIGHLIGHTED_PRODUCT}
              onAddToCart={handleAddToCart}
            />
          )
        })}
      </div>

      <p className="text-muted-foreground mt-6 flex items-start gap-2 text-xs">
        <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Editor picks reflect best fit across price, features, and target use.
          For a full spec table or a head-to-head, see the related comparison
          blocks.
        </span>
      </p>
    </section>
  )
}