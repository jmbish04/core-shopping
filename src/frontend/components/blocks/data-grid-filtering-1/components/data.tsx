import { type ReactNode } from "react"

import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack"
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite"
import { Convex } from "@/components/ui/svgs/convex"
import { Mintlify } from "@/components/ui/svgs/mintlify"
import { N8n } from "@/components/ui/svgs/n8n"
import { Neon } from "@/components/ui/svgs/neon"
import { Openai } from "@/components/ui/svgs/openai"
import { OpenaiDark } from "@/components/ui/svgs/openaiDark"
import { Paper } from "@/components/ui/svgs/paper"
import { Prisma } from "@/components/ui/svgs/prisma"
import { PrismaDark } from "@/components/ui/svgs/prismaDark"
import { Stripe } from "@/components/ui/svgs/stripe"
import { Supabase } from "@/components/ui/svgs/supabase"

// ── Types ──

export type TxType = "payment" | "refund" | "payout" | "charge" | "transfer"
export type TxStatus = "completed" | "pending" | "failed" | "cancelled"
/** Where the charge originated (billing SaaS pattern - replaces duplicate "method" logos). */
export type TxChannel = "checkout" | "api" | "invoice" | "dashboard"

export interface ITransaction {
  id: string
  reference: string
  date: string
  description: string
  merchant: string
  merchantLogo: ReactNode
  category: string
  type: TxType
  channel: TxChannel
  amount: number
  currency: string
  status: TxStatus
  account: string
  country: string
  flag: string
  timezone?: string
  note?: string
}

// ── Logos (one mark per vendor - @/components/ui/svgs only) ──

const OPENAI_LOGO = (
  <>
    <span aria-hidden className="dark:hidden">
      <Openai className="size-5" />
    </span>
    <span aria-hidden className="hidden dark:block">
      <OpenaiDark className="size-5" />
    </span>
  </>
)

const PRISMA_LOGO = (
  <>
    <span aria-hidden className="dark:hidden">
      <Prisma className="size-5" />
    </span>
    <span aria-hidden className="hidden dark:block">
      <PrismaDark className="size-5" />
    </span>
  </>
)

const ANTHROPIC_LOGO = (
  <>
    <span aria-hidden className="dark:hidden">
      <AnthropicBlack className="size-5" />
    </span>
    <span aria-hidden className="hidden dark:block">
      <AnthropicWhite className="size-5" />
    </span>
  </>
)

// ── Data: 10 rows, unique merchants, inbound + outbound (refunds / payouts) ──

