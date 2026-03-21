import './NamespaceFilter.css'

interface NamespaceFilterProps {
  namespaces: string[]
  selected: string
  onChange: (namespace: string) => void
}

/**
 * NamespaceFilter — `<select>` with "All Namespaces" option + derived namespace list.
 *
 * Namespace options come from the caller (derived from the unfiltered instance list).
 * No separate API call is made. FR-003.
 *
 * Spec: .specify/specs/004-instance-list/spec.md
 */
export default function NamespaceFilter({
  namespaces,
  selected,
  onChange,
}: NamespaceFilterProps) {
  return (
    <div className="namespace-filter">
      <label className="namespace-filter__label" htmlFor="namespace-select">
        Namespace
      </label>
      <select
        id="namespace-select"
        className="namespace-filter__select"
        data-testid="namespace-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All Namespaces</option>
        {namespaces.map((ns) => (
          <option key={ns} value={ns}>
            {ns}
          </option>
        ))}
      </select>
    </div>
  )
}
