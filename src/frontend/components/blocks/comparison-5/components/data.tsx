import type { BadgeProps } from "@/components/reui/badge"

export type ProductId =
  | "studio"
  | "studio-pro"
  | "studio-max"
  | "studio-elite"

export type SpecKey =
  | "battery"
  | "noiseCancel"
  | "spatialAudio"
  | "wirelessCharging"
  | "weight"
  | "codec"
  | "warranty"

/**
 * A spec value is either a quantitative string ("38 h", "295 g") or a boolean
 * for feature presence ("Active noise cancellation").
 */
export type SpecValue = string | boolean

export type Product = {
  id: ProductId
  name: string
  brand: string
  href: string
  categories: string[]
  tagline: string
  price: number
  compareAtPrice?: number
  rating: number
  reviewCount: number
  badge?: { label: string; variant: BadgeProps["variant"] }
  image: {
    src: string
    alt: string
  }
  specs: Record<SpecKey, SpecValue>
}

export type SpecDefinition = {
  key: SpecKey
  label: string
  /** Direction for numeric comparisons. Determines which way the delta arrow points. */
  better?: "higher" | "lower"
  /** Optional unit appended to numeric deltas (e.g. "h", "g"). */
  unit?: string
}

export const SPECS: SpecDefinition[] = [
  { key: "battery", label: "Battery life", better: "higher", unit: " h" },
  { key: "noiseCancel", label: "Active noise cancellation" },
  { key: "spatialAudio", label: "Spatial audio" },
  { key: "wirelessCharging", label: "Wireless charging" },
  { key: "weight", label: "Weight", better: "lower", unit: " g" },
  { key: "codec", label: "Hi-res codec" },
  { key: "warranty", label: "Warranty", better: "higher", unit: " yr" },
]

/**
 * Fixed feature checklist rendered on the focused product and every
 * alternative. Same order, same labels, only the availability flips per
 * product. Booleans come straight from `product.specs`; `hiResAudio` is
 * derived from the codec string so the list reads as a comparable checklist
 * rather than a freeform text spec.
 */
export type FeatureKey =
  | "noiseCancel"
  | "spatialAudio"
  | "wirelessCharging"
  | "hiResAudio"

export type FeatureDefinition = {
  key: FeatureKey
  label: string
}

export const FEATURE_LIST: FeatureDefinition[] = [
  { key: "noiseCancel", label: "Active noise cancellation" },
  { key: "spatialAudio", label: "Spatial audio" },
  { key: "wirelessCharging", label: "Wireless charging" },
  { key: "hiResAudio", label: "Hi-res audio (LDAC)" },
]

/** Whether a product offers the given feature. */
export function hasFeature(product: Product, feature: FeatureKey): boolean {
  if (feature === "hiResAudio") {
    const codec = product.specs.codec
    if (typeof codec !== "string") return false
    const lower = codec.toLowerCase()
    return lower.includes("ldac") || lower.includes("aptx hd")
  }
  return product.specs[feature] === true
}

