// Layout — top bar (context switcher) + outlet for pages + footer.
// Keying <Outlet> on activeContext forces child routes to remount and refetch
// their data after a context switch.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { listContexts, getCapabilities } from '@/lib/api'
import type { KubeContext, KroCapabilities } from '@/lib/api'
import { isNetworkError } from '@/lib/errors'
import { useAlertSubscription } from '@/hooks/useAlertSubscription'
import { useTheme } from '@/hooks/useTheme'
import { AlertContext } from '@/lib/alertContext'
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
  const [clusterUnreachable, setClusterUnreachable] = useState(false)
  const [unreachableDismissed, setUnreachableDismissed] = useState(false)
  // Generation counter: discard stale capability responses from previous contexts
  const fetchGenRef = useRef(0)
  // Track network failures from initial probes for >50% threshold detection.
  // We use two probes: listContexts + getCapabilities. If both fail with network
  // errors, that is 2/2 = 100% — show the cluster-unreachable banner.
  const networkFailuresRef = useRef(0)
  const navigate = useNavigate()

  // OS-preference theme sync with localStorage override (spec 27.17)
  const { theme, setTheme } = useTheme()

  // Health alert subscriptions (spec issue-540)
  const { available: alertAvailable, subscriptionState, toggleSubscription, checkTransitions } = useAlertSubscription()

  useEffect(() => {
    // Reset network failure tracking on each mount / context switch
    networkFailuresRef.current = 0
    setClusterUnreachable(false)
    setUnreachableDismissed(false)

    listContexts()
      .then((res) => {
        setContexts(res.contexts)
        setActiveContext(res.active)
      })
      .catch((err) => {
        setContexts([])
        setActiveContext('(unavailable)')
        if (isNetworkError(err)) {
          networkFailuresRef.current += 1
          // Will be evaluated again when capabilities probe completes
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch capabilities to show unsupported-version banner (spec 053)
  // Also acts as second network probe for cluster-unreachable detection (spec issue-582)
  useEffect(() => {
    const gen = ++fetchGenRef.current
    getCapabilities()
      .then(caps => {
        // Discard if a newer fetch has been initiated (context switched mid-flight)
        if (gen !== fetchGenRef.current) return
        setCapabilities(caps)
        setDismissed(false) // reset dismiss state when context changes
        // Capabilities probe succeeded → cluster is reachable
        setClusterUnreachable(false)
      })
      .catch((err) => {
        if (gen !== fetchGenRef.current) return
        if (isNetworkError(err)) {
          networkFailuresRef.current += 1
          // 2 probes total (listContexts + getCapabilities).
          // If ≥1 network failure (50% threshold), show cluster-unreachable banner.
          // Using ≥1 rather than both because listContexts can succeed (cached)
          // while getCapabilities fails — still signals unreachable cluster.
          setClusterUnreachable(true)
        }
      })
  }, [activeContext])

  const handleSwitch = useCallback((name: string) => {
    setActiveContext(name)
    setCapabilities(null) // hide banner immediately while new caps load
    setDismissed(false)
    networkFailuresRef.current = 0
    setClusterUnreachable(false)
    setUnreachableDismissed(false)
    navigate('/')
  }, [navigate])

  const showVersionWarning = !dismissed && capabilities !== null && capabilities.isSupported === false
  const kroVersion = capabilities?.version ?? ''
  const showUnreachable = clusterUnreachable && !unreachableDismissed

  return (
    <AlertContext.Provider value={{ checkTransitions }}>
      <div className="layout">
        {/* Skip-to-main-content link — WCAG 2.1 SC 2.4.1 (Bypass Blocks)
            Visually hidden until focused; keyboard/screen-reader users jump past navigation. */}
        <a href="#main-content" className="layout__skip-link">
          Skip to main content
        </a>
        <TopBar
          contexts={contexts}
          activeContext={activeContext}
          onSwitch={handleSwitch}
          alertAvailable={alertAvailable}
          alertSubscriptionState={subscriptionState}
          onAlertToggle={toggleSubscription}
          theme={theme}
          onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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
        {showUnreachable && (
          <div
            className="layout__cluster-unreachable"
            role="alert"
            data-testid="cluster-unreachable-banner"
          >
            <span className="layout__cluster-unreachable-icon" aria-hidden="true">✕</span>
            <span className="layout__cluster-unreachable-msg">
              Cannot reach cluster — check that kro-ui is running and the kubeconfig context is reachable.
            </span>
            <button
              type="button"
              className="layout__cluster-unreachable-retry"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button
              type="button"
              className="layout__cluster-unreachable-dismiss"
              onClick={() => setUnreachableDismissed(true)}
              aria-label="Dismiss cluster unreachable banner"
            >
              ✕
            </button>
          </div>
        )}
        <main className="layout__content" id="main-content">
          <Outlet key={activeContext} />
        </main>
        <Footer />
      </div>
    </AlertContext.Provider>
  )
}
