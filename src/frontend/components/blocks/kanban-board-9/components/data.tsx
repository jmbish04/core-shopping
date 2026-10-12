import { type BadgeProps } from "@/components/reui/badge"

export type RecruitingPerson = {
  name: string
  initials: string
  avatar: string
  role: string
}

export type ScorecardState =
  | "not-started"
  | "draft"
  | "ready"
  | "calibration"
  | "complete"

export type RecruitingCandidate = {
  id: string
  candidate: string
  role: string
  location: string
  timezone: string
  matchScore: number
  matchTone: "exceptional" | "strong" | "calibrated" | "risk"
  interviewDate: string
  compensationBand: string
  assignee: RecruitingPerson
  scorecardState: ScorecardState
  riskLabel?: string
  riskVariant?: BadgeProps["variant"]
}

export type RecruitingColumn = {
  id: string
  title: string
  description: string
  dotClassName: string
  addLabel: string
}

export const BOARD_TITLE = "Recruiting Pipeline"
export const BOARD_DESCRIPTION =
  "Track candidate fit, interviews, scorecards, and offer readiness."

export const SCORECARD_STATE_META: Record<
  ScorecardState,
  {
    label: string
    variant: BadgeProps["variant"]
    dotClassName: string
  }
> = {
  "not-started": {
    label: "Not started",
    variant: "outline",
    dotClassName: "bg-muted-foreground",
  },
  draft: {
    label: "Draft",
    variant: "outline",
    dotClassName: "bg-sky-500",
  },
  ready: {
    label: "Ready",
    variant: "outline",
    dotClassName: "bg-violet-500",
  },
  calibration: {
    label: "Needs calibration",
    variant: "outline",
    dotClassName: "bg-amber-500",
  },
  complete: {
    label: "Complete",
    variant: "outline",
    dotClassName: "bg-emerald-500",
  },
}

const PEOPLE = {
  amina: {
    name: "Amina Reed",
    initials: "AR",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
    role: "Recruiter",
  },
  beck: {
    name: "Beck Moreno",
    initials: "BM",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
    role: "Recruiter",
  },
  celia: {
    name: "Celia Hart",
    initials: "CH",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
    role: "Recruiting lead",
  },
  devon: {
    name: "Devon Park",
    initials: "DP",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80",
    role: "Engineering",
  },
  esther: {
    name: "Esther Kim",
    initials: "EK",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
    role: "Design",
  },
  farid: {
    name: "Farid Malik",
    initials: "FM",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&dpr=2&q=80",
    role: "Product",
  },
  greta: {
    name: "Greta Walsh",
    initials: "GW",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80",
    role: "People ops",
  },
} satisfies Record<string, RecruitingPerson>

export const RECRUITING_COLUMNS: RecruitingColumn[] = [
  {
    id: "sourced",
    title: "Sourced",
    description: "New profiles",
    dotClassName: "bg-slate-400 dark:bg-slate-500",
    addLabel: "Add sourced candidate",
  },
  {
    id: "screen",
    title: "Screen",
    description: "Recruiter review",
    dotClassName: "bg-sky-500 dark:bg-sky-400",
    addLabel: "Add screen",
  },
  {
    id: "hiring-manager",
    title: "Hiring Manager",
    description: "Manager review",
    dotClassName: "bg-blue-500 dark:bg-blue-400",
    addLabel: "Add manager review",
  },
  {
    id: "panel",
    title: "Panel",
    description: "Interview loop",
    dotClassName: "bg-violet-500 dark:bg-violet-400",
    addLabel: "Add panel interview",
  },
  {
    id: "scorecard",
    title: "Scorecard",
    description: "Feedback pending",
    dotClassName: "bg-cyan-500 dark:bg-cyan-400",
    addLabel: "Add scorecard review",
  },
  {
    id: "offer",
    title: "Offer",
    description: "Package review",
    dotClassName: "bg-teal-500 dark:bg-teal-400",
    addLabel: "Add offer",
  },
]

