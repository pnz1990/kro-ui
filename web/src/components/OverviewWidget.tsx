// OverviewWidget — generic widget card wrapper for the Overview SRE dashboard.
// Handles the title bar, shimmer loading skeleton, and inline error state.
// All 7 dashboard widgets use this as their outer container.
// Spec: .specify/specs/062-overview-sre-dashboard/

import './OverviewWidget.css'

export interface OverviewWidgetProps {
  /** Widget title shown in the card header */
  title: string
  /** When true, renders shimmer skeleton instead of children */
  loading: boolean
  /** When non-null, renders inline error with optional Retry button */
  error: string | null
  /** Called when the user clicks "Retry" in the error state */
  onRetry?: () => void
  /** Optional CSS class added to the card root (e.g. for grid-area assignment) */
  className?: string
  /** data-testid for the card root — used in tests to locate specific widgets */
  'data-testid'?: string
  /** Widget content — rendered only when !loading && error === null */
  children?: React.ReactNode
}

export default function OverviewWidget({
  title,
  loading,
  error,
  onRetry,
  className,
  'data-testid': testId,
  children,
}: OverviewWidgetProps) {
  const rootClass = ['overview-widget', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} data-testid={testId ?? className}>
      <div className="overview-widget__header">
        <h2 className="overview-widget__title">{title}</h2>
      </div>

      {loading && (
        <div className="overview-widget__skeleton" aria-busy="true" aria-label={`Loading ${title}`}>
          <span className="overview-widget__skeleton-line" />
          <span className="overview-widget__skeleton-line overview-widget__skeleton-line--short" />
          <span className="overview-widget__skeleton-line" />
        </div>
      )}

      {!loading && error !== null && (
        <div className="overview-widget__error" role="alert">
          <span className="overview-widget__error-msg">⚠ Could not load {title}.</span>
          {onRetry && (
            <button
              type="button"
              className="overview-widget__retry"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && error === null && (
        <div className="overview-widget__body">
          {children}
        </div>
      )}
    </div>
  )
}
