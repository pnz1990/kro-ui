// Layout — top bar (context display) + outlet for pages.

import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { listContexts } from '@/lib/api'
import TopBar from './TopBar'
import './Layout.css'

export default function Layout() {
  const [contextName, setContextName] = useState('')

  useEffect(() => {
    listContexts()
      .then((res) => setContextName(res.active))
      .catch(() => {
        // Graceful degradation: context display is informational, not blocking
        setContextName('')
      })
  }, [])

  return (
    <div className="layout">
      <TopBar contextName={contextName} />
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  )
}
