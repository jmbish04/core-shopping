export type RegionId = "na" | "emea" | "apac" | "latam"

export type AccountTier = "Enterprise" | "Growth" | "Startup"

export type AccountHealth = "Healthy" | "Watch" | "At Risk"

export interface AccountOwner {
  id: string
  name: string
  initials: string
  avatarSrc?: string
  role: string
}

export interface Region {
  id: RegionId
  name: string
  summary: string
  order: number
}

export interface Account {
  id: string
  name: string
  industry: string
  regionId: RegionId
  owner: AccountOwner
  tier: AccountTier
  health: AccountHealth
  arr: number
  nrr: number
  renewalAt: string
  renewalLabel: string
}

// ── Row union (TanStack nested rows: region group → account leaf) ──

export interface RegionGroupRow {
  kind: "region"
  id: string
  region: Region
  subRows?: AccountRow[]
}

export interface AccountRow {
  kind: "account"
  id: string
  region: Region
  account: Account
}

export type PortfolioRow = RegionGroupRow | AccountRow

export const REGION_ORDER: RegionId[] = ["na", "emea", "apac", "latam"]

export const ACCOUNT_TIERS: AccountTier[] = ["Enterprise", "Growth", "Startup"]

export const ACCOUNT_HEALTH_OPTIONS: AccountHealth[] = [
  "Healthy",
  "Watch",
  "At Risk",
]

export const REGIONS: Region[] = [
  {
    id: "na",
    name: "North America",
    summary: "US and Canada strategic accounts",
    order: 1,
  },
  {
    id: "emea",
    name: "EMEA",
    summary: "Europe, Middle East, and Africa book",
    order: 2,
  },
  {
    id: "apac",
    name: "APAC",
    summary: "Asia Pacific growth territory",
    order: 3,
  },
  {
    id: "latam",
    name: "LATAM",
    summary: "Latin America emerging accounts",
    order: 4,
  },
]

export const ACCOUNT_OWNERS: AccountOwner[] = [
  {
    id: "rina",
    name: "Rina Holt",
    initials: "RH",
    avatarSrc:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
    role: "Enterprise AE",
  },
  {
    id: "vale",
    name: "Vale Aksoy",
    initials: "VA",
    avatarSrc:
      "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&dpr=2&q=80",
    role: "Strategic AE",
  },
  {
    id: "noor",
    name: "Noor Albright",
    initials: "NA",
    avatarSrc:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=96&h=96&dpr=2&q=80",
    role: "Account Manager",
  },
  {
    id: "sora",
    name: "Sora Min",
    initials: "SM",
    avatarSrc:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
    role: "Growth AE",
  },
  {
    id: "evren",
    name: "Evren Blake",
    initials: "EB",
    avatarSrc:
      "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=96&h=96&dpr=2&q=80",
    role: "Enterprise AE",
  },
  {
    id: "mina",
    name: "Mina Rowe",
    initials: "MR",
    avatarSrc:
      "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=96&h=96&dpr=2&q=80",
    role: "Account Manager",
  },
]

function owner(id: AccountOwner["id"]) {
  const match = ACCOUNT_OWNERS.find((item) => item.id === id)

  if (!match) {
    throw new Error(`Unknown account owner: ${id}`)
  }

  return match
}