export const INITIAL_CANDIDATES: Record<string, RecruitingCandidate[]> = {
  sourced: [
    {
      id: "candidate-101",
      candidate: "Mina Calder",
      role: "Staff Product Designer",
      location: "Toronto, CA",
      timezone: "ET",
      matchScore: 46,
      matchTone: "strong",
      interviewDate: "May 7, 2026",
      compensationBand: "$178k-$204k",
      assignee: PEOPLE.amina,
      scorecardState: "not-started",
    },
    {
      id: "candidate-102",
      candidate: "Jon Bell",
      role: "Senior Data Engineer",
      location: "Austin, US",
      timezone: "CT",
      matchScore: 38,
      matchTone: "strong",
      interviewDate: "May 8, 2026",
      compensationBand: "$164k-$188k",
      assignee: PEOPLE.beck,
      scorecardState: "draft",
    },
    {
      id: "candidate-103",
      candidate: "Amara Finch",
      role: "Senior UX Researcher",
      location: "Portland, US",
      timezone: "PT",
      matchScore: 31,
      matchTone: "calibrated",
      interviewDate: "May 10, 2026",
      compensationBand: "$132k-$150k",
      assignee: PEOPLE.celia,
      scorecardState: "not-started",
    },
  ],
  screen: [
    {
      id: "candidate-201",
      candidate: "Priya Rao",
      role: "Principal Frontend Engineer",
      location: "Seattle, US",
      timezone: "PT",
      matchScore: 58,
      matchTone: "exceptional",
      interviewDate: "May 6, 2026",
      compensationBand: "$196k-$224k",
      assignee: PEOPLE.celia,
      scorecardState: "ready",
    },
    {
      id: "candidate-202",
      candidate: "Luca Marin",
      role: "Lifecycle Marketing Lead",
      location: "Madrid, ES",
      timezone: "CET",
      matchScore: 34,
      matchTone: "calibrated",
      interviewDate: "May 9, 2026",
      compensationBand: "EUR120k-EUR138k",
      assignee: PEOPLE.amina,
      scorecardState: "draft",
    },
  ],
  "hiring-manager": [
    {
      id: "candidate-301",
      candidate: "Nadia Ellis",
      role: "Product Operations Manager",
      location: "Brooklyn, US",
      timezone: "ET",
      matchScore: 54,
      matchTone: "exceptional",
      interviewDate: "May 10, 2026",
      compensationBand: "$142k-$164k",
      assignee: PEOPLE.beck,
      scorecardState: "ready",
    },
    {
      id: "candidate-302",
      candidate: "Theo Grant",
      role: "Security Engineering Manager",
      location: "Dublin, IE",
      timezone: "GMT",
      matchScore: 41,
      matchTone: "calibrated",
      interviewDate: "May 11, 2026",
      compensationBand: "EUR154k-EUR176k",
      assignee: PEOPLE.celia,
      scorecardState: "ready",
    },
    {
      id: "candidate-303",
      candidate: "Keon Wallace",
      role: "GTM Systems Lead",
      location: "Atlanta, US",
      timezone: "ET",
      matchScore: 45,
      matchTone: "calibrated",
      interviewDate: "May 14, 2026",
      compensationBand: "$138k-$158k",
      assignee: PEOPLE.farid,
      scorecardState: "draft",
    },
  ],
  panel: [
    {
      id: "candidate-401",
      candidate: "Sara Okafor",
      role: "Design Systems Engineer",
      location: "London, UK",
      timezone: "GMT",
      matchScore: 48,
      matchTone: "strong",
      interviewDate: "May 12, 2026",
      compensationBand: "GBP118k-GBP136k",
      assignee: PEOPLE.amina,
      scorecardState: "ready",
    },
    {
      id: "candidate-402",
      candidate: "Arun Mehta",
      role: "Senior Platform Engineer",
      location: "Vancouver, CA",
      timezone: "PT",
      matchScore: 26,
      matchTone: "risk",
      interviewDate: "May 13, 2026",
      compensationBand: "$170k-$192k",
      assignee: PEOPLE.beck,
      scorecardState: "calibration",
      riskLabel: "Panel reschedule",
      riskVariant: "warning-light",
    },
  ],
  scorecard: [
    {
      id: "candidate-501",
      candidate: "Elena Torres",
      role: "Senior Recruiter",
      location: "Chicago, US",
      timezone: "CT",
      matchScore: 44,
      matchTone: "strong",
      interviewDate: "May 5, 2026",
      compensationBand: "$126k-$146k",
      assignee: PEOPLE.greta,
      scorecardState: "calibration",
      riskLabel: "Feedback due",
      riskVariant: "warning-light",
    },
    {
      id: "candidate-502",
      candidate: "Marco Silva",
      role: "Revenue Systems Analyst",
      location: "Lisbon, PT",
      timezone: "WEST",
      matchScore: 36,
      matchTone: "calibrated",
      interviewDate: "May 6, 2026",
      compensationBand: "EUR88k-EUR102k",
      assignee: PEOPLE.amina,
      scorecardState: "draft",
    },
    {
      id: "candidate-503",
      candidate: "Mei Watanabe",
      role: "People Analytics Manager",
      location: "Tokyo, JP",
      timezone: "JST",
      matchScore: 29,
      matchTone: "risk",
      interviewDate: "May 8, 2026",
      compensationBand: "JPY16m-JPY19m",
      assignee: PEOPLE.greta,
      scorecardState: "calibration",
      riskLabel: "Late feedback",
      riskVariant: "warning-light",
    },
  ],
  offer: [
    {
      id: "candidate-601",
      candidate: "Iris Chen",
      role: "Director of Product Design",
      location: "San Francisco, US",
      timezone: "PT",
      matchScore: 56,
      matchTone: "exceptional",
      interviewDate: "May 14, 2026",
      compensationBand: "$242k-$286k",
      assignee: PEOPLE.celia,
      scorecardState: "complete",
      riskLabel: "Comp gap",
      riskVariant: "destructive-light",
    },
    {
      id: "candidate-701",
      candidate: "Owen Price",
      role: "Staff Infrastructure Engineer",
      location: "Denver, US",
      timezone: "MT",
      matchScore: 62,
      matchTone: "exceptional",
      interviewDate: "Starts Jun 1",
      compensationBand: "$214k-$238k",
      assignee: PEOPLE.beck,
      scorecardState: "complete",
    },
  ],
}