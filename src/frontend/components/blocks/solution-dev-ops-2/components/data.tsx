import { type BadgeProps } from "@/components/reui/badge"
import { type FilterQuery } from "@/components/reui/filters/filters-types"

import { type ChartConfig } from "@/components/ui/chart"

export const REFERENCE_DATE = "2026-09-29T14:20:00Z"

/** The signed-in reviewer: every "Mark reviewed" is stamped with this person. */
export const CURRENT_REVIEWER: PersonId = "sarah-chen"

/** Copy link target; `.example` is a reserved TLD, so it never resolves. */
export const AUDIT_LINK_BASE = "https://ops.lumenharbor.example/audit"

export type Outcome = "success" | "denied" | "failed"
export type Category = "deploy" | "config" | "secret" | "access" | "infra"
export type Environment = "production" | "staging" | "sandbox"
export type Cluster = "prod-us-east-1" | "prod-eu-west-1" | "staging-us-east-1"
export type Source = "console" | "cli" | "api" | "terraform" | "github-actions"
export type ResourceType =
  | "deployment"
  | "service"
  | "cluster"
  | "database"
  | "secret"
  | "role"
  | "apikey"
  | "flag"
  | "job"
export type AuthMethod = "sso_mfa" | "sso_device" | "oidc" | "service_key"
export type ReviewState = "needs_review" | "reviewed" | "not_required"
export type TimeRange = "1h" | "24h" | "7d" | "30d"

export type PersonId =
  | "nina-santos"
  | "omar-haddad"
  | "sarah-chen"
  | "david-kim"
  | "sofia-romero"
  | "kenji-tan"
  | "emma-wilson"
  | "michael-rodriguez"
  | "priya-patel"
  | "alex-johnson"
export type ServiceId = "github-actions" | "cloud-build" | "vercel" | "n8n"
export type ActorId = PersonId | ServiceId
export type Team = "Platform" | "Payments" | "Risk" | "Data" | "SRE"

export type Actor =
  | {
      id: PersonId
      kind: "human"
      name: string
      role: string
      team: Team
      avatar: string
      initials: string
      ip: string
    }
  | {
      id: ServiceId
      kind: "service"
      name: string
      role: "Service account"
      team: Team
      ip: string
    }

export type Resource = { type: ResourceType; name: string; id: string }

export type ChangeKey =
  | "rolloutPromote"
  | "imageTag"
  | "ledgerWorkerImage"
  | "roleBinding"
  | "secretRotate"
  | "nodePool"
  | "fraudThreshold"
  | "ledgerDbParams"
  | "jobSchedule"
  | "apiKeyCreate"
  | "flagToggle"

export type ChangeDiff = {
  file: string
  language: "yaml" | "json"
  code: string
  /** CodeBlock line specs, "4,6" or "1-7". */
  added: string
  removed?: string
  /** Secret values were masked before the change was written. */
  redacted?: boolean
}

export type AuditEvent = {
  /** "EVT-9f3a21": the character after "EVT-" is always a digit. */
  id: string
  at: string
  actorId: ActorId
  action: string
  category: Category
  resource: Resource
  environment: Environment
  cluster?: Cluster
  source: Source
  ip: string
  authMethod: AuthMethod
  /** "ses_xxxxxx" for people, "wl_<name>" for workload identities. */
  sessionId: string
  requestId: string
  traceId: string
  outcome: Outcome
  reason?: string
  summary: string
  changeKey?: ChangeKey
  reviewedBy?: PersonId
  reviewedAt?: string
}

export type SavedView = {
  id: string
  name: string
  query: FilterQuery
  builtIn: boolean
}

// ── Actors ──

export const ACTORS: Record<ActorId, Actor> = {
  "nina-santos": {
    id: "nina-santos",
    kind: "human",
    name: "Nina Santos",
    role: "Staff SRE",
    team: "SRE",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&dpr=2&q=80",
    initials: "NS",
    ip: "203.0.113.40",
  },
  "omar-haddad": {
    id: "omar-haddad",
    kind: "human",
    name: "Omar Haddad",
    role: "Platform lead",
    team: "Platform",
    avatar:
      "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&dpr=2&q=80",
    initials: "OH",
    ip: "203.0.113.12",
  },
  "sarah-chen": {
    id: "sarah-chen",
    kind: "human",
    name: "Sarah Chen",
    role: "Security and compliance lead",
    team: "Platform",
    avatar:
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
    initials: "SC",
    ip: "203.0.113.66",
  },
  "david-kim": {
    id: "david-kim",
    kind: "human",
    name: "David Kim",
    role: "Payments engineer",
    team: "Payments",
    avatar:
      "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
    initials: "DK",
    ip: "203.0.113.52",
  },
  "sofia-romero": {
    id: "sofia-romero",
    kind: "human",
    name: "Sofia Romero",
    role: "Data engineer",
    team: "Data",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80",
    initials: "SR",
    ip: "203.0.113.76",
  },
  "kenji-tan": {
    id: "kenji-tan",
    kind: "human",
    name: "Kenji Tan",
    role: "Risk engineer",
    team: "Risk",
    avatar:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=96&h=96&dpr=2&q=80",
    initials: "KT",
    ip: "203.0.113.91",
  },
  "emma-wilson": {
    id: "emma-wilson",
    kind: "human",
    name: "Emma Wilson",
    role: "Release manager",
    team: "Platform",
    avatar:
      "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
    initials: "EW",
    ip: "203.0.113.24",
  },
  "michael-rodriguez": {
    id: "michael-rodriguez",
    kind: "human",
    name: "Michael Rodriguez",
    role: "Infrastructure engineer",
    team: "SRE",
    avatar:
      "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
    initials: "MR",
    ip: "203.0.113.85",
  },
  "priya-patel": {
    id: "priya-patel",
    kind: "human",
    name: "Priya Patel",
    role: "Payments engineering manager",
    team: "Payments",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
    initials: "PP",
    ip: "203.0.113.18",
  },
  "alex-johnson": {
    id: "alex-johnson",
    kind: "human",
    name: "Alex Johnson",
    role: "Database reliability engineer",
    team: "SRE",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
    initials: "AJ",
    ip: "203.0.113.33",
  },
  "github-actions": {
    id: "github-actions",
    kind: "service",
    name: "GitHub Actions",
    role: "Service account",
    team: "Platform",
    ip: "198.51.100.42",
  },
  "cloud-build": {
    id: "cloud-build",
    kind: "service",
    name: "Cloud Build",
    role: "Service account",
    team: "Platform",
    ip: "198.51.100.61",
  },
  vercel: {
    id: "vercel",
    kind: "service",
    name: "Vercel",
    role: "Service account",
    team: "Platform",
    ip: "198.51.100.14",
  },
  n8n: {
    id: "n8n",
    kind: "service",
    name: "n8n",
    role: "Service account",
    team: "SRE",
    ip: "198.51.100.8",
  },
}

