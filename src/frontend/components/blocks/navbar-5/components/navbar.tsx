import { NavbarControls } from "./navbar-controls"
import { NavbarWorkflow } from "./navbar-workflow"

// ── Navbar ──

export function Navbar() {
  return (
    <header className="border-border bg-background sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b px-4">
      {/* Left - workflow */}
      <NavbarWorkflow />

      {/* Right - controls */}
      <NavbarControls />
    </header>
  )
}