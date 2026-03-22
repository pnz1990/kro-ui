// NotFound — 404 page for unmatched routes.
// Implements constitution §XIII (route completeness), issue #68.

import { Link, useLocation } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import './NotFound.css'

export default function NotFound() {
  usePageTitle('Not Found')
  const location = useLocation()

  return (
    <div className="not-found" data-testid="not-found-page">
      <h1 className="not-found__heading">Page not found</h1>
      <p className="not-found__url" data-testid="not-found-url">
        <code>{location.pathname}</code>
      </p>
      <p className="not-found__message">
        The page you requested does not exist.
      </p>
      <Link to="/" className="not-found__home-link">
        Back to home
      </Link>
    </div>
  )
}
