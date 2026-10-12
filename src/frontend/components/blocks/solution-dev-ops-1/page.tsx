import { CronJobs } from "./components/cron-jobs"

export function Page() {
  return (
    <main
      className="bg-background min-h-svh w-full"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Cron Jobs
      </h1>
      <CronJobs />
    </main>
  )
}