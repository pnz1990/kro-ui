// Layout — top bar (context switcher) + outlet for pages + footer.
// Keying <Outlet> on activeContext forces child routes to remount and refetch
// their data after a context switch.

import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { listContexts } from '@/lib/api'
import type { KubeContext } from '@/lib/api'
import Footer from './Footer'
import TopBar from './TopBar'
import './Layout.css'

export default function Layout() {
  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [activeContext, setActiveContext] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    listContexts()
      .then((res) => {
        setContexts(res.contexts)
        setActiveContext(res.active)
      })
      .catch(() => {
        // Graceful degradation: context display is informational, not blocking
        setContexts([])
        setActiveContext('')
      })
  }, [])

  const handleSwitch = useCallback((name: string) => {
    setActiveContext(name)
    // Navigate to Overview so the new cluster's RGD list loads immediately.
    // The <Outlet key={activeContext}> re-key ensures a full remount.
    navigate('/')
  }, [navigate])

  return (
    <div className="layout">
      <TopBar
        contexts={contexts}
        activeContext={activeContext}
        onSwitch={handleSwitch}
      />
      <main className="layout__content">
        {/* Key on activeContext forces child routes to remount and refetch data */}
        <Outlet key={activeContext} />
      </main>
      <Footer />
    </div>
  )
}
