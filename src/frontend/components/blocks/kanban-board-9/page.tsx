import { KanbanBoard } from "./components/kanban-board"

export function Page() {
  return (
    <main
      className="bg-background flex w-full justify-center p-4 sm:p-6"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Recruiting pipeline kanban board
      </h1>
      <KanbanBoard />
    </main>
  )
}