// Layout — top bar (context switcher) + outlet for pages + footer.
// Keying <Outlet> on activeContext forces child routes to remount and refetch
// their data after a context switch.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { listContexts, getCapabilities } from '@/lib/api'
import type { KubeContext, KroCapabilities } from '@/lib/api'
import Footer from './Footer'
import TopBar from './TopBar'
import './Layout.css'

// Minimum supported kro version (mirrors internal/k8s/capabilities.go const)
const MIN_KRO_VERSION = '0.8.0'

export default function Layout() {
  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [activeContext, setActiveContext] = useState('')
  const [capabilities, setCapabilities] = useState<KroCapabilities | null>(null)
  const [dismissed, setDismissed] = useState(false)
  // Generation counter: discard stale capability responses from previous contexts
  const fetchGenRef = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    listContexts()
      .then((res) => {
        setContexts(res.contexts)
        setActiveContext(res.active)
      })
      .catch(() => {
        setContexts([])
        setActiveContext('(unavailable)')
      })
  }, [])

  // Fetch capabilities to show unsupported-version banner (spec 053)
  useEffect(() => {
    const gen = ++fetchGenRef.current
    getCapabilities()
      .then(caps => {
        // Discard if a newer fetch has been initiated (context switched mid-flight)
        if (gen !== fetchGenRef.current) return
        setCapabilities(caps)
        setDismissed(false) // reset dismiss state when context changes
      })
      .catch(() => { /* non-critical — banner won't show on fetch failure */ })
  }, [activeContext])

  const handleSwitch = useCallback((name: string) => {
    setActiveContext(name)
    setCapabilities(null) // hide banner immediately while new caps load
    setDismissed(false)
    navigate('/')
  }, [navigate])

  const showVersionWarning = !dismissed && capabilities !== null && capabilities.isSupported === false
  const kroVersion = capabilities?.version ?? ''

  return (
    <div className="layout">
      <TopBar
        contexts={contexts}
        activeContext={activeContext}
        onSwitch={handleSwitch}
      />
      {showVersionWarning && (
        <div
          className="layout__version-warning"
          role="alert"
          data-testid="kro-version-warning"
        >
          <span className="layout__version-warning-icon" aria-hidden="true">⚠</span>
          kro {kroVersion} is below the minimum supported version ({MIN_KRO_VERSION}).
          Some features may not work correctly.
          {' '}Upgrade kro to v{MIN_KRO_VERSION}+ for full support.
          <button
            type="button"
            className="layout__version-warning-dismiss"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss version warning"
          >
            ✕
          </button>
        </div>
      )}
      <main className="layout__content">
        <Outlet key={activeContext} />
      </main>
      <Footer />
    </div>
  )
}