export const TRANSACTIONS: ITransaction[] = [
  {
    id: "txn_001",
    reference: "TXN-2025-000143",
    date: "2025-06-12T09:14:00Z",
    description: "Pro plan · subscription renewal",
    merchant: "Stripe",
    merchantLogo: <Stripe className="size-5" aria-hidden="true" />,
    category: "Payments",
    type: "charge",
    channel: "checkout",
    amount: 240.0,
    currency: "USD",
    status: "completed",
    account: "•••• 4242",
    country: "United States",
    flag: "us",
    timezone: "PST (UTC−8)",
  },
  {
    id: "txn_002",
    reference: "TXN-2025-000142",
    date: "2025-06-11T16:30:00Z",
    description: "Database compute · June cycle",
    merchant: "Supabase",
    merchantLogo: <Supabase className="size-5" aria-hidden="true" />,
    category: "Infrastructure",
    type: "charge",
    channel: "dashboard",
    amount: 75.0,
    currency: "USD",
    status: "completed",
    account: "•••• 4242",
    country: "United States",
    flag: "us",
    timezone: "EST (UTC−5)",
  },
  {
    id: "txn_003",
    reference: "TXN-2025-000141",
    date: "2025-06-11T11:02:00Z",
    description: "GPT-4o usage · billing period",
    merchant: "OpenAI",
    merchantLogo: OPENAI_LOGO,
    category: "AI / ML",
    type: "charge",
    channel: "api",
    amount: 312.48,
    currency: "USD",
    status: "completed",
    account: "•••• 4242",
    country: "United States",
    flag: "us",
    timezone: "PST (UTC−8)",
  },
  {
    id: "txn_004",
    reference: "TXN-2025-000140",
    date: "2025-06-10T08:50:00Z",
    description: "Workflow credit · billing adjustment (outbound)",
    merchant: "N8n",
    merchantLogo: <N8n className="size-5" aria-hidden="true" />,
    category: "Automation",
    type: "refund",
    channel: "dashboard",
    amount: -21.0,
    currency: "USD",
    status: "completed",
    account: "org@acme.io",
    country: "Germany",
    flag: "de",
    timezone: "CET (UTC+1)",
  },
  {
    id: "txn_005",
    reference: "TXN-2025-000139",
    date: "2025-06-09T14:15:00Z",
    description: "Canvas seats · prorated refund to customer",
    merchant: "Paper",
    merchantLogo: <Paper className="size-5" aria-hidden="true" />,
    category: "Design",
    type: "refund",
    channel: "invoice",
    amount: -96.0,
    currency: "USD",
    status: "pending",
    account: "•••• 0011",
    country: "United Kingdom",
    flag: "gb",
    timezone: "GMT (UTC+0)",
  },
  {
    id: "txn_006",
    reference: "TXN-2025-000138",
    date: "2025-06-08T18:44:00Z",
    description: "Docs hosting · team",
    merchant: "Mintlify",
    merchantLogo: <Mintlify className="size-5" aria-hidden="true" />,
    category: "Documentation",
    type: "charge",
    channel: "checkout",
    amount: 45.0,
    currency: "USD",
    status: "completed",
    account: "•••• 4242",
    country: "United States",
    flag: "us",
    timezone: "CST (UTC−6)",
  },
  {
    id: "txn_007",
    reference: "TXN-2025-000137",
    date: "2025-06-08T12:22:00Z",
    description: "Function invocations · May",
    merchant: "Convex",
    merchantLogo: <Convex className="size-5" aria-hidden="true" />,
    category: "Backend",
    type: "charge",
    channel: "api",
    amount: 25.0,
    currency: "USD",
    status: "failed",
    account: "•••• 9871",
    country: "United States",
    flag: "us",
    timezone: "PST (UTC−8)",
    note: "Card declined, retry scheduled",
  },
  {
    id: "txn_008",
    reference: "TXN-2025-000136",
    date: "2025-06-07T10:05:00Z",
    description: "Payout to linked bank · hobby tier balance",
    merchant: "Neon",
    merchantLogo: <Neon className="size-5" aria-hidden="true" />,
    category: "Infrastructure",
    type: "payout",
    channel: "dashboard",
    amount: -250.0,
    currency: "USD",
    status: "completed",
    account: "dev@acme.io",
    country: "Germany",
    flag: "de",
    timezone: "CET (UTC+1)",
  },
  {
    id: "txn_009",
    reference: "TXN-2025-000135",
    date: "2025-06-06T15:00:00Z",
    description: "ORM · team license",
    merchant: "Prisma",
    merchantLogo: PRISMA_LOGO,
    category: "Developer tools",
    type: "charge",
    channel: "invoice",
    amount: 60.0,
    currency: "USD",
    status: "completed",
    account: "•••• 4242",
    country: "Germany",
    flag: "de",
    timezone: "CET (UTC+1)",
  },
  {
    id: "txn_010",
    reference: "TXN-2025-000134",
    date: "2025-06-05T11:11:00Z",
    description: "Claude API · May usage",
    merchant: "Anthropic",
    merchantLogo: ANTHROPIC_LOGO,
    category: "AI / ML",
    type: "payment",
    channel: "api",
    amount: 2500.0,
    currency: "USD",
    status: "completed",
    account: "dev@acme.io",
    country: "Canada",
    flag: "ca",
    timezone: "EST (UTC−5)",
  },
]