/** Menu order: people by role weight, then the four service accounts. */
export const ACTOR_ORDER: ActorId[] = [
  "sarah-chen",
  "omar-haddad",
  "nina-santos",
  "emma-wilson",
  "david-kim",
  "priya-patel",
  "sofia-romero",
  "kenji-tan",
  "michael-rodriguez",
  "alex-johnson",
  "github-actions",
  "cloud-build",
  "vercel",
  "n8n",
]

// ── Labels and badge maps ──

export const OUTCOME_CONFIG: Record<
  Outcome,
  { label: string; variant: BadgeProps["variant"] }
> = {
  success: { label: "Success", variant: "success-light" },
  denied: { label: "Denied", variant: "warning-light" },
  failed: { label: "Failed", variant: "destructive-light" },
}

export const REVIEW_CONFIG: Record<
  ReviewState,
  { label: string; variant: BadgeProps["variant"] | null }
> = {
  needs_review: { label: "Needs review", variant: "info-light" },
  reviewed: { label: "Reviewed", variant: "success-light" },
  // Muted plain text: a badge on every routine event would be noise.
  not_required: { label: "Not required", variant: null },
}

/** The volume chart's key: each dot is the full colour its bars hatch. */
export const OUTCOME_DOT: Record<Outcome, string> = {
  success: "bg-success",
  denied: "bg-warning",
  failed: "bg-destructive",
}

export const ENV_LABEL: Record<Environment, string> = {
  production: "Production",
  staging: "Staging",
  sandbox: "Sandbox",
}

export const CATEGORY_LABEL: Record<Category, string> = {
  deploy: "Deploy",
  config: "Config",
  secret: "Secret",
  access: "Access",
  infra: "Infra",
}

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  deployment: "Deployment",
  service: "Service",
  cluster: "Cluster",
  database: "Database",
  secret: "Secret",
  role: "Role",
  apikey: "API key",
  flag: "Flag",
  job: "Job",
}

export const SOURCE_LABEL: Record<Source, string> = {
  console: "Console",
  cli: "CLI",
  api: "API",
  terraform: "Terraform",
  "github-actions": "GitHub Actions",
}

export const AUTH_LABEL: Record<AuthMethod, string> = {
  sso_mfa: "SSO with WebAuthn",
  sso_device: "SSO device code",
  oidc: "OIDC workload identity",
  service_key: "Service account key",
}

export const VOLUME_CHART_CONFIG = {
  success: { label: "Success", color: "var(--success)" },
  denied: { label: "Denied", color: "var(--warning)" },
  failed: { label: "Failed", color: "var(--destructive)" },
} satisfies ChartConfig

export const TIME_RANGES: Record<
  TimeRange,
  { label: string; minutes: number; bucketMinutes: number; bucketLabel: string }
> = {
  "1h": {
    label: "Last hour",
    minutes: 60,
    bucketMinutes: 5,
    bucketLabel: "5-minute buckets",
  },
  "24h": {
    label: "Last 24 hours",
    minutes: 1440,
    bucketMinutes: 60,
    bucketLabel: "Hourly buckets",
  },
  "7d": {
    label: "Last 7 days",
    minutes: 10080,
    bucketMinutes: 360,
    bucketLabel: "6-hour buckets",
  },
  "30d": {
    label: "Last 30 days",
    minutes: 43200,
    bucketMinutes: 1440,
    bucketLabel: "Daily buckets",
  },
}

export const TIME_RANGE_ORDER: TimeRange[] = ["1h", "24h", "7d", "30d"]

// ── Anchor events: the last 22 hours, written by hand ──

