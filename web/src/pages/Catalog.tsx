// Catalog — searchable RGD registry with filtering, sorting, and chaining detection.
// Fetches all RGDs on mount, then fires parallel instance-count requests.
// All search/filter/sort is client-side — no API call per keystroke.
// Issue #116: instanceCounts uses undefined="loading", null="failed", number="resolved".
// spec 070: status filter — all / ready / errors toggle for compile-state filtering.
// spec issue-534: selection mode for bulk YAML export.
// spec issue-535: saved searches / filter presets via localStorage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { K8sObject } from '@/lib/api'
import { listRGDs, listInstances, getRGD } from '@/lib/api'
import { extractRGDName, extractReadyStatus } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  buildChainingMap,
  collectAllLabels,
  matchesSearch,
  matchesLabelFilter,
  sortCatalog,
  countChainingReferences,
  computeComplexityScore,
} from '@/lib/catalog'
import type { SortOption } from '@/lib/catalog'
import { useDebounce } from '@/hooks/useDebounce'
import { translateApiError } from '@/lib/errors'
import { cleanK8sObject, toYaml } from '@/lib/yaml'
import CatalogCard from '@/components/CatalogCard'
import SearchBar from '@/components/SearchBar'
import LabelFilter from '@/components/LabelFilter'
import VirtualGrid from '@/components/VirtualGrid'
import './Catalog.css'

// CatalogCard is normalized to 160px height (min-height/max-height in CatalogCard.css).
const CATALOG_CARD_HEIGHT = 160

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'complexity', label: 'Most complex' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'kind', label: 'Kind A–Z' },
  { value: 'instances', label: 'Most instances' },
  { value: 'resources', label: 'Resource count' },
  { value: 'newest', label: 'Newest first' },
]

// ── Filter preset types (spec issue-535) ─────────────────────────────────────

const PRESETS_KEY = 'catalog-filter-presets'
const MAX_PRESETS = 20

interface FilterPreset {
  id: string         // unique ID for stable React keys
  name: string       // user-supplied label
  searchQuery: string
  activeLabels: string[]
  sortOption: SortOption
  statusFilter: 'all' | 'ready' | 'errors'
}

function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as FilterPreset[]
  } catch {
    return []
  }
}

