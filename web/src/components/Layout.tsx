// Layout — top bar (context switcher) + outlet for pages + footer.
// Keying <Outlet> on activeContext forces child routes to remount and refetch
// their data after a context switch.

import { useCallback, useEffect, useState } from 'react'
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
  const navigate = useNavigate()

  useEffect(() => {
    listContexts()
      .then((res) => {
        setContexts(res.contexts)
        setActiveContext(res.active)
      })
      .catch(() => {
        // Issue #253: use a sentinel instead of '' so the context switcher button
        // shows a readable label rather than blank when the server is unreachable.
        // Graceful degradation: context display is informational, not blocking.
        setContexts([])
        setActiveContext('(unavailable)')
      })
  }, [])

  // Fetch capabilities to show unsupported-version banner (spec 053)
  useEffect(() => {
    getCapabilities()
      .then(setCapabilities)
      .catch(() => { /* non-critical — banner won't show on fetch failure */ })
  }, [activeContext])

  const handleSwitch = useCallback((name: string) => {
    setActiveContext(name)
    setCapabilities(null) // reset so banner re-evaluates on new context
    // Navigate to Overview so the new cluster's RGD list loads immediately.
    // The <Outlet key={activeContext}> re-key ensures a full remount.
    navigate('/')
  }, [navigate])

  // Show unsupported-version warning when isSupported=false
  const showVersionWarning = capabilities !== null && capabilities.isSupported === false
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
          <span className="layout__version-warning-icon" aria-hidden="true">[!]</span>
          kro {kroVersion} is below the minimum supported version ({MIN_KRO_VERSION}).
          Some features may not work correctly.
          {' '}Upgrade kro to v{MIN_KRO_VERSION}+ for full support.
        </div>
      )}
      <main className="layout__content">
        {/* Key on activeContext forces child routes to remount and refetch data */}
        <Outlet key={activeContext} />
      </main>
      <Footer />
    </div>
  )
}
