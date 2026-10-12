import { type ReactNode } from "react"

import { GithubDark } from "@/components/ui/svgs/githubDark"
import { GithubLight } from "@/components/ui/svgs/githubLight"
import { GoogleCloud } from "@/components/ui/svgs/googleCloud"
import { N8n } from "@/components/ui/svgs/n8n"
import { Vercel } from "@/components/ui/svgs/vercel"
import { VercelDark } from "@/components/ui/svgs/vercelDark"
import {
  type Category,
  type ResourceType,
  type ServiceId,
  type Source,
} from "./data"
import { CircleCheckIcon, AlertCircleIcon, SearchIcon, XIcon, ListFilterIcon, FunnelXIcon, Settings2Icon, BookmarkIcon, ChevronDownIcon, ChevronUpIcon, SaveIcon, RotateCcwIcon, Trash2Icon, DownloadIcon, FileSpreadsheetIcon, FileJson2Icon, MoreHorizontalIcon, EyeIcon, CopyIcon, CheckIcon, HashIcon, ListChecksIcon, UserIcon, HistoryIcon, LinkIcon, ShieldAlertIcon, CircleXIcon, SearchXIcon, FileTextIcon, ActivityIcon, LockIcon, RocketIcon, SettingsIcon, KeyRoundIcon, ShieldCheckIcon, BoxesIcon, CloudUploadIcon, PackageIcon, NetworkIcon, DatabaseIcon, UserRoundCogIcon, LockKeyholeIcon, FlagIcon, CalendarClockIcon, MonitorIcon, SquareTerminalIcon, CodeIcon, BlocksIcon, SquareCodeIcon, TagIcon, LayersIcon, RouteIcon, GlobeIcon } from "lucide-react"

/** The toast state glyphs, one per typed method, so every toast reads alike. */
export const TOAST_SUCCESS_ICON = (
  <CircleCheckIcon className="text-success size-4" aria-hidden="true" />
)

export const TOAST_ERROR_ICON = (
  <AlertCircleIcon className="text-destructive size-4" aria-hidden="true" />
)

/** Unsized: the owning Button, menu item, addon, EmptyMedia or Alert sizes them. */
// prettier-ignore
export const UI_ICONS = {
  search:          <SearchIcon aria-hidden="true" />,
  close:           <XIcon aria-hidden="true" />,
  filter:          <ListFilterIcon aria-hidden="true" />,
  filterClear:     <FunnelXIcon aria-hidden="true" />,
  settings:        <Settings2Icon aria-hidden="true" />,
  bookmark:        <BookmarkIcon aria-hidden="true" />,
  chevronDown:     <ChevronDownIcon aria-hidden="true" />,
  chevronUp:       <ChevronUpIcon aria-hidden="true" />,
  save:            <SaveIcon aria-hidden="true" />,
  reset:           <RotateCcwIcon aria-hidden="true" />,
  trash:           <Trash2Icon aria-hidden="true" />,
  download:        <DownloadIcon aria-hidden="true" />,
  fileSpreadsheet: <FileSpreadsheetIcon aria-hidden="true" />,
  fileJson:        <FileJson2Icon aria-hidden="true" />,
  more:            <MoreHorizontalIcon aria-hidden="true" />,
  view:            <EyeIcon aria-hidden="true" />,
  copy:            <CopyIcon aria-hidden="true" />,
  check:           <CheckIcon aria-hidden="true" />,
  hash:            <HashIcon aria-hidden="true" />,
  review:          <ListChecksIcon aria-hidden="true" />,
  user:            <UserIcon aria-hidden="true" />,
  history:         <HistoryIcon aria-hidden="true" />,
  link:            <LinkIcon aria-hidden="true" />,
  shieldAlert:     <ShieldAlertIcon aria-hidden="true" />,
  circleX:         <CircleXIcon aria-hidden="true" />,
  searchX:         <SearchXIcon aria-hidden="true" />,
  fileText:        <FileTextIcon aria-hidden="true" />,
  activity:        <ActivityIcon aria-hidden="true" />,
  circleCheck:     <CircleCheckIcon aria-hidden="true" />,
}

/** A bare glyph beside text-xs copy. */
export const LOCK_GLYPH = (
  <LockIcon className="size-4" aria-hidden="true" />
)

// prettier-ignore
export const CATEGORY_ICONS: Record<Category, ReactNode> = {
  deploy: <RocketIcon className="size-4" aria-hidden="true" />,
  config: <SettingsIcon className="size-4" aria-hidden="true" />,
  secret: <KeyRoundIcon className="size-4" aria-hidden="true" />,
  access: <ShieldCheckIcon className="size-4" aria-hidden="true" />,
  infra:  <BoxesIcon className="size-4" aria-hidden="true" />,
}

// prettier-ignore
export const RESOURCE_ICONS: Record<ResourceType, ReactNode> = {
  deployment: <CloudUploadIcon className="size-4" aria-hidden="true" />,
  service:    <PackageIcon className="size-4" aria-hidden="true" />,
  cluster:    <NetworkIcon className="size-4" aria-hidden="true" />,
  database:   <DatabaseIcon className="size-4" aria-hidden="true" />,
  secret:     <KeyRoundIcon className="size-4" aria-hidden="true" />,
  role:       <UserRoundCogIcon className="size-4" aria-hidden="true" />,
  apikey:     <LockKeyholeIcon className="size-4" aria-hidden="true" />,
  flag:       <FlagIcon className="size-4" aria-hidden="true" />,
  job:        <CalendarClockIcon className="size-4" aria-hidden="true" />,
}

// prettier-ignore
export const SOURCE_ICONS: Record<Source, ReactNode> = {
  console:          <MonitorIcon className="size-4" aria-hidden="true" />,
  cli:              <SquareTerminalIcon className="size-4" aria-hidden="true" />,
  api:              <CodeIcon className="size-4" aria-hidden="true" />,
  terraform:        <BlocksIcon className="size-4" aria-hidden="true" />,
  "github-actions": <><GithubLight className="size-4 dark:hidden" aria-hidden="true" /><GithubDark className="hidden size-4 dark:block" aria-hidden="true" /></>,
}

/** Frameless brand marks at one optical size; n8n's wide mark runs wider. */
// prettier-ignore
export const SERVICE_ACTOR_ICONS: Record<ServiceId, ReactNode> = {
  "github-actions": <><GithubLight className="size-4 dark:hidden" aria-hidden="true" /><GithubDark className="hidden size-4 dark:block" aria-hidden="true" /></>,
  "cloud-build":    <GoogleCloud className="size-4" aria-hidden="true" />,
  vercel:           <><Vercel className="size-3.5 dark:hidden" aria-hidden="true" /><VercelDark className="hidden size-3.5 dark:block" aria-hidden="true" /></>,
  n8n:              <N8n className="w-5" aria-hidden="true" />,
}

// prettier-ignore
export const FIELD_ICONS = {
  actor:        <UserIcon className="size-4" aria-hidden="true" />,
  action:       <SquareCodeIcon className="size-4" aria-hidden="true" />,
  category:     <TagIcon className="size-4" aria-hidden="true" />,
  resource:     <PackageIcon className="size-4" aria-hidden="true" />,
  resourceType: <BoxesIcon className="size-4" aria-hidden="true" />,
  environment:  <LayersIcon className="size-4" aria-hidden="true" />,
  source:       <RouteIcon className="size-4" aria-hidden="true" />,
  outcome:      <ActivityIcon className="size-4" aria-hidden="true" />,
  ip:           <GlobeIcon className="size-4" aria-hidden="true" />,
  review:       <ListChecksIcon className="size-4" aria-hidden="true" />,
}