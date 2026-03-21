import { useRef, useState, useEffect } from 'react'
import './LabelFilter.css'

interface LabelFilterProps {
  /** All available "key=value" label strings to show in the dropdown. */
  labels: string[]
  /** Currently active "key=value" selections. */
  activeLabels: string[]
  onFilter: (activeLabels: string[]) => void
}

export default function LabelFilter({ labels, activeLabels, onFilter }: LabelFilterProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function toggleLabel(label: string) {
    if (activeLabels.includes(label)) {
      onFilter(activeLabels.filter((l) => l !== label))
    } else {
      onFilter([...activeLabels, label])
    }
  }

  const hasActive = activeLabels.length > 0

  return (
    <div className="label-filter" ref={containerRef}>
      <button
        className={`label-filter__trigger${hasActive ? ' label-filter__trigger--active' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="label-filter__trigger-text">
          {hasActive ? `Labels (${activeLabels.length})` : 'Filter by label'}
        </span>
        <svg
          className={`label-filter__chevron${open ? ' label-filter__chevron--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="label-filter__dropdown" role="listbox" aria-multiselectable="true" aria-label="Label filters">
          {labels.length === 0 ? (
            <p className="label-filter__empty">No labels found</p>
          ) : (
            <>
              {hasActive && (
                <button
                  className="label-filter__clear-all"
                  onClick={() => { onFilter([]); setOpen(false) }}
                >
                  Clear all filters
                </button>
              )}
              <ul className="label-filter__list">
                {labels.map((label) => {
                  const checked = activeLabels.includes(label)
                  return (
                    <li
                      key={label}
                      role="option"
                      aria-selected={checked}
                      className={`label-filter__item${checked ? ' label-filter__item--checked' : ''}`}
                      onClick={() => toggleLabel(label)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLabel(label) } }}
                      tabIndex={0}
                    >
                      <span className="label-filter__checkbox" aria-hidden="true">
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="label-filter__label-text">{label}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
