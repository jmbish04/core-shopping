export type ProductCategory =
  | "Apparel"
  | "Footwear"
  | "Accessories"
  | "Outerwear"
  | "Bags"

export type ProductStatus = "Active" | "Draft" | "Archived"

export interface Product {
  id: string
  name: string
  sku: string
  category: ProductCategory
  price: number
  stock: number
  status: ProductStatus
  visible: boolean
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Apparel",
  "Footwear",
  "Accessories",
  "Outerwear",
  "Bags",
]

export const PRODUCT_STATUSES: ProductStatus[] = ["Active", "Draft", "Archived"]

export const LOW_STOCK_THRESHOLD = 10

export const PRODUCTS: Product[] = [
  {
    id: "prd-1042",
    name: "Everyday Cotton Tee",
    sku: "APP-1042",
    category: "Apparel",
    price: 28,
    stock: 320,
    status: "Active",
    visible: true,
  },
  {
    id: "prd-3502",
    name: "Suede Chelsea Boot",
    sku: "FTW-3502",
    category: "Footwear",
    price: 189,
    stock: 14,
    status: "Draft",
    visible: false,
  },
  {
    id: "prd-5260",
    name: "Aviator Sunglasses",
    sku: "ACC-5260",
    category: "Accessories",
    price: 120,
    stock: 64,
    status: "Active",
    visible: true,
  },
  {
    id: "prd-3381",
    name: "Trail Runner GTX",
    sku: "FTW-3381",
    category: "Footwear",
    price: 145,
    stock: 7,
    status: "Active",
    visible: true,
  },
  {
    id: "prd-2380",
    name: "Linen Camp Shirt",
    sku: "APP-2380",
    category: "Apparel",
    price: 64,
    stock: 0,
    status: "Archived",
    visible: false,
  },
]

// ── Formatting (raw values live above, formatting stays here) ──

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(value)
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

export function formatStock(value: number) {
  return NUMBER_FORMATTER.format(value)
}

// ── Cell validators (return an error message or null when valid) ──

export function validateName(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Name is required."
  if (value.length < 2) return "Use at least 2 characters."
  if (value.length > 60) return "Keep under 60 characters."
  return null
}

export function validatePrice(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Price is required."
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return "Enter a valid number."
  if (parsed < 0) return "Price cannot be negative."
  if (parsed > 100000) return "Price looks too high."
  return null
}

export function validateStock(raw: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return "Stock is required."
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return "Enter a whole number."
  if (parsed < 0) return "Stock cannot be negative."
  return null
}

/**
 * True when the working row differs from its saved baseline.
 * sku is excluded by design: it is auto-derived on add/duplicate, never edited.
 */
export function isProductChanged(working: Product, saved: Product) {
  return (
    working.name !== saved.name ||
    working.category !== saved.category ||
    working.price !== saved.price ||
    working.stock !== saved.stock ||
    working.status !== saved.status ||
    working.visible !== saved.visible
  )
}