export const PRODUCTS: Product[] = [
  {
    id: "studio",
    name: "Studio Wireless",
    brand: "Acme Audio",
    href: "#studio",
    categories: ["Wireless", "Noise cancelling", "Travel"],
    tagline: "All-day comfort with active noise cancellation.",
    price: 249,
    compareAtPrice: 299,
    rating: 4.6,
    reviewCount: 412,
    image: {
      src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=720&h=720&q=80",
      alt: "Studio wireless headphones product shot",
    },
    specs: {
      battery: "38",
      noiseCancel: true,
      spatialAudio: false,
      wirelessCharging: false,
      weight: "265",
      codec: "aptX",
      warranty: "2",
    },
  },
  {
    id: "studio-pro",
    name: "Studio Pro",
    brand: "Acme Audio",
    href: "#studio-pro",
    categories: ["Studio", "Audiophile", "Reference"],
    tagline: "Reference-tuned sound and the best balance of features.",
    price: 399,
    rating: 4.8,
    reviewCount: 96,
    image: {
      src: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=720&h=720&q=80",
      alt: "Studio Pro headphones product shot",
    },
    specs: {
      battery: "50",
      noiseCancel: true,
      spatialAudio: true,
      wirelessCharging: true,
      weight: "295",
      codec: "LDAC",
      warranty: "3",
    },
  },
  {
    id: "studio-max",
    name: "Studio Max",
    brand: "Acme Audio",
    href: "#studio-max",
    categories: ["Studio", "Long battery", "Audiophile"],
    tagline: "Longer battery, lighter case, same audiophile tuning.",
    price: 499,
    rating: 4.7,
    reviewCount: 58,
    image: {
      src: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=720&h=720&q=80",
      alt: "Studio Max headphones product shot",
    },
    specs: {
      battery: "55",
      noiseCancel: true,
      spatialAudio: true,
      wirelessCharging: true,
      weight: "310",
      codec: "LDAC",
      warranty: "3",
    },
  },
  {
    id: "studio-elite",
    name: "Studio Elite",
    brand: "Acme Audio",
    href: "#studio-elite",
    categories: ["Studio", "Premium", "Planar driver"],
    tagline: "Flagship build with planar drivers, longest warranty.",
    price: 649,
    rating: 4.9,
    reviewCount: 32,
    badge: { label: "Flagship", variant: "warning" },
    image: {
      src: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=720&h=720&q=80",
      alt: "Studio Elite headphones product shot",
    },
    specs: {
      battery: "60",
      noiseCancel: true,
      spatialAudio: true,
      wirelessCharging: true,
      weight: "340",
      codec: "LDAC",
      warranty: "5",
    },
  },
]

export const FOCUSED_PRODUCT_ID: ProductId = "studio-pro"
export const ALTERNATIVE_IDS: ProductId[] = [
  "studio",
  "studio-max",
  "studio-elite",
]

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((product) => product.id === id) ?? PRODUCTS[0]
}

/** Parse the leading number from a spec value, or null if not numeric. */
export function specNumber(value: SpecValue): number | null {
  if (typeof value !== "string") return null
  const match = value.match(/-?\d+(?:\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}

export type SpecDelta =
  | { kind: "same" }
  | { kind: "better"; magnitude: number; readable: string }
  | { kind: "worse"; magnitude: number; readable: string }
  | { kind: "gain"; label: string }
  | { kind: "loss"; label: string }
  | { kind: "different"; alternative: string }

/**
 * Compares an alternative product's spec to the focused product's spec.
 * Returns a structured delta that the UI can render as a tag (`+12 h battery`,
 * `−no ANC`, `Codec: LDAC`).
 */
export function compareSpec(
  spec: SpecDefinition,
  focused: SpecValue,
  alternative: SpecValue
): SpecDelta {
  if (typeof focused === "boolean" || typeof alternative === "boolean") {
    if (focused === alternative) return { kind: "same" }
    if (alternative && !focused) {
      return { kind: "gain", label: spec.label.toLowerCase() }
    }
    return { kind: "loss", label: spec.label.toLowerCase() }
  }

  const focusedNum = specNumber(focused)
  const alternativeNum = specNumber(alternative)

  if (focusedNum !== null && alternativeNum !== null) {
    if (focusedNum === alternativeNum) return { kind: "same" }
    const diff = alternativeNum - focusedNum
    const magnitude = Math.abs(diff)
    const unit = spec.unit ?? ""
    const readable = `${magnitude}${unit}`

    if (spec.better === "lower") {
      if (diff < 0) return { kind: "better", magnitude, readable }
      return { kind: "worse", magnitude, readable }
    }

    // Default and "higher" share the same orientation
    if (diff > 0) return { kind: "better", magnitude, readable }
    return { kind: "worse", magnitude, readable }
  }

  if (focused === alternative) return { kind: "same" }
  return { kind: "different", alternative: String(alternative) }
}

/** Currency delta vs the focused product. */
export function comparePrice(
  focused: number,
  alternative: number
): { kind: "same" | "cheaper" | "pricier"; amount: number } {
  if (focused === alternative) return { kind: "same", amount: 0 }
  if (alternative < focused) {
    return { kind: "cheaper", amount: focused - alternative }
  }
  return { kind: "pricier", amount: alternative - focused }
}