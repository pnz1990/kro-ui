import { Outlet } from "react-router-dom"

/**
 * Layout — top bar (context switcher, theme toggle) + outlet for pages.
 *
 * Minimal implementation: renders child routes via Outlet.
 * Full nav bar, context switcher, and theme toggle are deferred to later specs.
 */
export default function Layout() {
  return (
    <div>
      <Outlet />
    </div>
  )
}
