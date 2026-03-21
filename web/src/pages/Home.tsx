// Home — RGD cards grid. Fetches GET /api/v1/rgds on mount.

import { useCallback, useEffect, useState } from 'react'
import type { K8sObject } from '@/lib/api'
import { listRGDs } from '@/lib/api'
import { extractRGDName } from '@/lib/format'
import RGDCard from '@/components/RGDCard'
import SkeletonCard from '@/components/SkeletonCard'
import './Home.css'

export default function Home() {
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="home">
      <h1 className="home__heading">ResourceGraphDefinitions</h1>

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

      {!isLoading && error === null && items.length > 0 && (
        <div className="home__grid">
          {items.map((rgd) => (
            <RGDCard key={extractRGDName(rgd)} rgd={rgd} />
          ))}
        </div>
      )}
    </div>
  )
}
