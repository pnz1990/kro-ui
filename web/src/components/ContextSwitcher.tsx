// ContextSwitcher — dropdown to switch kubeconfig contexts at runtime.
// Implements an accessible ARIA listbox pattern per spec 007-context-switcher.
// Fix #63: ARN truncation now shows account-ID fragment + cluster name for disambiguation.
// Fix #117: use first6…last3/clusterName format to disambiguate same-named clusters.
import { useCallback, useEffect, useRef, useState } from 'react'
import { switchContext } from '@/lib/api'
import type { KubeContext } from '@/lib/api'
import { abbreviateContext } from '@/lib/format'
import './ContextSwitcher.css'

const MAX_DISPLAY_LENGTH = 40
const SWITCH_TIMEOUT_MS = 10_000

/**
 * Return a display-friendly label for a context name that may be ambiguous.
 *
 * Delegates to `abbreviateContext` from @/lib/format for EKS ARN handling
 * (consistent with FleetMatrix and ClusterCard), then applies a character limit.
 *
 * Rules (in order):
 *  1. If it looks like an AWS EKS ARN: uses `abbreviateContext` which produces
 *     `{first6}…{last3}/{clusterName}` — unambiguous across accounts. See #117.
 *  2. If ≤40 chars after abbreviation: return as-is.
 *  3. If it contains '/' (other long paths): `<prefix>…/<lastName>`.
 *  4. Fallback: truncate at 40 with '…'.
 *
 * The full name is always exposed via `title` attribute.
 */
export function truncateContextName(name: string): string {
  // Apply EKS ARN abbreviation first (consistent with abbreviateContext in format.ts)
  const abbreviated = abbreviateContext(name)

  if (abbreviated.length <= MAX_DISPLAY_LENGTH) return abbreviated

  // Generic long path with slashes: keep last segment + prefix hint
  const slashIdx = abbreviated.lastIndexOf('/')
  if (slashIdx !== -1) {
    const lastName = abbreviated.slice(slashIdx + 1)
    const prefix = abbreviated.slice(0, Math.min(6, slashIdx))
    return `${prefix}\u2026/${lastName}`
  }

  return abbreviated.slice(0, MAX_DISPLAY_LENGTH) + '\u2026'
}

interface ContextSwitcherProps {
  contexts: KubeContext[]
  active: string
  onSwitch: (name: string) => void
}

export default function ContextSwitcher({
  contexts,
  active,
  onSwitch,
}: ContextSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const truncated = truncateContextName(active)
  const needsTooltip = active.length > MAX_DISPLAY_LENGTH

  // Close dropdown and return focus to trigger
  const close = useCallback(() => {
    setIsOpen(false)
    setFocusedIdx(-1)
    btnRef.current?.focus()
  }, [])

  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, close])

  // Keyboard handler on the container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx((idx) => Math.min(idx + 1, contexts.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx((idx) => Math.max(idx - 1, 0))
        break
      case 'Enter': {
        e.preventDefault()
        if (focusedIdx >= 0 && focusedIdx < contexts.length) {
          const target = contexts[focusedIdx]
          if (target.name !== active) {
            void handleSelect(target.name)
          }
        }
        break
      }
      default:
        break
    }
  }

  const openDropdown = () => {
    setError(null)
    setIsOpen(true)
    // Default focus to the active context index
    const activeIdx = contexts.findIndex((c) => c.name === active)
    setFocusedIdx(activeIdx >= 0 ? activeIdx : 0)
  }

  const handleSelect = async (name: string) => {
    if (name === active || switching) return
    setIsOpen(false)
    setSwitching(true)
    setError(null)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const timeout = setTimeout(() => ctrl.abort(), SWITCH_TIMEOUT_MS)

    try {
      await switchContext(name)
      onSwitch(name)
    } catch (err) {
      if (ctrl.signal.aborted) {
        setError('Switch timed out — check cluster connectivity')
      } else {
        setError(err instanceof Error ? err.message : 'Context switch failed')
      }
    } finally {
      clearTimeout(timeout)
      abortRef.current = null
      setSwitching(false)
    }
  }

  return (
    <div
      className="context-switcher"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={btnRef}
        className="context-switcher__btn"
        data-testid="context-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-busy={switching}
        onClick={() => {
          if (switching) return
          if (isOpen) {
            close()
          } else {
            openDropdown()
          }
        }}
        title={needsTooltip ? active : undefined}
      >
        {switching ? (
          <span className="context-switcher__spinner" aria-hidden="true" />
        ) : null}
        <span
          className="context-switcher__label"
          data-testid="context-name"
          title={active}
        >
          {truncated}
        </span>
        {!switching && (
          <svg
            className="context-switcher__chevron"
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          className="context-switcher__dropdown"
          data-testid="context-dropdown"
          role="listbox"
          aria-label="Select kubeconfig context"
        >
          {contexts.length === 0 ? (
            <div className="context-switcher__option" style={{ color: 'var(--color-text-faint)', cursor: 'default' }}>
              No contexts available
            </div>
          ) : (
            contexts.map((ctx, idx) => {
              const isActive = ctx.name === active
              const isFocused = idx === focusedIdx
              return (
                <div
                  key={ctx.name}
                  className={[
                    'context-switcher__option',
                    isActive ? 'context-switcher__option--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => {
                    if (!isActive) void handleSelect(ctx.name)
                  }}
                  title={ctx.name.length > MAX_DISPLAY_LENGTH ? ctx.name : undefined}
                >
                  {isActive ? (
                    <svg
                      className="context-switcher__check"
                      aria-hidden="true"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 7l4 4 6-6" />
                    </svg>
                  ) : (
                    <span className="context-switcher__check-placeholder" aria-hidden="true" />
                  )}
                  <span className="context-switcher__option-text">
                    <span className="context-switcher__label">{truncateContextName(ctx.name)}</span>
                    {ctx.name.length > MAX_DISPLAY_LENGTH && (
                      <span className="context-switcher__option-subtitle">{ctx.name}</span>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {error !== null && (
        <div className="context-switcher__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