const ANCHOR_EVENTS: AuditEvent[] = [
  {
    id: "EVT-9f3a21",
    at: "2026-09-29T14:12:08Z",
    actorId: "emma-wilson",
    action: "deployment.promote",
    category: "deploy",
    resource: { type: "deployment", name: "payments-api", id: "DEP-4127" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "console",
    ip: "203.0.113.24",
    authMethod: "sso_mfa",
    sessionId: "ses_4QmT8x",
    requestId: "req_01J8ZK4M2Q",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    outcome: "success",
    summary:
      "Promoted payments-api v2.41.0 from the 50% canary to all production traffic.",
    changeKey: "rolloutPromote",
  },
  {
    id: "EVT-3c95d1",
    at: "2026-09-29T14:06:30Z",
    actorId: "david-kim",
    action: "access.request.create",
    category: "access",
    resource: { type: "role", name: "prod-db-admin", id: "role_prod_db_admin" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "cli",
    ip: "203.0.113.57",
    authMethod: "sso_device",
    sessionId: "ses_8Hq2xV",
    requestId: "req_01J8ZKB2R5",
    traceId: "6e1d4b9a2c7f40e8b3a5d9c1f0e27b64",
    outcome: "success",
    summary: "Requested four hours of prod-db-admin, pending an SRE approver.",
  },
  {
    id: "EVT-8c21d7",
    at: "2026-09-29T14:05:41Z",
    actorId: "david-kim",
    action: "iam.role.grant",
    category: "access",
    resource: { type: "role", name: "prod-db-admin", id: "role_prod_db_admin" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "cli",
    ip: "203.0.113.57",
    authMethod: "sso_device",
    sessionId: "ses_8Hq2xV",
    requestId: "req_01J8ZK9T7N",
    traceId: "0af7651916cd43dd8448eb211c80319c",
    outcome: "denied",
    reason:
      "David Kim cannot grant himself prod-db-admin. Production role grants need a second approver from SRE.",
    summary:
      "Tried to add himself to prod-db-admin on prod-us-east-1 for four hours.",
    changeKey: "roleBinding",
  },
  {
    id: "EVT-2b64e0",
    at: "2026-09-29T13:59:47Z",
    actorId: "david-kim",
    action: "secret.reveal",
    category: "secret",
    resource: {
      type: "secret",
      name: "ledger-db-admin-dsn",
      id: "sec_ledger_admin",
    },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "cli",
    ip: "203.0.113.57",
    authMethod: "sso_device",
    sessionId: "ses_8Hq2xV",
    requestId: "req_01J8ZK6P3W",
    traceId: "b7ad6b7169203331a4c1e7f2d9083e15",
    outcome: "denied",
    reason:
      "Revealing production secrets needs an approved break-glass request.",
    summary: "Tried to reveal the ledger admin connection string.",
  },
  {
    id: "EVT-7e0b94",
    at: "2026-09-29T13:58:12Z",
    actorId: "vercel",
    action: "rollout.step",
    category: "deploy",
    resource: { type: "deployment", name: "payments-api", id: "DEP-4127" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "api",
    ip: "198.51.100.14",
    authMethod: "oidc",
    sessionId: "wl_vercel_prod",
    requestId: "req_01J8ZK4M2Q",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    outcome: "success",
    summary:
      "Canary analysis passed at 50%: p99 latency 182 ms, error rate 0.02%.",
  },
  {
    id: "EVT-7d2c58",
    at: "2026-09-29T13:54:47Z",
    actorId: "vercel",
    action: "rollout.step",
    category: "deploy",
    resource: { type: "deployment", name: "payments-api", id: "DEP-4127" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "api",
    ip: "198.51.100.14",
    authMethod: "oidc",
    sessionId: "wl_vercel_prod",
    requestId: "req_01J8ZK4M2Q",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    outcome: "success",
    summary:
      "Canary analysis passed at 25%: p99 latency 176 ms, error rate 0.01%.",
  },
  {
    id: "EVT-6d4f02",
    at: "2026-09-29T13:51:30Z",
    actorId: "github-actions",
    action: "deployment.create",
    category: "deploy",
    resource: { type: "deployment", name: "payments-api", id: "DEP-4127" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "github-actions",
    ip: "198.51.100.42",
    authMethod: "oidc",
    sessionId: "wl_gha_payments",
    requestId: "req_01J8ZK4M2Q",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    outcome: "success",
    summary: "Created DEP-4127 for payments-api v2.41.0 from main at 8e2c41f.",
    changeKey: "imageTag",
  },
  {
    id: "EVT-5a9e3c",
    at: "2026-09-29T13:40:00Z",
    actorId: "n8n",
    action: "secret.rotate",
    category: "secret",
    resource: {
      type: "secret",
      name: "webhook-signing-key",
      id: "sec_whk_prod",
    },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "api",
    ip: "198.51.100.8",
    authMethod: "service_key",
    sessionId: "wl_n8n_scheduler",
    requestId: "req_01J8ZJ2B6F",
    traceId: "5c1e0d93a7f24b8e9d6a0f31c2b47e88",
    outcome: "success",
    summary: "Rotated the webhook signing key for JOB-221.",
    changeKey: "secretRotate",
    reviewedBy: "sarah-chen",
    reviewedAt: "2026-09-29T14:02:00Z",
  },
  {
    id: "EVT-4b17e8",
    at: "2026-09-29T13:22:47Z",
    actorId: "cloud-build",
    action: "infra.apply",
    category: "infra",
    resource: {
      type: "cluster",
      name: "prod-eu-west-1",
      id: "ws-prod-eu-west-1",
    },
    environment: "production",
    cluster: "prod-eu-west-1",
    source: "terraform",
    ip: "198.51.100.61",
    authMethod: "service_key",
    sessionId: "wl_cloudbuild_prod",
    requestId: "req_01J8ZH8W1C",
    traceId: "9e3d2a61f0b84c57a12e6d4b8f07c3a9",
    outcome: "success",
    summary:
      "Applied run-4kTz9: scaled node pool general-v3 from 12 to 16 nodes.",
    changeKey: "nodePool",
  },
  {
    id: "EVT-3f88a0",
    at: "2026-09-29T12:47:15Z",
    actorId: "kenji-tan",
    action: "config.update",
    category: "config",
    resource: { type: "service", name: "fraud-scorer", id: "svc_fraud_scorer" },
    environment: "production",
    cluster: "prod-eu-west-1",
    source: "console",
    ip: "203.0.113.91",
    authMethod: "sso_mfa",
    sessionId: "ses_2Wn7Lc",
    requestId: "req_01J8ZF3K9D",
    traceId: "1d7c4e2b9a0f43e6b8c5d2a7e9f01b34",
    outcome: "success",
    summary: "Lowered the card-not-present block threshold from 0.82 to 0.78.",
    changeKey: "fraudThreshold",
  },
  {
    id: "EVT-2c50f9",
    at: "2026-09-29T12:10:03Z",
    actorId: "alex-johnson",
    action: "database.parameter.update",
    category: "config",
    resource: { type: "database", name: "ledger-db", id: "db_ledger_prod" },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "cli",
    ip: "203.0.113.33",
    authMethod: "sso_device",
    sessionId: "ses_5Tz9Kd",
    requestId: "req_01J8ZE6M1A",
    traceId: "3a9f0c6d1e8b47f2a5c4e7d0b9f13c28",
    outcome: "success",
    summary:
      "Raised ledger-db max_connections from 400 to 600 ahead of month-end close.",
    changeKey: "ledgerDbParams",
  },
  {
    id: "EVT-1e93c4",
    at: "2026-09-29T10:02:56Z",
    actorId: "github-actions",
    action: "deployment.create",
    category: "deploy",
    resource: { type: "deployment", name: "ledger-worker", id: "DEP-4124" },
    environment: "staging",
    cluster: "staging-us-east-1",
    source: "github-actions",
    ip: "198.51.100.42",
    authMethod: "oidc",
    sessionId: "wl_gha_ledger",
    requestId: "req_01J8Z8Q4XE",
    traceId: "c03f8b1e6d2a4970b5e4a8d1f6c29e07",
    outcome: "failed",
    reason:
      "Pods exited with code 137 (OOMKilled) during startup; the rollout halted at 0% and staging kept v1.18.3.",
    summary: "Deployment DEP-4124 for ledger-worker v1.18.4 did not start.",
    changeKey: "ledgerWorkerImage",
  },
  {
    id: "EVT-9b2e15",
    at: "2026-09-29T08:15:09Z",
    actorId: "sofia-romero",
    action: "secret.reveal",
    category: "secret",
    resource: {
      type: "secret",
      name: "ledger-db-readonly-dsn",
      id: "sec_ledger_ro",
    },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "console",
    ip: "203.0.113.76",
    authMethod: "sso_mfa",
    sessionId: "ses_9Pc4Rk",
    requestId: "req_01J8Z5D2HV",
    traceId: "7f2a9c4e1b6d48a3905e2c7b1d8f4a60",
    outcome: "denied",
    reason: "Break-glass request expired after 15 minutes without approval.",
    summary: "Tried to reveal the read-only ledger connection string.",
  },
  {
    id: "EVT-8a61f0",
    at: "2026-09-28T22:31:44Z",
    actorId: "priya-patel",
    action: "apikey.create",
    category: "access",
    resource: {
      type: "apikey",
      name: "payouts-partner-key",
      id: "key_payouts_live",
    },
    environment: "production",
    source: "console",
    ip: "203.0.113.18",
    authMethod: "sso_mfa",
    sessionId: "ses_3Kd8Vn",
    requestId: "req_01J8XQ7C5M",
    traceId: "2e8b5d1a9c4f47b0a6d3e1f8c7b20d95",
    outcome: "success",
    summary:
      "Created a live payouts partner key sk_live_****9f2c scoped to payouts:write.",
    changeKey: "apiKeyCreate",
    reviewedBy: "sarah-chen",
    reviewedAt: "2026-09-29T08:02:00Z",
  },
  {
    id: "EVT-6c1a93",
    at: "2026-09-28T16:40:00Z",
    actorId: "nina-santos",
    action: "job.schedule.update",
    category: "config",
    resource: {
      type: "job",
      name: "Nightly ledger reconciliation",
      id: "JOB-214",
    },
    environment: "production",
    cluster: "prod-us-east-1",
    source: "console",
    ip: "203.0.113.40",
    authMethod: "sso_mfa",
    sessionId: "ses_6Jw1Qe",
    requestId: "req_01J8X2N8TB",
    traceId: "8d4f1b7e2c9a40d6b3e5a1c8f2d7e046",
    outcome: "success",
    summary: "Moved the nightly reconciliation from 03:30 to 02:00 UTC.",
    changeKey: "jobSchedule",
  },
]

// ── Config diffs: code has no trailing newline, line specs count from 1 ──

export const CHANGES: Record<ChangeKey, ChangeDiff> = {
  rolloutPromote: {
    file: "rollouts/payments-api.yaml",
    language: "yaml",
    removed: "9,11,13",
    added: "10,12,14",
    code: [
      "spec:",
      "  strategy:",
      "    canary:",
      "      steps:",
      "        - setWeight: 25",
      "        - setWeight: 50",
      "        - setWeight: 100",
      "status:",
      "  currentStepIndex: 1",
      "  currentStepIndex: 2",
      "  canaryWeight: 50",
      "  canaryWeight: 100",
      "  stableRS: payments-api-6f9c7d",
      "  stableRS: payments-api-7b41e2",
    ].join("\n"),
  },
  imageTag: {
    file: "charts/payments-api/values.yaml",
    language: "yaml",
    removed: "3,7",
    added: "4,8",
    code: [
      "image:",
      "  repository: registry.lumenharbor.example/payments-api",
      "  tag: v2.40.3",
      "  tag: v2.41.0",
      "replicaCount: 12",
      "env:",
      '  LEDGER_TIMEOUT_MS: "1500"',
      '  LEDGER_TIMEOUT_MS: "1200"',
    ].join("\n"),
  },
  ledgerWorkerImage: {
    file: "charts/ledger-worker/values.yaml",
    language: "yaml",
    removed: "3",
    added: "4",
    code: [
      "image:",
      "  repository: registry.lumenharbor.example/ledger-worker",
      "  tag: v1.18.3",
      "  tag: v1.18.4",
      "resources:",
      "  limits:",
      "    memory: 512Mi",
    ].join("\n"),
  },
  roleBinding: {
    file: "iam/prod-db-admin.yaml",
    language: "yaml",
    removed: "9",
    added: "6,10",
    code: [
      "role: prod-db-admin",
      "cluster: prod-us-east-1",
      "members:",
      "  - user:alex.johnson",
      "  - user:nina.santos",
      "  - user:david.kim",
      "approvers:",
      "  - group:sre-leads",
      "expiresAt: null",
      "expiresAt: 2026-09-29T18:05:41Z",
    ].join("\n"),
  },
  secretRotate: {
    file: "secrets/webhook-signing-key.json",
    language: "json",
    redacted: true,
    removed: "3,5",
    added: "4,6",
    code: [
      "{",
      '  "secret": "webhook-signing-key",',
      '  "version": 41,',
      '  "version": 42,',
      '  "keyId": "whsec_****1b7e",',
      '  "keyId": "whsec_****c83e",',
      '  "value": "[redacted]",',
      '  "rotatedBy": "JOB-221",',
      '  "nextRotation": "2026-10-05T04:00:00Z"',
      "}",
    ].join("\n"),
  },
  nodePool: {
    file: "terraform/prod-eu-west-1/node_pools.tfvars.json",
    language: "json",
    removed: "4,6",
    added: "5,7",
    code: [
      "{",
      '  "pool": "general-v3",',
      '  "machine_type": "n2-standard-8",',
      '  "min_size": 12,',
      '  "min_size": 16,',
      '  "max_size": 18,',
      '  "max_size": 24,',
      '  "autoscaling": true',
      "}",
    ].join("\n"),
  },
  fraudThreshold: {
    file: "fraud-scorer/config.yaml",
    language: "yaml",
    removed: "4",
    added: "5",
    code: [
      "model: cnp-gbm-2026-09",
      "thresholds:",
      "  review: 0.64",
      "  block: 0.82",
      "  block: 0.78",
      "shadow_mode: false",
    ].join("\n"),
  },
  ledgerDbParams: {
    file: "databases/ledger-db/parameters.yaml",
    language: "yaml",
    removed: "3",
    added: "4",
    code: [
      "instance: ledger-db",
      "parameters:",
      "  max_connections: 400",
      "  max_connections: 600",
      "  shared_buffers: 16GB",
      "  statement_timeout: 30s",
    ].join("\n"),
  },
  jobSchedule: {
    file: "jobs/JOB-214.yaml",
    language: "yaml",
    removed: "3",
    added: "4",
    code: [
      "id: JOB-214",
      "name: Nightly ledger reconciliation",
      'schedule: "30 3 * * *"',
      'schedule: "0 2 * * *"',
      "timezone: UTC",
      "concurrency: Forbid",
    ].join("\n"),
  },
  // Nothing removed, so `removed` is left out rather than set to "".
  apiKeyCreate: {
    file: "keys/payouts-partner-key.json",
    language: "json",
    redacted: true,
    added: "1-7",
    code: [
      "{",
      '  "name": "payouts-partner-key",',
      '  "prefix": "sk_live_****9f2c",',
      '  "scopes": ["payouts:write"],',
      '  "environment": "production",',
      '  "expiresAt": "2027-03-28T22:31:44Z"',
      "}",
    ].join("\n"),
  },
  flagToggle: {
    file: "flags/payouts.instant_settlement.json",
    language: "json",
    removed: "3,5",
    added: "4,6",
    code: [
      "{",
      '  "flag": "payouts.instant_settlement",',
      '  "enabled": false,',
      '  "enabled": true,',
      '  "rollout": 10,',
      '  "rollout": 25,',
      '  "segments": ["sandbox-partners"]',
      "}",
    ].join("\n"),
  },
}

// ── Background events: 18 templates, index arithmetic only ──

type SummaryContext = { r: Resource; i: number; m: number; ok: boolean }

type Template = {
  action: string
  category: Category
  actors: ActorId[]
  resources: Resource[]
  /** A list cycles; a function reads the environment off the resource. */
  environments: Environment[] | ((resource: Resource) => Environment)
  source: Source
  authMethod: AuthMethod
  outcomes: Outcome[]
  summary: (context: SummaryContext) => string
  reason?: string
  changeKey?: ChangeKey
}

const deployment = (name: string): Resource => ({
  type: "deployment",
  name,
  id: "",
})

const DEPLOY_POOL = [
  deployment("webhook-dispatcher"),
  deployment("search-indexer"),
  deployment("notifications"),
  deployment("reconciliation"),
  deployment("payouts-scheduler"),
]

const isCluster = (name: string): name is Cluster =>
  name === "prod-us-east-1" ||
  name === "prod-eu-west-1" ||
  name === "staging-us-east-1"

const envOfName = (resource: Resource): Environment =>
  resource.name.startsWith("prod") ? "production" : "staging"

const ALNUM = "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const HEX = "0123456789abcdef"

/** Deterministic token from an integer seed (an xorshift walk, no Math.random). */
function token(seed: number, length: number, alphabet: string) {
  let state = (Math.imul(seed + 1, 0x9e3779b1) ^ 0x5bd1e995) >>> 0
  let out = ""
  for (let k = 0; k < length; k++) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    out += alphabet[state % alphabet.length]
  }
  return out
}

const TEMPLATES: Template[] = [
  {
    action: "deployment.create",
    category: "deploy",
    actors: ["github-actions"],
    resources: DEPLOY_POOL,
    environments: ["staging", "production"],
    source: "github-actions",
    authMethod: "oidc",
    outcomes: ["success", "success", "success", "success", "failed"],
    summary: ({ r, ok }) =>
      ok
        ? `Created ${r.id} for ${r.name} from main.`
        : `Tried to create ${r.id} for ${r.name} from main.`,
    reason: "Integration tests timed out after 15 minutes; nothing shipped.",
  },
  {
    action: "rollout.step",
    category: "deploy",
    actors: ["vercel"],
    resources: DEPLOY_POOL,
    environments: ["production"],
    source: "api",
    authMethod: "oidc",
    outcomes: ["success", "success", "success", "failed"],
    summary: ({ r, m, ok }) =>
      ok
        ? `Canary step passed at ${m % 2 ? 50 : 25}% for ${r.name}.`
        : `Canary step failed for ${r.name}; the rollout paused.`,
    reason:
      "Canary analysis failed: error rate 1.9% against a 1% budget; rollout paused.",
  },
  {
    action: "deployment.promote",
    category: "deploy",
    actors: ["emma-wilson", "omar-haddad"],
    resources: DEPLOY_POOL,
    environments: ["production"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: ({ r }) => `Promoted ${r.name} to all production traffic.`,
  },
  {
    action: "deployment.rollback",
    category: "deploy",
    actors: ["nina-santos", "michael-rodriguez"],
    resources: DEPLOY_POOL,
    environments: ["production"],
    source: "cli",
    authMethod: "sso_device",
    outcomes: ["success"],
    summary: ({ r }) => `Rolled ${r.name} back to the last stable release.`,
  },
  {
    action: "config.update",
    category: "config",
    actors: ["kenji-tan", "david-kim", "priya-patel"],
    resources: [
      { type: "service", name: "payouts-scheduler", id: "svc_payouts_sched" },
      { type: "service", name: "webhook-dispatcher", id: "svc_webhook_disp" },
      { type: "service", name: "fraud-scorer", id: "svc_fraud_scorer" },
    ],
    environments: ["production", "staging"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success", "success", "success", "denied"],
    summary: ({ r, ok }) =>
      ok
        ? `Updated runtime config for ${r.name}.`
        : `Tried to update runtime config for ${r.name}.`,
    reason: "Runtime config changes need an approved change ticket.",
  },
  {
    action: "flag.update",
    category: "config",
    actors: ["david-kim", "sofia-romero"],
    resources: [
      {
        type: "flag",
        name: "payouts.instant_settlement",
        id: "flg_instant_settlement",
      },
    ],
    environments: ["sandbox"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: () =>
      "Raised payouts.instant_settlement to 25% of sandbox partners.",
    changeKey: "flagToggle",
  },
  {
    action: "job.run",
    category: "config",
    actors: ["nina-santos", "sofia-romero"],
    resources: [
      { type: "job", name: "Rotate webhook signing keys", id: "JOB-221" },
      { type: "job", name: "Nightly ledger reconciliation", id: "JOB-214" },
    ],
    environments: ["production"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: ({ r }) => `Ran ${r.id} on demand.`,
  },
  {
    action: "job.pause",
    category: "config",
    actors: ["sofia-romero"],
    resources: [
      { type: "job", name: "Nightly ledger reconciliation", id: "JOB-214" },
    ],
    environments: ["production"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: ({ r }) => `Paused ${r.id} during the ledger schema migration.`,
  },
  {
    action: "secret.rotate",
    category: "secret",
    actors: ["n8n"],
    resources: [
      { type: "secret", name: "webhook-signing-key", id: "sec_whk_prod" },
      {
        type: "secret",
        name: "payouts-bank-api-token",
        id: "sec_payouts_bank",
      },
      { type: "secret", name: "search-indexer-api-key", id: "sec_search_api" },
    ],
    environments: ["production"],
    source: "api",
    authMethod: "service_key",
    outcomes: ["success"],
    summary: ({ r }) => `Rotated ${r.name} on its rotation schedule.`,
  },
  {
    action: "secret.reveal",
    category: "secret",
    actors: ["alex-johnson", "sofia-romero", "david-kim"],
    resources: [
      {
        type: "secret",
        name: "payouts-bank-api-token",
        id: "sec_payouts_bank",
      },
      { type: "secret", name: "ledger-db-readonly-dsn", id: "sec_ledger_ro" },
    ],
    environments: ["production"],
    source: "cli",
    authMethod: "sso_device",
    outcomes: ["success", "denied", "success"],
    summary: ({ r, ok }) =>
      ok
        ? `Revealed ${r.name} under an approved break-glass request.`
        : `Tried to reveal ${r.name}.`,
    reason:
      "Revealing production secrets needs an approved break-glass request.",
  },
  {
    action: "secret.update",
    category: "secret",
    actors: ["michael-rodriguez"],
    resources: [
      {
        type: "secret",
        name: "staging-smtp-password",
        id: "sec_smtp_staging",
      },
    ],
    environments: ["staging"],
    source: "terraform",
    authMethod: "service_key",
    outcomes: ["success"],
    summary: ({ r }) => `Updated ${r.name} from the staging workspace.`,
  },
  {
    action: "iam.role.grant",
    category: "access",
    actors: ["omar-haddad", "nina-santos"],
    // Ordered so every denied grant lands on prod-db-admin, as its reason says.
    resources: [
      { type: "role", name: "prod-db-admin", id: "role_prod_db_admin" },
      { type: "role", name: "prod-read-only", id: "role_prod_read_only" },
      { type: "role", name: "staging-deployer", id: "role_staging_deployer" },
    ],
    environments: envOfName,
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success", "success", "denied"],
    summary: ({ r, ok }) =>
      ok
        ? `Granted ${r.name} to an on-call engineer for 8 hours.`
        : `Tried to grant ${r.name} to an on-call engineer.`,
    reason: "Grants to prod-db-admin need a second approver from SRE.",
  },
  {
    action: "iam.role.revoke",
    category: "access",
    actors: ["sarah-chen"],
    resources: [
      { type: "role", name: "prod-read-only", id: "role_prod_read_only" },
      { type: "role", name: "staging-deployer", id: "role_staging_deployer" },
    ],
    environments: envOfName,
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: ({ r }) => `Revoked ${r.name} after the quarterly access review.`,
  },
  {
    action: "apikey.create",
    category: "access",
    actors: ["priya-patel", "david-kim"],
    resources: [
      {
        type: "apikey",
        name: "sandbox-partner-key",
        id: "key_sandbox_partner",
      },
    ],
    environments: ["sandbox"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: ({ i }) =>
      `Created sandbox-partner-key sk_test_****${token(i + 400, 4, HEX)} scoped to payouts:read.`,
  },
  {
    action: "apikey.revoke",
    category: "access",
    actors: ["sarah-chen"],
    resources: [
      {
        type: "apikey",
        name: "legacy-webhook-key",
        id: "key_legacy_webhook",
      },
    ],
    environments: ["production"],
    source: "console",
    authMethod: "sso_mfa",
    outcomes: ["success"],
    summary: () => "Revoked legacy-webhook-key, unused for 90 days.",
  },
  {
    action: "infra.apply",
    category: "infra",
    actors: ["cloud-build"],
    resources: [
      { type: "cluster", name: "prod-us-east-1", id: "ws-prod-us-east-1" },
      { type: "cluster", name: "prod-eu-west-1", id: "ws-prod-eu-west-1" },
      {
        type: "cluster",
        name: "staging-us-east-1",
        id: "ws-staging-us-east-1",
      },
    ],
    environments: envOfName,
    source: "terraform",
    authMethod: "service_key",
    outcomes: ["success", "success", "success", "success", "failed"],
    summary: ({ r, i, m, ok }) =>
      ok
        ? `Applied run-${token(i + 900, 5, ALNUM)}: ${3 + ((i + m) % 9)} resources changed.`
        : `Apply run-${token(i + 900, 5, ALNUM)} errored on ${r.name}.`,
    reason: "Apply errored: n2-standard-8 quota exceeded in the region.",
  },
  {
    action: "node_pool.scale",
    category: "infra",
    actors: ["michael-rodriguez"],
    resources: [
      {
        type: "cluster",
        name: "staging-us-east-1",
        id: "ws-staging-us-east-1",
      },
    ],
    environments: ["staging"],
    source: "cli",
    authMethod: "sso_device",
    outcomes: ["success"],
    summary: ({ i, m }) =>
      `Scaled node pool general-v3 to ${6 + ((i + m) % 5)} nodes.`,
  },
  {
    action: "database.failover.test",
    category: "infra",
    actors: ["alex-johnson"],
    resources: [
      { type: "database", name: "ledger-db-replica", id: "db_ledger_replica" },
      { type: "database", name: "search-db", id: "db_search" },
    ],
    environments: ["staging"],
    source: "cli",
    authMethod: "sso_device",
    outcomes: ["success", "failed"],
    summary: ({ r, ok }) =>
      ok
        ? `Ran a failover drill on ${r.name}; the replica took over in 41 s.`
        : `Failover drill on ${r.name} did not complete.`,
    reason: "Failover drill timed out waiting for replica lag under 5 s.",
  },
]

/** Minutes ago: background spans 30 days and leaves the last hour to the anchors. */
const BACKGROUND = { count: 226, fromMinutes: 60, toMinutes: 43200 }

/** Relative activity per UTC hour on a weekday: busy from 08:00 to 20:00. */
// prettier-ignore
const HOUR_WEIGHT = [
  0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.35, 0.35,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  0.35, 0.35, 0.1, 0.1,
]
const WEEKEND_WEIGHT = 0.3

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const REFERENCE_MS = Date.parse(REFERENCE_DATE)
const REVIEW_LAG_MS = 3 * HOUR_MS
/** One sign-in lasts a UTC day: a person's events from one client inside it
 *  share a session, which is what the sheet's Related trace follows. */
const SESSION_WINDOW_MS = DAY_MS
const SESSION_SOURCES: Source[] = [
  "console",
  "cli",
  "api",
  "terraform",
  "github-actions",
]

/** Weekday x hour weight, nudged per day (0.8 to 1.2) so no two days match. */
function activityAt(ms: number) {
  const day = Math.floor(ms / DAY_MS)
  // Day 0 of the epoch was a Thursday, so 2 and 3 are Saturday and Sunday.
  const weekend = day % 7 === 2 || day % 7 === 3
  const dayFactor = 0.8 + ((day * 37) % 41) / 100
  return (
    HOUR_WEIGHT[Math.floor(ms / HOUR_MS) % 24] *
    (weekend ? WEEKEND_WEIGHT : 1) *
    dayFactor
  )
}

/** Minutes ago per background event, newest first: the weight's inverse CDF. */
function backgroundMinutesAgo(): number[] {
  const { count, fromMinutes, toMinutes } = BACKGROUND
  const first = fromMinutes + 1
  const slots = toMinutes - first
  const cumulative = [0]
  for (let k = 0; k < slots; k++) {
    const at = REFERENCE_MS - (first + k) * MINUTE_MS
    cumulative.push(cumulative[k] + activityAt(at))
  }
  const minutes: number[] = []
  let k = 0
  for (let i = 0; i < count; i++) {
    // Under half a step either way, so the order stays newest to oldest.
    const jitter = (((i * 7919) % 97) - 48) / 110
    const target = ((i + 0.5 + jitter) / count) * cumulative[slots]
    while (k < slots - 1 && cumulative[k + 1] < target) k++
    minutes.push(first + k)
  }
  return minutes
}

/** Anchor deployments, so background ids can count down around them. */
const ANCHOR_DEPLOYS = ANCHOR_EVENTS.filter(
  (event) => event.resource.type === "deployment"
).map((event) => ({
  atMs: Date.parse(event.at),
  number: Number(event.resource.id.replace("DEP-", "")),
}))

function buildBackgroundEvents(): AuditEvent[] {
  // Deployment ids count down with age and stay below every newer anchor's id.
  let deployNumber = Infinity
  return backgroundMinutesAgo().map((minutesAgo, i) => {
    const atMs = REFERENCE_MS - (minutesAgo * 60 + ((i * 37) % 60)) * 1000

    // m counts this template's own occurrences; i alone repeats per template.
    const m = Math.floor(i / TEMPLATES.length)
    const t = TEMPLATES[(i * 7) % TEMPLATES.length]
    const actorId = t.actors[(i + m) % t.actors.length]
    const actor = ACTORS[actorId]
    const picked = t.resources[(i + 5 * m) % t.resources.length]
    if (picked.type === "deployment") {
      deployNumber = Math.min(
        4126 - Math.floor(i / 2),
        deployNumber - 1,
        ...ANCHOR_DEPLOYS.filter((anchor) => anchor.atMs > atMs).map(
          (anchor) => anchor.number - 1
        )
      )
    }
    const resource: Resource =
      picked.type === "deployment"
        ? { ...picked, id: `DEP-${deployNumber}` }
        : picked
    const environment =
      typeof t.environments === "function"
        ? t.environments(resource)
        : t.environments[(i + Math.floor(m / 2)) % t.environments.length]
    const cluster: Cluster | undefined =
      resource.type === "cluster" && isCluster(resource.name)
        ? resource.name
        : environment === "production"
          ? (i + m) % 2
            ? "prod-eu-west-1"
            : "prod-us-east-1"
          : environment === "staging"
            ? "staging-us-east-1"
            : undefined
    const outcome = t.outcomes[m % t.outcomes.length]
    const ok = outcome === "success"

    const event: AuditEvent = {
      id: `EVT-${1 + (i % 9)}${(Math.imul(i + 1, 0x9e3779b1) >>> 0).toString(16).padStart(8, "0").slice(-5)}`,
      at: new Date(atMs).toISOString().replace(".000Z", "Z"),
      actorId,
      action: t.action,
      category: t.category,
      resource,
      environment,
      cluster,
      source: t.source,
      ip: actor.ip,
      authMethod: t.authMethod,
      sessionId:
        actor.kind === "human"
          ? `ses_${token(
              Object.keys(ACTORS).indexOf(actorId) * 1_000_000 +
                SESSION_SOURCES.indexOf(t.source) * 200_000 +
                Math.floor(atMs / SESSION_WINDOW_MS),
              6,
              ALNUM
            )}`
          : `wl_${actorId.replace(/-/g, "_")}`,
      requestId: `req_01J8${token(i + 200, 6, BASE32)}`,
      traceId: token(i + 300, 32, HEX),
      outcome,
      summary: t.summary({ r: resource, i, m, ok }),
      ...(ok ? {} : { reason: t.reason }),
      ...(t.changeKey ? { changeKey: t.changeKey } : {}),
    }

    const wantsReview =
      !ok || event.category === "access" || event.category === "secret"
    if (wantsReview && i % 10 < 7) {
      event.reviewedBy = "sarah-chen"
      event.reviewedAt = new Date(Math.min(atMs + REVIEW_LAG_MS, REFERENCE_MS))
        .toISOString()
        .replace(".000Z", "Z")
    }
    return event
  })
}

/** The whole log, newest first. */
export const EVENTS: AuditEvent[] = [
  ...ANCHOR_EVENTS,
  ...buildBackgroundEvents(),
].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))