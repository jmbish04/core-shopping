import { ProductionDeskDataGridView } from "./components/data-grid-view"

export function Page() {
  return (
    <main
      className="mx-auto flex min-h-svh w-full items-start justify-center p-8 pt-12"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Editorial production desk grouped data grid
      </h1>
      <ProductionDeskDataGridView />
    </main>
  )
}