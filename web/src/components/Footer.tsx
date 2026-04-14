import { useEffect, useState } from 'react'
import { getVersion } from '@/lib/api'
import './Footer.css'

/**
 * Footer — global app footer with kro-ui version, external links.
 *
 * kro-ui version is fetched once from GET /api/v1/version on mount.
 * Shown as "kro-ui v0.5.1" — falls back to "kro-ui" if version unavailable.
 *
 * Spec: .specify/specs/035-global-footer/
 */
export default function Footer() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    getVersion()
      .then((v) => {
        if (ac.signal.aborted) return
        if (v.version && v.version !== 'dev' && v.version !== '') {
          setVersion(v.version)
        }
      })
      .catch(() => {/* silently swallow — version is non-critical */})
    return () => ac.abort()
  }, [])

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__left">
        kro-ui
        {version && (
          <span
            className="footer__version"
            title={`kro-ui version ${version}`}
          >
            {' '}{version}
          </span>
        )}
      </div>
      <nav className="footer__links" aria-label="External resources">
        <a href="https://kro.run" target="_blank" rel="noopener noreferrer">
          kro.run
        </a>
        <a
          href="https://github.com/kubernetes-sigs/kro"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <a
          href="https://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          License
        </a>
      </nav>
    </footer>
  )
}