export const ACCOUNTS: Account[] = [
  {
    id: "acc-northwind",
    name: "Northwind Trading",
    industry: "Logistics",
    regionId: "na",
    owner: owner("rina"),
    tier: "Enterprise",
    health: "Healthy",
    arr: 920000,
    nrr: 124,
    renewalAt: "2026-09-14",
    renewalLabel: "Sep 14, 2026",
  },
  {
    id: "acc-cedar",
    name: "Cedar Health Systems",
    industry: "Healthcare",
    regionId: "na",
    owner: owner("evren"),
    tier: "Enterprise",
    health: "Watch",
    arr: 760000,
    nrr: 103,
    renewalAt: "2026-07-02",
    renewalLabel: "Jul 2, 2026",
  },
  {
    id: "acc-vantage",
    name: "Vantage Robotics",
    industry: "Manufacturing",
    regionId: "na",
    owner: owner("rina"),
    tier: "Growth",
    health: "Healthy",
    arr: 410000,
    nrr: 118,
    renewalAt: "2026-11-21",
    renewalLabel: "Nov 21, 2026",
  },
  {
    id: "acc-brightline",
    name: "Brightline Media",
    industry: "Media",
    regionId: "na",
    owner: owner("mina"),
    tier: "Growth",
    health: "At Risk",
    arr: 285000,
    nrr: 92,
    renewalAt: "2026-06-30",
    renewalLabel: "Jun 30, 2026",
  },
  {
    id: "acc-summit",
    name: "Summit Analytics",
    industry: "Software",
    regionId: "na",
    owner: owner("evren"),
    tier: "Startup",
    health: "Healthy",
    arr: 138000,
    nrr: 129,
    renewalAt: "2026-10-09",
    renewalLabel: "Oct 9, 2026",
  },
  {
    id: "acc-helvetia",
    name: "Helvetia Pay",
    industry: "Fintech",
    regionId: "emea",
    owner: owner("vale"),
    tier: "Enterprise",
    health: "Healthy",
    arr: 845000,
    nrr: 121,
    renewalAt: "2026-08-18",
    renewalLabel: "Aug 18, 2026",
  },
  {
    id: "acc-nordwind",
    name: "Nordwind Energy",
    industry: "Energy",
    regionId: "emea",
    owner: owner("noor"),
    tier: "Enterprise",
    health: "Watch",
    arr: 690000,
    nrr: 99,
    renewalAt: "2026-07-27",
    renewalLabel: "Jul 27, 2026",
  },
  {
    id: "acc-albion",
    name: "Albion Retail Group",
    industry: "Retail",
    regionId: "emea",
    owner: owner("vale"),
    tier: "Growth",
    health: "At Risk",
    arr: 320000,
    nrr: 88,
    renewalAt: "2026-06-24",
    renewalLabel: "Jun 24, 2026",
  },
  {
    id: "acc-lumen",
    name: "Lumen Telecom",
    industry: "Telecom",
    regionId: "emea",
    owner: owner("noor"),
    tier: "Growth",
    health: "Healthy",
    arr: 455000,
    nrr: 115,
    renewalAt: "2026-12-03",
    renewalLabel: "Dec 3, 2026",
  },
  {
    id: "acc-castellan",
    name: "Castellan Bank",
    industry: "Banking",
    regionId: "emea",
    owner: owner("vale"),
    tier: "Enterprise",
    health: "Healthy",
    arr: 980000,
    nrr: 109,
    renewalAt: "2026-09-30",
    renewalLabel: "Sep 30, 2026",
  },
  {
    id: "acc-sakura",
    name: "Sakura Mobility",
    industry: "Mobility",
    regionId: "apac",
    owner: owner("sora"),
    tier: "Growth",
    health: "Healthy",
    arr: 372000,
    nrr: 126,
    renewalAt: "2026-10-22",
    renewalLabel: "Oct 22, 2026",
  },
  {
    id: "acc-pacific",
    name: "Pacific Cloud",
    industry: "Software",
    regionId: "apac",
    owner: owner("mina"),
    tier: "Enterprise",
    health: "Watch",
    arr: 615000,
    nrr: 101,
    renewalAt: "2026-08-05",
    renewalLabel: "Aug 5, 2026",
  },
  {
    id: "acc-banyan",
    name: "Banyan AgriTech",
    industry: "Agriculture",
    regionId: "na",
    owner: owner("sora"),
    tier: "Startup",
    health: "Healthy",
    arr: 124000,
    nrr: 132,
    renewalAt: "2026-11-12",
    renewalLabel: "Nov 12, 2026",
  },
  {
    id: "acc-meridian",
    name: "Meridian Shipping",
    industry: "Logistics",
    regionId: "apac",
    owner: owner("mina"),
    tier: "Growth",
    health: "At Risk",
    arr: 298000,
    nrr: 90,
    renewalAt: "2026-06-27",
    renewalLabel: "Jun 27, 2026",
  },
  {
    id: "acc-hanwoo",
    name: "Hanwoo Foods",
    industry: "Food and Beverage",
    regionId: "apac",
    owner: owner("sora"),
    tier: "Growth",
    health: "Healthy",
    arr: 340000,
    nrr: 112,
    renewalAt: "2026-09-08",
    renewalLabel: "Sep 8, 2026",
  },
  {
    id: "acc-andes",
    name: "Andes Fintech",
    industry: "Fintech",
    regionId: "na",
    owner: owner("noor"),
    tier: "Growth",
    health: "Healthy",
    arr: 268000,
    nrr: 122,
    renewalAt: "2026-10-30",
    renewalLabel: "Oct 30, 2026",
  },
  {
    id: "acc-costera",
    name: "Costera Travel",
    industry: "Travel",
    regionId: "latam",
    owner: owner("rina"),
    tier: "Startup",
    health: "Watch",
    arr: 96000,
    nrr: 104,
    renewalAt: "2026-07-15",
    renewalLabel: "Jul 15, 2026",
  },
  {
    id: "acc-verde",
    name: "Verde Logistics",
    industry: "Logistics",
    regionId: "latam",
    owner: owner("evren"),
    tier: "Growth",
    health: "Healthy",
    arr: 312000,
    nrr: 117,
    renewalAt: "2026-12-09",
    renewalLabel: "Dec 9, 2026",
  },
  {
    id: "acc-pampa",
    name: "Pampa Retail",
    industry: "Retail",
    regionId: "latam",
    owner: owner("sora"),
    tier: "Startup",
    health: "At Risk",
    arr: 142000,
    nrr: 89,
    renewalAt: "2026-06-22",
    renewalLabel: "Jun 22, 2026",
  },
  {
    id: "acc-tucan",
    name: "Tucan Media",
    industry: "Media",
    regionId: "emea",
    owner: owner("noor"),
    tier: "Growth",
    health: "Healthy",
    arr: 205000,
    nrr: 113,
    renewalAt: "2026-09-19",
    renewalLabel: "Sep 19, 2026",
  },
]

// ── Formatting + aggregate helpers (raw values stay in data, formatting here) ──

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(value)
}

/** Compact money for dense KPI/subtotal slots: 2_513_000 -> "$2.51M". */
export function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000)}K`
  }
  return formatCurrency(value)
}

export function sumArr(accounts: Account[]) {
  return accounts.reduce((total, account) => total + account.arr, 0)
}

/** ARR-weighted NRR so big accounts move the group average correctly. */
export function weightedNrr(accounts: Account[]) {
  const totalArr = sumArr(accounts)
  if (totalArr === 0) return 0
  const weighted = accounts.reduce(
    (total, account) => total + account.arr * account.nrr,
    0
  )
  return Math.round(weighted / totalArr)
}

/** Earliest renewal date in the group (ISO strings sort lexicographically). */
export function nextRenewal(accounts: Account[]) {
  return accounts.reduce<Account | null>((earliest, account) => {
    if (!earliest || account.renewalAt < earliest.renewalAt) return account
    return earliest
  }, null)
}