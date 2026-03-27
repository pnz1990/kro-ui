import { useState } from 'react'
import type { CollapseGroup } from '@/lib/dag'
import './OptimizationAdvisor.css'

// Spec: .specify/specs/023-rgd-optimization-advisor/

// The kro.run/docs/concepts/forEach path returns 404 as of v0.9.0.
// The correct docs path for collections/forEach in kro v0.9.0 is the concepts page.
const FOREACH_DOCS_URL = 'https://kro.run/docs/concepts/collections'

interface CollapseGroupSuggestion {
  group: CollapseGroup
  dismissed: boolean
  expanded: boolean
}

interface OptimizationAdvisorProps {
  groups: CollapseGroup[]
}

/**
 * OptimizationAdvisor — surfaces forEach collapse suggestions for RGDs whose
 * resources share the same apiVersion/kind with structurally similar templates.
 *
 * Renders nothing when groups is empty or all suggestions are dismissed.
 * All state is session-only (no localStorage, no URL param).
 *
 * State re-initialization: suggestion state is initialized once from the
 * `groups` prop via the `useState` initializer. It does NOT re-sync when
 * `groups` changes (intentional — avoids resetting dismissed state mid-session).
 * The caller must remount this component (via `key` prop) when a new RGD is
 * loaded to reset dismiss/expand state for the new context.
 *
 * Spec: .specify/specs/023-rgd-optimization-advisor/
 */
export default function OptimizationAdvisor({ groups }: OptimizationAdvisorProps) {
  const [suggestions, setSuggestions] = useState<CollapseGroupSuggestion[]>(() =>
    groups.map((group) => ({ group, dismissed: false, expanded: false })),
  )

  // Re-sync when groups prop changes (e.g. RGD navigation)
  // We intentionally use a key on the parent to remount instead of a deep comparison here.
  // The state initialiser above is sufficient for typical usage.

  const visible = suggestions.filter((s) => !s.dismissed)
  if (visible.length === 0) return null

  function dismiss(index: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, dismissed: true } : s)),
    )
  }

  function toggleExpand(index: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, expanded: !s.expanded } : s)),
    )
  }

  return (
    <div className="optimization-advisor" data-testid="optimization-advisor">
      <div className="optimization-advisor__header">
        <span className="optimization-advisor__icon" aria-hidden="true">💡</span>
        <span className="optimization-advisor__title">Optimization suggestions</span>
      </div>
      {suggestions.map((suggestion, idx) => {
        if (suggestion.dismissed) return null
        const { group, expanded } = suggestion
        const label =
          group.apiVersion
            ? `${group.apiVersion}/${group.kind}`
            : group.kind
        return (
          <div
            key={`${group.apiVersion}/${group.kind}`}
            className="advisor-item"
            data-testid={`advisor-item-${group.kind}`}
          >
            <div className="advisor-item__row">
              <div className="advisor-item__summary">
                <span className="advisor-item__count">{group.nodeIds.length}</span>
                {' '}
                <code className="advisor-item__kind">{label}</code>
                {' '}
                resources share the same kind — consider a{' '}
                <strong>forEach collection</strong>
              </div>
              <div className="advisor-item__actions">
                <button
                  className="advisor-item__expand"
                  onClick={() => toggleExpand(idx)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} forEach suggestion for ${group.kind}`}
                  data-testid={`advisor-item-${group.kind}-expand`}
                >
                  {expanded ? 'Hide' : 'Learn more'}
                </button>
                <button
                  className="advisor-item__dismiss"
                  onClick={() => dismiss(idx)}
                  aria-label={`Dismiss forEach suggestion for ${group.kind}`}
                  data-testid={`advisor-item-${group.kind}-dismiss`}
                >
                  ×
                </button>
              </div>
            </div>

            {expanded && (
              <div
                className="advisor-item__explanation"
                data-testid={`advisor-item-${group.kind}-explanation`}
              >
                <p>
                  A <strong>forEach collection</strong> lets you define one resource
                  template and expand it across an array of values at runtime. Instead of
                  duplicating {group.nodeIds.length} nearly-identical{' '}
                  <code>{group.kind}</code> resources, a single forEach entry iterates
                  over a list and creates each one automatically.
                </p>
                <p>
                  Values that differ between instances become <code>{'${each.value}'}</code>{' '}
                  CEL references — kro substitutes the current iteration value for each
                  generated resource.
                </p>
                <a
                  className="advisor-item__docs-link"
                  href={FOREACH_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`advisor-item-${group.kind}-docs-link`}
                >
                  kro forEach docs ↗
                </a>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
