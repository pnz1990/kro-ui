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

// RevisionChangesBanner.tsx — "What's new since last revision" banner on the
// RGD detail Graph tab (kro v0.9.1+).
//
// Shows the count of added/removed resource nodes between the two most recent
// GraphRevisions, with a shortcut link to the Revisions tab diff view.
//
// Only rendered when there are ≥2 revisions AND the graph has changed
// (added > 0 or removed > 0). Zero-change revisions are silently suppressed.
//
// Design ref: docs/design/28-rgd-display.md §Future 28.1 → ✅
// Spec: .specify/specs/issue-767/spec.md

import type { RevisionNodeDiff } from '@/lib/format'
import './RevisionChangesBanner.css'

export interface RevisionChangesBannerProps {
  diff: RevisionNodeDiff
  /** Called when the user clicks "Diff revisions" — should switch to Revisions tab. */
  onDiffRevisions: () => void
}

/**
 * RevisionChangesBanner — informs the operator of node-level changes since
 * the prior GraphRevision, and offers a shortcut to the YAML diff.
 *
 * Not rendered when diff.added and diff.removed are both empty (O3).
 */
export default function RevisionChangesBanner({
  diff,
  onDiffRevisions,
}: RevisionChangesBannerProps) {
  // O3: no banner for identical graphs
  if (diff.added.length === 0 && diff.removed.length === 0) return null

  const parts: string[] = []
  if (diff.added.length > 0) {
    parts.push(`${diff.added.length} node${diff.added.length === 1 ? '' : 's'} added`)
  }
  if (diff.removed.length > 0) {
    parts.push(`${diff.removed.length} node${diff.removed.length === 1 ? '' : 's'} removed`)
  }
  const summary = parts.join(', ')

  return (
    <div
      className="revision-changes-banner"
      role="status"
      aria-live="polite"
      data-testid="revision-changes-banner"
    >
      <span className="revision-changes-banner__icon" aria-hidden="true">⬆</span>
      <span className="revision-changes-banner__text">
        {summary} since r{diff.priorRevisionNumber}
      </span>
      <button
        className="revision-changes-banner__diff-btn"
        onClick={onDiffRevisions}
        aria-label={`Diff revisions — compare r${diff.priorRevisionNumber} with r${diff.latestRevisionNumber}`}
        data-testid="revision-changes-diff-btn"
      >
        Diff revisions
      </button>
    </div>
  )
}
