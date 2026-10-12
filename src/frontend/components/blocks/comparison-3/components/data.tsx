import type { BadgeProps } from "@/components/reui/badge"

export type ProductId = "studio" | "studio-pro" | "studio-elite"

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
  image: {
    src: string
    alt: string
  }
}

export type RecommendationBadge = {
  label: string
  variant: BadgeProps["variant"]
}

export type SpecChip = {
  label: string
  value: string
}

/**
 * Shared feature checklist for the recommendation cards. Each product reports
 * whether it includes each feature, so the list reads as an apples-to-apples
 * comparison (check icon when included, minus icon when not) rather than
 * free-form prose.
 */
export const FEATURE_LIST = [
  "Active noise cancellation",
  "Multi-device pairing",
  "Spatial audio",
  "Wireless charging",
  "Priority support",
] as const

export type FeatureName = (typeof FEATURE_LIST)[number]

export type Recommendation = {
  productId: ProductId
  badge: RecommendationBadge
  pitch: string
  features: Record<FeatureName, boolean>
  specs: SpecChip[]
}

export const PRODUCTS: Product[] = [
  {
    id: "studio",
    name: "Studio Wireless",
    brand: "Acme Audio",
    href: "#studio",
    categories: ["Wireless", "Noise cancelling"],
    tagline: "All-day comfort with active noise cancellation.",
    price: 249,
    compareAtPrice: 299,
    rating: 4.6,
    reviewCount: 412,
    image: {
      src: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&h=600&q=80",
      alt: "Studio wireless headphones product shot",
    },
  },
  {
    id: "studio-pro",
    name: "Studio Pro",
    brand: "Acme Audio",
    href: "#studio-pro",
    categories: ["Studio", "Audiophile"],
    tagline: "Reference-tuned audio for serious listeners.",
    price: 399,
    rating: 4.8,
    reviewCount: 96,
    image: {
      src: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&h=600&q=80",
      alt: "Studio Pro headphones product shot",
    },
  },
  {
    id: "studio-elite",
    name: "Studio Elite",
    brand: "Acme Audio",
    href: "#studio-elite",
    categories: ["Studio", "Premium"],
    tagline: "Flagship build with planar drivers and LDAC.",
    price: 649,
    rating: 4.9,
    reviewCount: 32,
    image: {
      src: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=600&h=600&q=80",
      alt: "Studio Elite headphones product shot",
    },
  },
]

export const RECOMMENDATIONS: Recommendation[] = [
  {
    productId: "studio",
    badge: { label: "Best value", variant: "success" },
    pitch: "The sweet spot for everyday listening, at the right price.",
    features: {
      "Active noise cancellation": true,
      "Multi-device pairing": true,
      "Spatial audio": false,
      "Wireless charging": false,
      "Priority support": false,
    },
    specs: [
      { label: "Battery", value: "38 h" },
      { label: "ANC", value: "Yes" },
      { label: "Codec", value: "aptX" },
      { label: "Weight", value: "265 g" },
    ],
  },
  {
    productId: "studio-pro",
    badge: { label: "Editor's choice", variant: "default" },
    pitch:
      "Reference-tuned sound and the best balance of features in the lineup.",
    features: {
      "Active noise cancellation": true,
      "Multi-device pairing": true,
      "Spatial audio": true,
      "Wireless charging": true,
      "Priority support": false,
    },
    specs: [
      { label: "Battery", value: "50 h" },
      { label: "Codec", value: "LDAC" },
      { label: "ANC", value: "Yes" },
      { label: "Weight", value: "295 g" },
    ],
  },
  {
    productId: "studio-elite",
    badge: { label: "Top premium", variant: "destructive" },
    pitch: "Flagship build with the longest battery and the longest warranty.",
    features: {
      "Active noise cancellation": true,
      "Multi-device pairing": true,
      "Spatial audio": true,
      "Wireless charging": true,
      "Priority support": true,
    },
    specs: [
      { label: "Battery", value: "60 h" },
      { label: "Codec", value: "LDAC" },
      { label: "Warranty", value: "5 yr" },
      { label: "Weight", value: "340 g" },
    ],
  },
]

export function getProduct(id: ProductId): Product {
  return PRODUCTS.find((product) => product.id === id) ?? PRODUCTS[0]
}