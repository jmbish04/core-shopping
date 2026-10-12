import { MetricDetail } from "./components/metric-detail"

export function Page() {
  return (
    <main
      className="mx-auto flex min-h-svh w-full max-w-6xl flex-col p-6 sm:p-8 lg:p-10"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Metric detail
      </h1>
      <MetricDetail />
    </main>
  )
}