// ClusterImportPanel.tsx — Load an existing RGD from the live cluster into the Designer.
//
// Collapsible panel that fetches the RGD list on expand, lets the user select
// one from a dropdown, and loads its YAML into the authoring form via parseRGDYAML.
//
// Spec: .specify/specs/issue-542/spec.md FR-001–FR-010

import { useState } from 'react'
import * as api from '@/lib/api'
import { parseRGDYAML } from '@/lib/generator'
import { toYaml } from '@/lib/yaml'
import type { RGDAuthoringState } from '@/lib/generator'
import './ClusterImportPanel.css'

interface ClusterImportPanelProps {
  /** Called when a valid RGD is fetched and parsed. Replaces the form state. */
  onImport: (state: RGDAuthoringState) => void
}

/**
 * ClusterImportPanel — collapsible "Load from Cluster" panel.
 *
 * Collapsed by default (FR-007 — do not fetch on mount).
 * On expand: fetches the RGD list from the cluster.
 * User selects an RGD name, clicks Load → YAML fetched → parseRGDYAML → onImport.
 *
 * Spec: issue-542 FR-001–FR-010
 */
export default function ClusterImportPanel({ onImport }: ClusterImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rgdNames, setRgdNames] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [listError, setListError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [loadLoading, setLoadLoading] = useState(false)

  async function handleToggle() {
    const opening = !isOpen
    setIsOpen(opening)
    // Clear errors when collapsing
    if (!opening) {
      setListError(null)
      setLoadError(null)
      return
    }
    // Fetch RGD list on expand (FR-007)
    setListLoading(true)
    setListError(null)
    setRgdNames([])
    setSelected('')
    try {
      const result = await api.listRGDs()
      const items = result.items ?? []
      const names = items
        .map((item) => {
          const meta = item.metadata as Record<string, unknown> | undefined
          return (meta?.name as string | undefined) ?? ''
        })
        .filter(Boolean)
        .sort()
      setRgdNames(names)
      if (names.length > 0) setSelected(names[0])
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to list RGDs')
    } finally {
      setListLoading(false)
    }
  }

  async function handleLoad() {
    if (!selected) return
    setLoadLoading(true)
    setLoadError(null)
    try {
      const rgdObject = await api.getRGD(selected)
      const yaml = toYaml(rgdObject)
      const result = parseRGDYAML(yaml)
      if (result.ok) {
        onImport(result.state)
        setIsOpen(false)
        setLoadError(null)
      } else {
        setLoadError(result.error)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load RGD')
    } finally {
      setLoadLoading(false)
    }
  }

  return (
    <div className="cluster-import-panel">
      <button
        type="button"
        className="cluster-import-panel__header"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls="cluster-import-body"
        data-testid="cluster-import-toggle"
      >
        <span className="cluster-import-panel__toggle-icon">{isOpen ? '▾' : '▸'}</span>
        Load from Cluster
      </button>

      {isOpen && (
        <div className="cluster-import-panel__body" id="cluster-import-body">
          {listLoading && (
            <span className="cluster-import-panel__hint" data-testid="cluster-import-loading">
              Loading RGDs…
            </span>
          )}

          {!listLoading && listError !== null && (
            <span
              className="cluster-import-panel__error"
              role="alert"
              aria-live="polite"
              data-testid="cluster-import-list-error"
            >
              {listError}
            </span>
          )}

          {!listLoading && listError === null && rgdNames.length === 0 && (
            <span className="cluster-import-panel__hint" data-testid="cluster-import-empty">
              No RGDs found on cluster
            </span>
          )}

          {!listLoading && rgdNames.length > 0 && (
            <div className="cluster-import-panel__row">
              <label className="cluster-import-panel__label" htmlFor="cluster-import-select">
                RGD
              </label>
              <select
                id="cluster-import-select"
                className="cluster-import-panel__select"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value)
                  setLoadError(null)
                }}
                data-testid="cluster-import-select"
              >
                {rgdNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="cluster-import-panel__load-btn"
                onClick={handleLoad}
                disabled={loadLoading || !selected}
                aria-disabled={loadLoading || !selected}
                data-testid="cluster-import-load"
              >
                {loadLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
          )}

          {loadError !== null && (
            <span
              className="cluster-import-panel__error"
              role="alert"
              aria-live="polite"
              data-testid="cluster-import-load-error"
            >
              {loadError}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
