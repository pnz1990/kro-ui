import './TopBar.css'

const MAX_CONTEXT_LENGTH = 40

interface TopBarProps {
  contextName: string
}

export default function TopBar({ contextName }: TopBarProps) {
  const truncated =
    contextName.length > MAX_CONTEXT_LENGTH
      ? contextName.slice(0, MAX_CONTEXT_LENGTH) + '\u2026'
      : contextName

  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <img src="/logo.png" alt="kro-ui" width="24" height="24" />
        <span className="top-bar__title">kro-ui</span>
      </div>
      <div
        className="top-bar__context"
        data-testid="context-name"
        title={contextName}
      >
        {truncated}
      </div>
    </header>
  )
}
