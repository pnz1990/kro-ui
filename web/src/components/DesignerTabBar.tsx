// DesignerTabBar.tsx — Tab bar for the RGD Designer /author page.
//
// Renders four tabs: Schema | Resources | YAML | Preview.
// Implements WCAG 2.1 SC 2.1.1 keyboard navigation (ArrowLeft/ArrowRight focus,
// Enter/Space to activate).
//
// Spec: .specify/specs/issue-684/spec.md O1, O8, O9

import { useRef } from 'react'
import './DesignerTabBar.css'

export type DesignerTab = 'schema' | 'resources' | 'yaml' | 'preview'

const TABS: { id: DesignerTab; label: string }[] = [
  { id: 'schema', label: 'Schema' },
  { id: 'resources', label: 'Resources' },
  { id: 'yaml', label: 'YAML' },
  { id: 'preview', label: 'Preview' },
]

export interface DesignerTabBarProps {
  activeTab: DesignerTab
  onTabChange: (tab: DesignerTab) => void
}

/**
 * DesignerTabBar — four-tab navigation bar for the RGD Designer.
 *
 * Keyboard: ArrowLeft/ArrowRight move focus between tabs.
 * Enter/Space activates the focused tab.
 *
 * Spec: issue-684 O1, O8, O9
 */
export default function DesignerTabBar({ activeTab, onTabChange }: DesignerTabBarProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (index + 1) % TABS.length
      tabRefs.current[next]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (index - 1 + TABS.length) % TABS.length
      tabRefs.current[prev]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTabChange(TABS[index].id)
    }
  }

  return (
    <div
      className="designer-tab-bar"
      role="tablist"
      aria-label="RGD Designer sections"
      data-testid="designer-tab-bar"
    >
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => { tabRefs.current[index] = el }}
          className="designer-tab-btn"
          role="tab"
          aria-selected={activeTab === tab.id}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          type="button"
          data-testid={`designer-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
