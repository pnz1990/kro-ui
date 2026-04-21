import { NavLink } from 'react-router-dom'
import ContextSwitcher from './ContextSwitcher'
import AlertBellButton from './AlertBellButton'
import type { KubeContext } from '@/lib/api'
import type { AlertSubscriptionState } from '@/hooks/useAlertSubscription'
import './TopBar.css'

interface TopBarProps {
  contexts: KubeContext[]
  activeContext: string
  onSwitch: (name: string) => void
  /** Whether the Notification API is available in this browser. */
  alertAvailable?: boolean
  /** Current alert subscription state — controls AlertBellButton appearance. */
  alertSubscriptionState?: AlertSubscriptionState
  /** Called when the bell button is clicked. */
  onAlertToggle?: () => Promise<void>
}

export default function TopBar({
  contexts,
  activeContext,
  onSwitch,
  alertAvailable = false,
  alertSubscriptionState = 'inactive',
  onAlertToggle,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <img src="/logo.png" alt="kro-ui" width="24" height="24" />
        <span className="top-bar__title">kro-ui</span>
      </div>
      <nav className="top-bar__nav" aria-label="Main navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
        >
          Overview
        </NavLink>
        <NavLink
          to="/catalog"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
        >
          Catalog
        </NavLink>
        <NavLink
          to="/fleet"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
        >
          Fleet
        </NavLink>
        <NavLink
          to="/instances"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
          data-testid="topbar-instances"
        >
          Instances
        </NavLink>
        <NavLink
          to="/events"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
        >
          Events
        </NavLink>
        <NavLink
          to="/author"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
          data-testid="topbar-rgd-designer"
        >
          RGD Designer
        </NavLink>
      </nav>
      {onAlertToggle && (
        <AlertBellButton
          available={alertAvailable}
          subscriptionState={alertSubscriptionState}
          onToggle={onAlertToggle}
        />
      )}
      <ContextSwitcher
        contexts={contexts}
        active={activeContext}
        onSwitch={onSwitch}
      />
    </header>
  )
}
