import { AuditLog } from "./components/audit-log"

export function Page() {
  return (
    <main className="min-h-svh w-full" aria-labelledby="page-heading">
      <h1 id="page-heading" className="sr-only">
        Audit Log
      </h1>
      <AuditLog />
    </main>
  )
}