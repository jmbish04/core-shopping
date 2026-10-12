import { AccountRolloutDropdown } from "./components/account-rollout-dropdown"

export function Page() {
  return (
    <main
      className="flex min-h-svh w-full items-start justify-center p-6 sm:p-10 md:p-12"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Account rollout timeline dropdown
      </h1>
      <AccountRolloutDropdown />
    </main>
  )
}