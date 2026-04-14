// Copyright 2026 The Kubernetes Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// RevisionsTab.tsx — Lists GraphRevision history for an RGD (kro v0.9.0+).
//
// GraphRevisions are immutable snapshots of an RGD spec. Every spec change
// creates a new revision. This tab shows the revision history with status,
// age, and compilation result.
//
// Spec 009 (GH #13): Two views are provided:
//   1. DAG Diff view — a single merged DAG with color-coded overlays for
//      added/removed/modified/unchanged nodes and edges (FR-005, this PR).
//      Implemented via RevisionSelector + RGDDiffView.
//   2. YAML diff — the existing side-by-side raw YAML view (PR #318 foundation).
//      Remains below the DAG diff as a complementary raw-data fallback.
//
// Spec ref: .specify/specs/046-kro-v090-upgrade/ (Phase 4 — Graph Revisions tab)
// GH #274: kro v0.9.0 upgrade — Graph Revisions tab

import { useState, useEffect, useCallback } from 'react'
import { listGraphRevisions } from '@/lib/api'
import type { K8sObject } from '@/lib/api'
import { formatAge, extractCreationTimestamp } from '@/lib/format'
import { toYaml, cleanK8sObject } from '@/lib/yaml'
import KroCodeBlock from './KroCodeBlock'
import RevisionSelector from './RevisionSelector'
import type { RevisionPair } from './RevisionSelector'
import RGDDiffView from './RGDDiffView'
import './RevisionsTab.css'

