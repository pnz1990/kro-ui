// InstanceOverlayBar.tsx — Instance picker + summary bar for the Graph tab overlay.
//
// Renders:
//   1. A label + <select> picker listing all live instances of the current RGD.
//   2. A one-line summary bar showing the selected instance's readiness badge
//      and a direct "Open instance →" navigation link.
//
// The component is purely controlled — all state lives in RGDDetail.tsx.
// Graceful degradation:
//   - pickerLoading: loading text
//   - pickerError: inline error + Retry
//   - items.length === 0 (not loading, no error): "No instances" message
//   - overlayLoading: loading text in summary area
//   - overlayError: inline error + Retry in summary area
//
// Spec: .specify/specs/029-dag-instance-overlay/

import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { extractInstanceHealth } from '@/lib/format'
import type { InstanceHealthState } from '@/lib/format'
import { translateApiError } from '@/lib/errors'
import './InstanceOverlayBar.css'

// ── Types ──────────────────────────────────────────────────────────────────

/** A single instance item for the overlay picker. */
export interface PickerItem {
  namespace: string
  name: string
}

export interface InstanceOverlayBarProps {
  /** Name of the current RGD — used to build "Open instance →" link. */
  rgdName: string
  /** Available instances. Empty = show "No instances" message. */
  items: PickerItem[]
  /** True while the picker item list is being fetched. */
  pickerLoading: boolean
  /** Non-null when picker fetch failed. */
  pickerError: string | null
  /**
   * Whether the RGD is in a Ready state. When false, picker errors will hint
   * that the CRD may not be provisioned yet instead of a generic connectivity error.
   */
  rgdReady?: boolean
  /** Currently selected overlay key "<namespace>/<name>", or null for "No overlay". */
  selected: string | null
  /** Raw instance K8sObject for the selected overlay — drives the summary bar. */
  overlayInstance: K8sObject | null
  /** True while the overlay instance + children are being fetched. */
  overlayLoading: boolean
  /** Non-null when overlay data fetch failed. */
  overlayError: string | null
  /** Called when user changes picker selection. null = "No overlay". */
  onSelect: (key: string | null) => void
  /** Called when user clicks Retry on picker fetch error. */
  onPickerRetry: () => void
  /** Called when user clicks Retry on overlay data fetch error. */
  onOverlayRetry: () => void
}

// ── Readiness badge ────────────────────────────────────────────────────────

const READINESS_LABEL: Record<InstanceHealthState, string> = {
  ready: 'Ready',
  reconciling: 'Reconciling',
  error: 'Error',
  pending: 'Pending',
  unknown: 'Unknown',
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * InstanceOverlayBar — picker + summary bar for the RGD Graph tab overlay.
 *
 * Renders between the tab bar and the DAG SVG when the Graph tab is active.
 * Controlled component: all selection state lives in the parent (RGDDetail).
 */
export default function InstanceOverlayBar({
  rgdName,
  items,
  pickerLoading,
  pickerError,
  rgdReady,
  selected,
  overlayInstance,
  overlayLoading,
  overlayError,
  onSelect,
  onPickerRetry,
  onOverlayRetry,
}: InstanceOverlayBarProps) {
  // ── Picker row ────────────────────────────────────────────────────────────

  let pickerContent: React.ReactNode

  if (pickerLoading) {
    pickerContent = (
      <span className="instance-overlay-bar__loading">Loading instances…</span>
    )
  } else if (pickerError) {
    const pickerMsg = rgdReady === false
      ? 'Could not load instance list — the RGD CRD may not be provisioned yet'
      : 'Could not load instance list — check cluster connectivity'
    pickerContent = (
      <span className="instance-overlay-bar__error" role="alert" data-testid="overlay-picker-error">
        <span>{pickerMsg}</span>
        <button
          type="button"
          className="instance-overlay-bar__retry-btn"
          onClick={onPickerRetry}
        >
          Retry
        </button>
      </span>
    )
  } else if (items.length === 0) {
    pickerContent = (
      <span className="instance-overlay-bar__empty">
        No instances — create one with{' '}
        <code className="instance-overlay-bar__code">kubectl apply</code>
        {' '}or use the{' '}
        <Link to={{ search: '?tab=generate' }} className="instance-overlay-bar__generate-link">
          Generate tab
        </Link>
      </span>
    )
  } else {
    pickerContent = (
      <>
        <label htmlFor="instance-overlay-select" className="instance-overlay-bar__label">
          Overlay:
        </label>
        <select
          id="instance-overlay-select"
          className="instance-overlay-bar__select"
          value={selected ?? ''}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">No overlay</option>
          {items.map((item) => {
            const value = item.namespace ? `${item.namespace}/${item.name}` : item.name
            const label = item.namespace ? `${item.namespace}/${item.name}` : item.name
            return (
              <option key={value} value={value}>
                {label}
              </option>
            )
          })}
        </select>
      </>
    )
  }

  // ── Summary bar ──────────────────────────────────────────────────────────

  // Parse selected key into namespace + name
  let summaryNamespace = ''
  let summaryName = ''
  if (selected) {
    const slashIdx = selected.indexOf('/')
    if (slashIdx === -1) {
      summaryName = selected
    } else {
      summaryNamespace = selected.slice(0, slashIdx)
      summaryName = selected.slice(slashIdx + 1)
    }
  }

  let summaryContent: React.ReactNode = null

  if (selected !== null) {
    if (overlayLoading) {
      summaryContent = (
        <div className="instance-overlay-bar__overlay-status">
          Loading overlay…
        </div>
      )
    } else if (overlayError) {
      const overlayMsg = (overlayError.includes('404') || overlayError.toLowerCase().includes('not found'))
        ? 'Instance not found — it may have been deleted'
        : translateApiError(overlayError)
      summaryContent = (
        <div
          className="instance-overlay-bar__overlay-status instance-overlay-bar__overlay-status--error"
          role="alert"
          data-testid="overlay-data-error"
        >
          <span>{overlayMsg}</span>
          <button
            type="button"
            className="instance-overlay-bar__retry-btn"
            onClick={onOverlayRetry}
          >
            Retry
          </button>
        </div>
      )
    } else if (overlayInstance !== null) {
      const { state: readiness } = extractInstanceHealth(overlayInstance)
      const displayRef = summaryNamespace
        ? `${summaryNamespace}/${summaryName}`
        : summaryName
      // Router convention (main.tsx): /rgds/:rgdName/instances/:namespace/:instanceName
      // Cluster-scoped CRs have no namespace; the backend accepts any string for the
      // {namespace} segment and passes it to the dynamic client, which ignores namespace
      // for cluster-scoped resources. "_" is used as a non-empty placeholder so the
      // two-segment path shape is preserved and React Router can always match the route.
      const instancePath = summaryNamespace
        ? `/rgds/${rgdName}/instances/${summaryNamespace}/${summaryName}`
        : `/rgds/${rgdName}/instances/_/${summaryName}`

      summaryContent = (
        <div className="instance-overlay-bar__summary">
          <span className={`instance-overlay-bar__badge instance-overlay-bar__badge--${readiness}`}>
            ● {READINESS_LABEL[readiness]}
          </span>
          <span className="instance-overlay-bar__instance-ref">{displayRef}</span>
          <Link to={instancePath} className="instance-overlay-bar__open-link">
            Open instance →
          </Link>
        </div>
      )
    }
  }

  return (
    <div className="instance-overlay-bar">
      <div className="instance-overlay-bar__row">
        {pickerContent}
      </div>
      {summaryContent}
    </div>
  )
}
