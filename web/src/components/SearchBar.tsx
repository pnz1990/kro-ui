import './SearchBar.css'

interface SearchBarProps {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onSearch, placeholder = 'Search by name, kind, or label…' }: SearchBarProps) {
  return (
    <div className="search-bar">
      <span className="search-bar__icon" aria-hidden="true">
        {/* Magnifier icon — inline SVG, no external deps */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        className="search-bar__input"
        type="search"
        role="searchbox"
        aria-label="Search RGDs"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onSearch(e.target.value)}
      />
      {value && (
        <button
          className="search-bar__clear"
          aria-label="Clear search"
          onClick={() => onSearch('')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