interface RevisionsTabProps {
  rgdName: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function revisionNumber(rev: K8sObject): number {
  const spec = rev.spec as Record<string, unknown> | undefined
  return typeof spec?.revision === 'number' ? spec.revision : 0
}

/** Read the compiled graph hash from the GraphRevision label (kro v0.9.1+).
 *
 * Returns the first 8 chars of `kro.run/graph-revision-hash` for display,
 * and the full value for the title tooltip. Returns "—" when absent
 * (kro v0.9.0 objects and any revision created before the label existed).
 */
function hashFromRevision(rev: K8sObject): { display: string; full: string | undefined } {
  const labels = (rev.metadata as Record<string, unknown> | undefined)?.labels
  const full =
    typeof labels === 'object' && labels !== null
      ? ((labels as Record<string, unknown>)['kro.run/graph-revision-hash'] as string | undefined)
      : undefined
  if (!full) return { display: '—', full: undefined }
  return { display: full.length > 8 ? full.slice(0, 8) : full, full }
}

/** Extract the compiled state from a GraphRevision status.
 *
 * Condition type mapping by kro version:
 *   kro v0.9.0+: GraphVerified (status=True → compiled)
 *   kro v0.8.x:  ResourceGraphAccepted (status=True → compiled)
 */
function revisionState(rev: K8sObject): 'compiled' | 'failed' | 'unknown' {
  const status = rev.status as Record<string, unknown> | undefined
  if (!status) return 'unknown'
  const state = status.state
  if (typeof state === 'string') {
    const lower = state.toLowerCase()
    if (lower.includes('fail') || lower.includes('invalid') || lower.includes('error')) return 'failed'
    if (lower.includes('compil') || lower.includes('success') || lower.includes('active')) return 'compiled'
  }
  // Check conditions — accept both v0.9.0 (GraphVerified) and v0.8.x (ResourceGraphAccepted)
  const conditions = status.conditions
  if (Array.isArray(conditions)) {
    for (const c of conditions as Array<Record<string, unknown>>) {
      if (c.type === 'GraphVerified' || c.type === 'ResourceGraphAccepted') {
        return c.status === 'True' ? 'compiled' : 'failed'
      }
    }
    // Fallback: Ready=True on the GraphRevision also means compiled
    for (const c of conditions as Array<Record<string, unknown>>) {
      if (c.type === 'Ready') {
        return c.status === 'True' ? 'compiled' : 'failed'
      }
    }
  }
  return 'unknown'
}

/** Get the compilation error message if the revision failed.
 * Checks both kro v0.9.0 (GraphVerified) and v0.8.x (ResourceGraphAccepted). */
function revisionError(rev: K8sObject): string {
  const status = rev.status as Record<string, unknown> | undefined
  if (!status) return ''
  const conditions = status.conditions
  if (!Array.isArray(conditions)) return ''
  for (const c of conditions as Array<Record<string, unknown>>) {
    if (
      (c.type === 'GraphVerified' || c.type === 'ResourceGraphAccepted') &&
      c.status === 'False'
    ) {
      return typeof c.message === 'string' ? c.message : ''
    }
  }
  return ''
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RevisionsTab — shows the GraphRevision history for an RGD.
 *
 * Displays a table with: revision number, compiled status badge, age, error
 * message (when failed). Clicking a row expands the compiled graph YAML.
 *
 * Shows an empty state when no revisions exist (pre-v0.9.0 clusters or newly
 * created RGDs that haven't been reconciled yet).
 *
 * GH #274 Phase 4.
 */
export default function RevisionsTab({ rgdName }: RevisionsTabProps) {
  const [revisions, setRevisions] = useState<K8sObject[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Spec 009: diff pair selected via RevisionSelector
  const [diffPair, setDiffPair] = useState<RevisionPair | null>(null)

  // Legacy checkbox-based YAML diff (PR #318 foundation) — kept as raw-data fallback
  const [selectedRevs, setSelectedRevs] = useState<Set<string>>(new Set())
  const [yamlDiffPair, setYamlDiffPair] = useState<[K8sObject, K8sObject] | null>(null)

  function toggleSelect(name: string, e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    setSelectedRevs((prev) => {
      const next = new Set(prev)
      if (next.has(name)) { next.delete(name) }
      else if (next.size < 2) { next.add(name) }
      return next
    })
  }

  function handleCompare() {
    if (!revisions || selectedRevs.size !== 2) return
    const keys = Array.from(selectedRevs)
    const a = revisions.find((r) => {
      const m = r.metadata as Record<string, unknown>; return m?.name === keys[0]
    })
    const b = revisions.find((r) => {
      const m = r.metadata as Record<string, unknown>; return m?.name === keys[1]
    })
    if (a && b) setYamlDiffPair([a, b])
  }

  const fetchRevisions = useCallback(() => {
    if (!rgdName) return
    setLoading(true)
    setError(null)
    listGraphRevisions(rgdName)
      .then((list) => {
        const items = (list.items ?? []) as K8sObject[]
        // Sort descending by revision number (latest first)
        items.sort((a, b) => revisionNumber(b) - revisionNumber(a))
        setRevisions(items)
      })
      .catch((err: Error) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [rgdName])

  useEffect(() => {
    fetchRevisions()
  }, [fetchRevisions])

  if (loading) {
    return (
      <div className="revisions-tab revisions-tab--loading" data-testid="revisions-tab">
        <div className="revisions-tab__skeleton" aria-label="Loading revisions…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="revisions-tab revisions-tab--error" data-testid="revisions-tab">
        <p className="revisions-tab__error-msg">
          Could not load revisions.{' '}
          <button type="button" className="revisions-tab__retry" onClick={fetchRevisions}>
            Retry
          </button>
        </p>
      </div>
    )
  }

  if (!revisions || revisions.length === 0) {
    return (
      <div className="revisions-tab revisions-tab--empty" data-testid="revisions-tab">
        <p className="revisions-tab__empty-msg">
          No revisions found. GraphRevisions are created by kro v0.9.0+ each
          time this RGD's spec is updated. Apply a spec change to generate the
          first revision.
        </p>
      </div>
    )
  }

  return (
    <div className="revisions-tab" data-testid="revisions-tab">

      {/* ── Spec 009: DAG diff view ─────────────────────────────────────── */}
      {/* RevisionSelector auto-defaults to latest → second-latest pair     */}
      {revisions.length >= 2 && (
        <div className="revisions-tab__dag-diff-section" data-testid="revisions-dag-diff-section">
          <div className="revisions-tab__dag-diff-header">
            <span className="revisions-tab__dag-diff-title">Graph Diff</span>
            <span className="revisions-tab__dag-diff-subtitle">
              Select two revisions to visualise node and edge changes
            </span>
          </div>
          <RevisionSelector
            revisions={revisions}
            onChange={(pair) => setDiffPair(pair)}
          />
          {diffPair && (
            <RGDDiffView revA={diffPair.revA} revB={diffPair.revB} />
          )}
        </div>
      )}

      {/* ── Legacy YAML diff action bar (PR #318 foundation) ─────────────── */}
      {/* Kept as a complementary raw-data view (spec 009 §Foundation note)  */}
      {revisions.length > 1 && (
        <div className="revisions-tab__compare-bar">
          {selectedRevs.size === 2 ? (
            <>
              <button
                type="button"
                className="revisions-tab__compare-btn"
                onClick={handleCompare}
                data-testid="revisions-compare-btn"
              >
                Compare YAML
              </button>
              <button
                type="button"
                className="revisions-tab__compare-clear"
                onClick={() => { setSelectedRevs(new Set()); setYamlDiffPair(null) }}
              >
                Clear
              </button>
            </>
          ) : selectedRevs.size === 1 ? (
            <span className="revisions-tab__compare-hint">Select 1 more to compare YAML</span>
          ) : (
            <span className="revisions-tab__compare-hint">Or select 2 revisions to compare raw YAML</span>
          )}
        </div>
      )}

      {/* ── YAML diff panel (PR #318 foundation, retained as raw-data fallback) ── */}
      {yamlDiffPair && (
        <div className="revisions-tab__diff-panel" data-testid="revisions-diff-panel">
          <div className="revisions-tab__diff-header">
            <span className="revisions-tab__diff-title">Raw YAML diff</span>
            <button
              type="button"
              className="revisions-tab__diff-close"
              onClick={() => { setYamlDiffPair(null); setSelectedRevs(new Set()) }}
            >
              Close diff
            </button>
          </div>
          <div className="revisions-tab__diff-cols">
            <div className="revisions-tab__diff-col">
              <div className="revisions-tab__diff-col-header">
                {(() => {
                  const m = yamlDiffPair[0].metadata as Record<string, unknown>
                  return `Rev #${revisionNumber(yamlDiffPair[0])} — ${m?.name}`
                })()}
              </div>
              <KroCodeBlock code={toYaml(cleanK8sObject(yamlDiffPair[0]))} title="Rev A" />
            </div>
            <div className="revisions-tab__diff-col">
              <div className="revisions-tab__diff-col-header">
                {(() => {
                  const m = yamlDiffPair[1].metadata as Record<string, unknown>
                  return `Rev #${revisionNumber(yamlDiffPair[1])} — ${m?.name}`
                })()}
              </div>
              <KroCodeBlock code={toYaml(cleanK8sObject(yamlDiffPair[1]))} title="Rev B" />
            </div>
          </div>
        </div>
      )}

      <table className="revisions-table" data-testid="revisions-table">
        <thead>
          <tr>
            {revisions.length > 1 && <th className="revisions-table__th revisions-table__th--check" />}
            <th className="revisions-table__th">Revision</th>
            <th className="revisions-table__th revisions-table__th--hash">Hash</th>
            <th className="revisions-table__th">Status</th>
            <th className="revisions-table__th">Age</th>
            <th className="revisions-table__th revisions-table__th--msg">Message</th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((rev) => {
            const meta = rev.metadata as Record<string, unknown>
            const name = typeof meta?.name === 'string' ? meta.name : '?'
            const state = revisionState(rev)
            const errMsg = revisionError(rev)
            const createdAt = extractCreationTimestamp(rev)
            const age = createdAt ? formatAge(createdAt) : '—'
            const revNum = revisionNumber(rev)
            const { display: hashDisplay, full: hashFull } = hashFromRevision(rev)
            const isExpanded = expanded === name

            return (
              <>
                <tr
                  key={name}
                  className={`revisions-table__row revisions-table__row--${state}${isExpanded ? ' revisions-table__row--expanded' : ''}${selectedRevs.has(name) ? ' revisions-table__row--selected' : ''}`}
                  data-testid={`revision-row-${name}`}
                  onClick={() => setExpanded(isExpanded ? null : name)}
                  style={{ cursor: 'pointer' }}
                >
                  {revisions.length > 1 && (
                    <td
                      className="revisions-table__td revisions-table__td--check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRevs.has(name)}
                        onChange={(e) => toggleSelect(name, e)}
                        disabled={selectedRevs.size === 2 && !selectedRevs.has(name)}
                        aria-label={`Select revision ${name} for comparison`}
                      />
                    </td>
                  )}
                  <td className="revisions-table__td revisions-table__td--rev">
                    <span className="revisions-table__rev-num">#{revNum}</span>
                    <span className="revisions-table__rev-name" title={name}>{name}</span>
                  </td>
                  <td className="revisions-table__td revisions-table__td--hash">
                    {hashFull ? (
                      <span className="revisions-table__hash" title={hashFull}>{hashDisplay}</span>
                    ) : (
                      <span className="revisions-table__hash revisions-table__hash--absent">—</span>
                    )}
                  </td>
                  <td className="revisions-table__td">
                    <span className={`revisions-table__badge revisions-table__badge--${state}`}>
                      {state === 'compiled' ? 'Compiled' : state === 'failed' ? 'Failed' : 'Unknown'}
                    </span>
                  </td>
                  <td className="revisions-table__td">{age}</td>
                  <td className="revisions-table__td revisions-table__td--msg">
                    {errMsg && (
                      <span className="revisions-table__error-text" title={errMsg}>
                        {errMsg.length > 80 ? errMsg.slice(0, 77) + '…' : errMsg}
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${name}-detail`} className="revisions-table__detail-row">
                    <td colSpan={5} className="revisions-table__detail-cell">
                      <KroCodeBlock
                        code={toYaml(cleanK8sObject(rev))}
                        title={`Revision ${name}`}
                      />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
