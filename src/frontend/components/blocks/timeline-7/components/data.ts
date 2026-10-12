import { type BadgeProps } from "@/components/reui/badge"

export type RolloutAttachment = {
  name: string
  size: string
}

export type RolloutMeta = {
  label: string
  value: string
  dotClassName: string
  variant?: BadgeProps["variant"]
}

export type RolloutItem = {
  id: number
  date: string
  dateTime: string
  action: string
  title: string
  body: string
  badge: string
  badgeVariant: BadgeProps["variant"]
  owner: string
  rating?: number
  attachment?: RolloutAttachment
  meta?: RolloutMeta
}

export const rolloutItems: RolloutItem[] = [
  {
    id: 1,
    date: "May 06, 2026",
    dateTime: "2026-05-06",
    action: "Completed",
    title: "Renewal Workspace Handoff",
    body: "Success plan, contract notes, and expansion risks are ready for the account team.",
    badge: "Done",
    badgeVariant: "success",
    owner: "Maya Brooks",
    rating: 4.8,
    attachment: {
      name: "Handoff.pdf",
      size: "1.8 MB",
    },
    meta: {
      label: "Health",
      value: "Healthy",
      dotClassName: "bg-success",
      variant: "success-outline",
    },
  },
  {
    id: 2,
    date: "May 02, 2026",
    dateTime: "2026-05-02",
    action: "Verified",
    title: "SSO And SCIM Sync",
    body: "Directory groups match workspace roles before admin invitations are released.",
    badge: "Auth",
    badgeVariant: "info-outline",
    owner: "Nina Patel",
    attachment: {
      name: "SSO-map.csv",
      size: "84 KB",
    },
    meta: {
      label: "Risk",
      value: "Low",
      dotClassName: "bg-info",
      variant: "info",
    },
  },
  {
    id: 3,
    date: "Apr 28, 2026",
    dateTime: "2026-04-28",
    action: "Approved",
    title: "Usage-Based Billing Limits",
    body: "Finance confirmed seat buffers and usage caps for the renewal workspace.",
    badge: "Limit",
    badgeVariant: "primary-outline",
    owner: "Theo Grant",
    meta: {
      label: "Cap",
      value: "125%",
      dotClassName: "bg-primary",
      variant: "default",
    },
  },
  {
    id: 4,
    date: "Apr 22, 2026",
    dateTime: "2026-04-22",
    action: "Imported",
    title: "Production Customer Records",
    body: "Customer contacts, renewal dates, and usage snapshots cleared validation.",
    badge: "Data",
    badgeVariant: "warning",
    owner: "Leah Stone",
    attachment: {
      name: "Import-log.txt",
      size: "26 KB",
    },
    meta: {
      label: "Rows",
      value: "18.4k",
      dotClassName: "bg-warning",
      variant: "warning-outline",
    },
  },
  {
    id: 5,
    date: "Apr 18, 2026",
    dateTime: "2026-04-18",
    action: "Drafted",
    title: "Executive Success Brief",
    body: "Revenue impact, adoption gaps, and champion notes were condensed for the renewal call.",
    badge: "Brief",
    badgeVariant: "focus-outline",
    owner: "Ari Fox",
    rating: 4.6,
    attachment: {
      name: "Exec-brief.docx",
      size: "412 KB",
    },
    meta: {
      label: "Stage",
      value: "Ready",
      dotClassName: "bg-focus",
      variant: "focus",
    },
  },
  {
    id: 6,
    date: "Apr 14, 2026",
    dateTime: "2026-04-14",
    action: "Escalated",
    title: "Support Exception Review",
    body: "Three unresolved tickets were routed to implementation before legal redlines.",
    badge: "Support",
    badgeVariant: "destructive",
    owner: "Cam Torres",
    attachment: {
      name: "Ticket-audit.csv",
      size: "31 KB",
    },
    meta: {
      label: "SLA",
      value: "2 Open",
      dotClassName: "bg-destructive",
      variant: "destructive-outline",
    },
  },
  {
    id: 7,
    date: "Apr 09, 2026",
    dateTime: "2026-04-09",
    action: "Reviewed",
    title: "Security Questionnaire",
    body: "Compliance answers, pen test dates, and data residency notes were checked by security.",
    badge: "Risk",
    badgeVariant: "success-light",
    owner: "Jules Martin",
    rating: 4.7,
    meta: {
      label: "Control",
      value: "Passed",
      dotClassName: "bg-current",
      variant: "success",
    },
  },
  {
    id: 8,
    date: "Apr 03, 2026",
    dateTime: "2026-04-03",
    action: "Sent",
    title: "Procurement Packet",
    body: "Order form, vendor profile, and invoice routing details were sent to procurement.",
    badge: "Packet",
    badgeVariant: "outline",
    owner: "Noor Ellis",
    attachment: {
      name: "Procurement.zip",
      size: "4.2 MB",
    },
    meta: {
      label: "Owner",
      value: "Legal",
      dotClassName: "bg-muted-foreground",
      variant: "invert",
    },
  },
  {
    id: 9,
    date: "Mar 29, 2026",
    dateTime: "2026-03-29",
    action: "Confirmed",
    title: "Expansion Seat Forecast",
    body: "Department growth assumptions and admin seat allocations were accepted by the sponsor.",
    badge: "Seats",
    badgeVariant: "primary-light",
    owner: "Iris Chen",
    meta: {
      label: "Delta",
      value: "+38",
      dotClassName: "bg-primary",
      variant: "primary-outline",
    },
  },
  {
    id: 10,
    date: "Mar 21, 2026",
    dateTime: "2026-03-21",
    action: "Archived",
    title: "Legacy Contract Notes",
    body: "Previous renewal assumptions were archived after finance reconciled payment terms.",
    badge: "Archive",
    badgeVariant: "secondary",
    owner: "Rae Morgan",
    attachment: {
      name: "Legacy-notes.pdf",
      size: "760 KB",
    },
    meta: {
      label: "Cycle",
      value: "Closed",
      dotClassName: "bg-muted-foreground",
      variant: "outline",
    },
  },
]