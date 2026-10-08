import { NewCronJobSheet } from "./components/new-cron-job-sheet"

export function Page() {
  return (
    <main
      className="flex min-h-svh w-full items-center justify-center p-6 sm:p-10 md:p-12"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        New cron job
      </h1>
      <NewCronJobSheet />
    </main>
  )
}