// Home — RGD cards grid. Fetches GET /api/v1/rgds on mount.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { listRGDs } from '@/lib/api'
import { extractRGDKind, extractRGDName } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import RGDCard from '@/components/RGDCard'
import SearchBar from '@/components/SearchBar'
import SkeletonCard from '@/components/SkeletonCard'
import './Home.css'

export default function Home() {
  usePageTitle('')
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const fetchRGDs = useCallback(() => {
    setIsLoading(true)
    setError(null)
    listRGDs()
      .then((res) => {
        setItems(res.items)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchRGDs()
  }, [fetchRGDs])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter(
      (rgd) =>
        extractRGDName(rgd).toLowerCase().includes(q) ||
        extractRGDKind(rgd).toLowerCase().includes(q),
    )
  }, [items, query])

  return (
    <div className="home">
      <div className="home__header">
        <h1 className="home__heading">ResourceGraphDefinitions</h1>
        {!isLoading && error === null && items.length > 0 && (
          <div className="home__toolbar">
            <SearchBar
              value={query}
              onSearch={setQuery}
              placeholder="Search by name or kind…"
            />
            <span className="home__count">
              {filtered.length} of {items.length}
            </span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="home__grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && error !== null && (
        <div className="home__error" role="alert">
          <p className="home__error-message">{error}</p>
          <button className="home__retry-btn" onClick={fetchRGDs}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && error === null && items.length === 0 && (
        <div className="home__empty">
          <p>No ResourceGraphDefinitions found in this cluster.</p>
          <a
            href="https://kro.run/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn about kro
          </a>
        </div>
      )}

      {!isLoading && error === null && items.length > 0 && filtered.length === 0 && (
        <div className="home__empty">
          <p>No ResourceGraphDefinitions match &ldquo;{query}&rdquo;.</p>
          <button className="home__clear-search" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      )}

      {!isLoading && error === null && filtered.length > 0 && (
        <div className="home__grid">
          {filtered.map((rgd) => (
            <RGDCard key={extractRGDName(rgd)} rgd={rgd} />
          ))}
        </div>
      )}
    </div>
  )
}
