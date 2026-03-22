import { NavLink } from 'react-router-dom'
import ContextSwitcher from './ContextSwitcher'
import type { KubeContext } from '@/lib/api'
import './TopBar.css'

interface TopBarProps {
  contexts: KubeContext[]
  activeContext: string
  onSwitch: (name: string) => void
}

export default function TopBar({ contexts, activeContext, onSwitch }: TopBarProps) {
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
          Home
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
          to="/events"
          className={({ isActive }) =>
            `top-bar__nav-link${isActive ? ' top-bar__nav-link--active' : ''}`
          }
        >
          Events
        </NavLink>
      </nav>
      <ContextSwitcher
        contexts={contexts}
        active={activeContext}
        onSwitch={onSwitch}
      />
    </header>
  )
}
