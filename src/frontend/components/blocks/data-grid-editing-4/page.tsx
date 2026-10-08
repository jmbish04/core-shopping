import { PlanEditingDataGridView } from "./components/data-grid-view"

export function Page() {
  return (
    <main
      className="mx-auto flex min-h-svh w-full items-start justify-center p-8 pt-12"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Pricing plan editor data grid with per-row edit mode
      </h1>
      <PlanEditingDataGridView />
    </main>
  )
}