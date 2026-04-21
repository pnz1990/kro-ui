/* PageLoader — Suspense fallback shown while a route chunk loads.
 * Renders within the Layout shell (nav stays visible).
 * Uses the same shimmer animation as SkeletonCard for visual consistency. */

import './PageLoader.css'

export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading page">
      <div className="page-loader__bar" aria-hidden="true" />
    </div>
  )
}
