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

// RevisionSelector — two-dropdown UI for picking a revision pair to diff.
//
// Spec: .specify/specs/009-rgd-graph-diff/ Phase 1 (T007).
// Emits onChange({ revA, revB }) when both selects have distinct selections.
// Shows an informational message when < 2 revisions exist.

import { useState, useEffect } from 'react'
import type { K8sObject } from '@/lib/api'
import './RevisionSelector.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

function revisionNumber(rev: K8sObject): number {
  const spec = rev.spec as Record<string, unknown> | undefined
  return typeof spec?.revision === 'number' ? spec.revision : 0
}

function revisionName(rev: K8sObject): string {
  const meta = rev.metadata as Record<string, unknown> | undefined
  return typeof meta?.name === 'string' ? meta.name : '?'
}

function revisionLabel(rev: K8sObject): string {
  return `#${revisionNumber(rev)} — ${revisionName(rev)}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RevisionPair {
  revA: K8sObject
  revB: K8sObject
}

interface RevisionSelectorProps {
  /**
   * All available revisions, sorted descending by revision number (latest first).
   * Passed directly from RevisionsTab.
   */
  revisions: K8sObject[]
  /**
   * Called when the user has selected a valid pair (both distinct, both present).
   * Called with null when the selection is cleared or incomplete.
   */
  onChange: (pair: RevisionPair | null) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * RevisionSelector — two <select> dropdowns for choosing a diff pair.
 *
 * When only 1 revision exists, shows "Only one revision exists — nothing to compare."
 * When 0 revisions exist, shows nothing (the parent tab handles the empty state).
 *
 * Spec: T007 (Phase 1).
 */
export default function RevisionSelector({ revisions, onChange }: RevisionSelectorProps) {
  // Default: Rev A = latest, Rev B = second-latest
  const [nameA, setNameA] = useState(() => revisions.length >= 1 ? revisionName(revisions[0]) : '')
  const [nameB, setNameB] = useState(() => revisions.length >= 2 ? revisionName(revisions[1]) : '')

  // Emit the initial default pair on first render (auto-seeds the diff view)
  useEffect(() => {
    if (revisions.length < 2) return
    const revA = revisions[0]
    const revB = revisions[1]
    onChange({ revA, revB })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — only on mount

  if (revisions.length < 2) {
    if (revisions.length === 1) {
      return (
        <p
          className="revision-selector__single-msg"
          data-testid="revision-selector-single-msg"
        >
          Only one revision exists — nothing to compare.
        </p>
      )
    }
    return null
  }

  function handleChangeA(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setNameA(next)
    if (!next || !nameB || next === nameB) { onChange(null); return }
    const revA = revisions.find((r) => revisionName(r) === next)
    const revB = revisions.find((r) => revisionName(r) === nameB)
    if (revA && revB) onChange({ revA, revB })
    else onChange(null)
  }

  function handleChangeB(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setNameB(next)
    if (!nameA || !next || nameA === next) { onChange(null); return }
    const revA = revisions.find((r) => revisionName(r) === nameA)
    const revB = revisions.find((r) => revisionName(r) === next)
    if (revA && revB) onChange({ revA, revB })
    else onChange(null)
  }

  return (
    <div className="revision-selector" data-testid="revision-selector">
      <div className="revision-selector__group">
        <label className="revision-selector__label" htmlFor="rev-select-a">
          Rev A (before)
        </label>
        <select
          id="rev-select-a"
          className="revision-selector__select"
          aria-label="Select revision A (before)"
          value={nameA}
          onChange={handleChangeA}
        >
          {revisions.map((rev) => {
            const name = revisionName(rev)
            return (
              <option key={name} value={name}>
                {revisionLabel(rev)}
              </option>
            )
          })}
        </select>
      </div>

      <div className="revision-selector__arrow" aria-hidden="true">→</div>

      <div className="revision-selector__group">
        <label className="revision-selector__label" htmlFor="rev-select-b">
          Rev B (after)
        </label>
        <select
          id="rev-select-b"
          className="revision-selector__select"
          aria-label="Select revision B (after)"
          value={nameB}
          onChange={handleChangeB}
        >
          {revisions.map((rev) => {
            const name = revisionName(rev)
            return (
              <option key={name} value={name}>
                {revisionLabel(rev)}
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}
