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
      <ContextSwitcher
        contexts={contexts}
        active={activeContext}
        onSwitch={onSwitch}
      />
    </header>
  )
}