function savePresets(presets: FilterPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch { /* silent — localStorage may be unavailable */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Catalog() {
  usePageTitle('Catalog')
  const [items, setItems] = useState<K8sObject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // instanceCounts maps rgdName → undefined (loading) | null (failed) | number (resolved).
  const [instanceCounts, setInstanceCounts] = useState<Map<string, number | null | undefined>>(new Map())

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [activeLabels, setActiveLabels] = useState<string[]>([])
  const [sortOption, setSortOption] = useState<SortOption>('complexity')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'errors'>('all')

  // spec issue-534: selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)

  // spec issue-535: preset state
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets)
  const [showPresets, setShowPresets] = useState(false)
  const [saveFormOpen, setSaveFormOpen] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [focusedPresetIdx, setFocusedPresetIdx] = useState<number>(-1)
  const presetsDropdownRef = useRef<HTMLDivElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)
  const presetsBtnRef = useRef<HTMLButtonElement>(null)

  // Escape key: exit selection mode OR close presets dropdown
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectionMode) {
          setSelectionMode(false)
          setSelectedNames(new Set())
        } else if (showPresets) {
          setShowPresets(false)
          setFocusedPresetIdx(-1)
          presetsBtnRef.current?.focus()
        } else if (saveFormOpen) {
          setSaveFormOpen(false)
          setPresetNameInput('')
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectionMode, showPresets, saveFormOpen])

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!showPresets) return
    function onMouseDown(e: MouseEvent) {
      if (presetsDropdownRef.current && !presetsDropdownRef.current.contains(e.target as Node)) {
        setShowPresets(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showPresets])

  // Focus save name input when form opens
  useEffect(() => {
    if (saveFormOpen) {
      setTimeout(() => saveInputRef.current?.focus(), 0)
    }
  }, [saveFormOpen])

  // Focus the correct preset apply button when focusedPresetIdx changes
  useEffect(() => {
    if (!showPresets || focusedPresetIdx < 0 || !presetsDropdownRef.current) return
    const buttons = presetsDropdownRef.current.querySelectorAll<HTMLButtonElement>(
      '.catalog__preset-apply',
    )
    buttons[focusedPresetIdx]?.focus()
  }, [showPresets, focusedPresetIdx])

  // Fetch all RGDs once on mount
  const fetchRGDs = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setInstanceCounts(new Map())
    listRGDs()
      .then((res) => {
        setItems(res.items ?? [])
        const loadingMap = new Map<string, number | null | undefined>()
        for (const rgd of res.items ?? []) {
          const name = extractRGDName(rgd)
          if (name) loadingMap.set(name, undefined)
        }
        setInstanceCounts(loadingMap)
        for (const rgd of res.items ?? []) {
          const name = extractRGDName(rgd)
          if (!name) continue
          listInstances(name)
            .then((list) => {
              setInstanceCounts((prev) => new Map(prev).set(name, (list.items ?? []).length))
            })
            .catch(() => {
              setInstanceCounts((prev) => new Map(prev).set(name, null))
            })
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchRGDs()
  }, [fetchRGDs])

  const chainingMap = useMemo(() => buildChainingMap(items), [items])
  const allLabels = useMemo(() => collectAllLabels(items), [items])

  const entries = useMemo(
    () =>
      items.map((rgd) => {
        const name = extractRGDName(rgd)
        const instanceCount = instanceCounts.has(name) ? instanceCounts.get(name) : undefined
        const chainingCount = countChainingReferences(rgd, items)
        const complexityScore = computeComplexityScore(rgd, chainingCount)
        return { rgd, instanceCount, complexityScore }
      }),
    [items, instanceCounts],
  )

  const filtered = useMemo(
    () =>
      entries.filter(({ rgd }) => {
        if (!matchesSearch(rgd, debouncedQuery)) return false
        if (!matchesLabelFilter(rgd, activeLabels)) return false
        if (statusFilter !== 'all') {
          const state = extractReadyStatus(rgd).state
          if (statusFilter === 'ready' && state !== 'ready') return false
          if (statusFilter === 'errors' && state !== 'error') return false
        }
        return true
      }),
    [entries, debouncedQuery, activeLabels, statusFilter],
  )

  const sorted = useMemo(() => sortCatalog(filtered, sortOption), [filtered, sortOption])

  function clearFilters() {
    setSearchQuery('')
    setActiveLabels([])
    setStatusFilter('all')
  }

  // A filter is "active" if any field differs from defaults (spec issue-535 O1)
  const hasFilters =
    searchQuery !== '' ||
    activeLabels.length > 0 ||
    statusFilter !== 'all' ||
    sortOption !== 'name'

  // ── Selection mode handlers (spec issue-534) ──────────────────────────────

  function handleEnterSelectionMode() {
    setSelectionMode(true)
    setSelectedNames(new Set())
  }

  function handleExitSelectionMode() {
    setSelectionMode(false)
    setSelectedNames(new Set())
  }

  function handleCardToggle(name: string, nowSelected: boolean) {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (nowSelected) next.add(name); else next.delete(name)
      return next
    })
  }

  const visibleNames = useMemo(() => sorted.map(({ rgd }) => extractRGDName(rgd)), [sorted])
  const allVisible = visibleNames.length > 0 && visibleNames.every((n) => selectedNames.has(n))

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedNames(new Set(visibleNames))
    } else {
      setSelectedNames((prev) => {
        const next = new Set(prev)
        for (const n of visibleNames) next.delete(n)
        return next
      })
    }
  }

  async function handleExportYAML() {
    const names = Array.from(selectedNames)
    if (names.length === 0) return
    setIsExporting(true)
    try {
      const docs: string[] = []
      for (const name of names) {
        try {
          const rgd = await getRGD(name)
          const cleaned = cleanK8sObject(rgd)
          docs.push(toYaml(cleaned))
        } catch {
          docs.push(`# Failed to fetch ${name}`)
        }
      }
      const yaml = docs.join('\n---\n')
      const today = new Date().toISOString().slice(0, 10)
      const filename = `kro-rgds-${today}.yaml`
      const blob = new Blob([yaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  // ── Preset handlers (spec issue-535) ─────────────────────────────────────

  function handleSavePreset() {
    const name = presetNameInput.trim()
    if (!name) return
    const preset: FilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      searchQuery,
      activeLabels: [...activeLabels],
      sortOption,
      statusFilter,
    }
    // Most-recently-saved first (spec Z2 Judgment)
    const next = [preset, ...presets].slice(0, MAX_PRESETS)
    setPresets(next)
    savePresets(next)
    setSaveFormOpen(false)
    setPresetNameInput('')
  }

  function handleApplyPreset(preset: FilterPreset) {
    setSearchQuery(preset.searchQuery)
    setActiveLabels(preset.activeLabels)
    setSortOption(preset.sortOption)
    setStatusFilter(preset.statusFilter)
    setShowPresets(false)
  }

  function handleDeletePreset(id: string) {
    const next = presets.filter((p) => p.id !== id)
    setPresets(next)
    savePresets(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="catalog">
      <div className="catalog__header">
        <div className="catalog__title-row">
          <h1 className="catalog__heading">RGD Catalog</h1>
          {!isLoading && !error && (
            <span className="catalog__count" aria-live="polite">
              {sorted.length} of {items.length}
            </span>
          )}
        </div>
        <p className="catalog__subtitle">Browse, filter, and discover all ResourceGraphDefinitions</p>

        <div className="catalog__toolbar">
          <SearchBar value={searchQuery} onSearch={setSearchQuery} />
          <LabelFilter
            labels={allLabels}
            activeLabels={activeLabels}
            onFilter={setActiveLabels}
          />
          {/* spec 070: compile-status filter */}
          <div className="catalog__status-filter" role="group" aria-label="Filter by compile status">
            {(['all', 'ready', 'errors'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`catalog__status-btn${statusFilter === v ? ' catalog__status-btn--active' : ''}`}
                onClick={() => setStatusFilter(v)}
                aria-pressed={statusFilter === v}
                data-testid={`catalog-status-${v}`}
              >
                {v === 'all' ? 'All' : v === 'ready' ? 'Ready' : 'Errors'}
              </button>
            ))}
          </div>

          <div className="catalog__sort">
            <label htmlFor="catalog-sort" className="catalog__sort-label">
              Sort:
            </label>
            <div className="catalog__sort-wrapper">
              <select
                id="catalog-sort"
                className="catalog__sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* spec issue-535: Presets dropdown (O3, O6) */}
          <div className="catalog__presets-wrap" ref={presetsDropdownRef}>
            <button
              ref={presetsBtnRef}
              type="button"
              className={`catalog__presets-btn${showPresets ? ' catalog__presets-btn--open' : ''}`}
              onClick={() => { setShowPresets((v) => !v); setFocusedPresetIdx(-1) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && !showPresets) {
                  e.preventDefault()
                  setShowPresets(true)
                  setFocusedPresetIdx(0)
                } else if (e.key === 'ArrowDown' && showPresets) {
                  e.preventDefault()
                  setFocusedPresetIdx((i) => Math.min(i + 1, presets.length - 1))
                } else if (e.key === 'ArrowUp' && showPresets) {
                  e.preventDefault()
                  setFocusedPresetIdx((i) => Math.max(i - 1, 0))
                }
              }}
              aria-expanded={showPresets}
              aria-haspopup="listbox"
              data-testid="catalog-presets-toggle"
            >
              Presets{presets.length > 0 ? ` (${presets.length})` : ''}
            </button>
            {showPresets && (
              <div
                className="catalog__presets-dropdown"
                role="listbox"
                aria-label="Saved filter presets"
                data-testid="catalog-presets-dropdown"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setFocusedPresetIdx((i) => Math.min(i + 1, presets.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setFocusedPresetIdx((i) => {
                      if (i <= 0) { setShowPresets(false); presetsBtnRef.current?.focus(); return -1 }
                      return i - 1
                    })
                  }
                }}
              >
                {presets.length === 0 ? (
                  <p className="catalog__presets-empty">No saved presets</p>
                ) : (
                  presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="catalog__preset-item"
                      role="option"
                      aria-selected="false"
                    >
                      <button
                        type="button"
                        className="catalog__preset-apply"
                        onClick={() => handleApplyPreset(preset)}
                        data-testid={`catalog-preset-apply-${preset.id}`}
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        className="catalog__preset-delete"
                        onClick={() => handleDeletePreset(preset.id)}
                        aria-label={`Delete preset ${preset.name}`}
                        data-testid={`catalog-preset-delete-${preset.id}`}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* spec issue-535: Save filter button — visible when filter active (O1, O8) */}
          {hasFilters && !saveFormOpen && (
            <button
              type="button"
              className="catalog__save-filter-btn"
              onClick={() => setSaveFormOpen(true)}
              disabled={presets.length >= MAX_PRESETS}
              title={
                presets.length >= MAX_PRESETS
                  ? 'Maximum 20 presets reached — delete one first'
                  : 'Save current filters as a preset'
              }
              data-testid="catalog-save-filter"
            >
              Save filter
            </button>
          )}

          {/* spec issue-534: selection mode toggle */}
          {!isLoading && !error && !selectionMode && (
            <button
              type="button"
              className="catalog__select-btn"
              onClick={handleEnterSelectionMode}
              data-testid="catalog-select-mode"
            >
              Select
            </button>
          )}
        </div>

        {/* spec issue-535: inline save-preset form (O2) */}
        {saveFormOpen && (
          <div className="catalog__save-form" data-testid="catalog-save-form">
            <label className="catalog__save-form-label" htmlFor="catalog-preset-name">
              Preset name:
            </label>
            <input
              id="catalog-preset-name"
              ref={saveInputRef}
              type="text"
              className="catalog__save-form-input"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset()
                if (e.key === 'Escape') { setSaveFormOpen(false); setPresetNameInput('') }
              }}
              placeholder="e.g. errors only"
              maxLength={60}
              data-testid="catalog-preset-name-input"
            />
            <button
              type="button"
              className="catalog__save-form-confirm"
              onClick={handleSavePreset}
              disabled={!presetNameInput.trim()}
              data-testid="catalog-preset-save-confirm"
            >
              Save
            </button>
            <button
              type="button"
              className="catalog__save-form-cancel"
              onClick={() => { setSaveFormOpen(false); setPresetNameInput('') }}
              data-testid="catalog-preset-save-cancel"
            >
              Cancel
            </button>
          </div>
        )}

        {/* spec issue-534: selection toolbar */}
        {selectionMode && (
          <div className="catalog__selection-toolbar" data-testid="catalog-selection-toolbar">
            <label className="catalog__select-all" data-testid="catalog-select-all">
              <input
                type="checkbox"
                checked={allVisible}
                onChange={(e) => handleSelectAll(e.target.checked)}
                aria-label="Select all visible RGDs"
              />
              Select all ({visibleNames.length})
            </label>
            {selectedNames.size > 0 && (
              <button
                type="button"
                className="catalog__export-btn"
                onClick={handleExportYAML}
                disabled={isExporting}
                aria-label={`Export ${selectedNames.size} selected RGDs`}
                data-testid="catalog-export-yaml"
              >
                {isExporting ? 'Exporting…' : `Export YAML (${selectedNames.size})`}
              </button>
            )}
            <button
              type="button"
              className="catalog__cancel-select-btn"
              onClick={handleExitSelectionMode}
              data-testid="catalog-cancel-select"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="catalog__grid--loading" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="catalog__skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {!isLoading && error !== null && (
        <div className="catalog__error" role="alert">
          <p className="catalog__error-message">{translateApiError(error)}</p>
          <button className="catalog__retry-btn" onClick={fetchRGDs}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && error === null && (
         <VirtualGrid
          items={sorted}
          itemHeight={CATALOG_CARD_HEIGHT}
          renderItem={({ rgd, instanceCount, complexityScore }) => {
            const name = extractRGDName(rgd)
            return (
              <CatalogCard
                key={name}
                rgd={rgd}
                instanceCount={instanceCount}
                usedBy={chainingMap.get(name) ?? []}
                onLabelClick={(label) =>
                  setActiveLabels((prev) =>
                    prev.includes(label) ? prev : [...prev, label],
                  )
                }
                selectable={selectionMode}
                selected={selectedNames.has(name)}
                onToggle={handleCardToggle}
                complexityScore={complexityScore}
              />
            )
          }}
          emptyState={
            <div className="catalog__empty" data-testid="catalog-empty">
              {hasFilters ? (
                <>
                  <p>No RGDs match your search.</p>
                  <button className="catalog__clear-filters-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : items.length === 0 ? (
                <>
                  <p>No ResourceGraphDefinitions found in this cluster.</p>
                  <p className="catalog__empty-hint">
                    Create one with{' '}
                    <code>kubectl apply -f your-rgd.yaml</code>
                    {' '}or use the{' '}
                    <Link to="/author" data-testid="catalog-new-rgd-link">
                      RGD Designer
                    </Link>.
                  </p>
                </>
              ) : (
                <p>No RGDs match your search.</p>
              )}
            </div>
          }
          className="catalog__virtual-grid"
        />
      )}
    </div>
  )
}
