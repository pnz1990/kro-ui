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

// InstanceYamlDiff — full side-by-side YAML diff panel for two instances.
//
// Spec: .specify/specs/issue-537/spec.md
// Design ref: docs/design/29-instance-management.md §Future → ✅
//
// Shows cleaned full YAML of two instances side-by-side, with per-line
// highlight for added/removed lines (LCS-based diff from @/lib/diff).

import { useMemo } from 'react'
import type { K8sObject } from '@/lib/api'
import { toYaml, cleanK8sObject } from '@/lib/yaml'
import { computeLineDiff, countChangedLines } from '@/lib/diff'
import { displayNamespace } from '@/lib/format'
import './InstanceYamlDiff.css'

// ── Helpers ───────────────────────────────────────────────────────────────

function instanceLabel(item: K8sObject): string {
  const meta = item.metadata as Record<string, unknown> | undefined
  const name = typeof meta?.name === 'string' ? meta.name : '?'
  const ns = typeof meta?.namespace === 'string' ? meta.namespace : ''
  return ns ? `${displayNamespace(ns)}/${name}` : name
}

// ── Props ─────────────────────────────────────────────────────────────────

interface InstanceYamlDiffProps {
  a: K8sObject
  b: K8sObject
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * InstanceYamlDiff — side-by-side YAML diff between two instance snapshots.
 *
 * Each column shows the full cleaned YAML of the instance (managedFields,
 * resourceVersion, uid, last-applied-configuration stripped).
 * Lines present only in A are highlighted in red (removed).
 * Lines present only in B are highlighted in green (added).
 * Identical lines have no background change.
 *
 * O1–O8 from spec issue-537.
 */
export default function InstanceYamlDiff({ a, b, onClose }: InstanceYamlDiffProps) {
  const labelA = instanceLabel(a)
  const labelB = instanceLabel(b)

  const yamlA = useMemo(() => toYaml(cleanK8sObject(a)), [a])
  const yamlB = useMemo(() => toYaml(cleanK8sObject(b)), [b])
  const rows = useMemo(() => computeLineDiff(yamlA, yamlB), [yamlA, yamlB])
  const changedCount = useMemo(() => countChangedLines(rows), [rows])

  return (
    <div className="instance-yaml-diff" data-testid="instance-yaml-diff">
      {/* Header */}
      <div className="instance-yaml-diff__header">
        <span className="instance-yaml-diff__title">
          Full YAML diff —{' '}
          <span
            className={changedCount > 0
              ? 'instance-yaml-diff__count--diff'
              : 'instance-yaml-diff__count--same'}
          >
            {changedCount === 0
              ? 'YAML is identical'
              : `${changedCount} line${changedCount === 1 ? '' : 's'} differ`}
          </span>
        </span>
        <button
          type="button"
          className="instance-yaml-diff__close"
          onClick={onClose}
          aria-label="Close full YAML diff"
        >
          Close
        </button>
      </div>

      {/* Legend */}
      <div className="instance-yaml-diff__legend" aria-label="Diff legend">
        <span className="instance-yaml-diff__legend-item instance-yaml-diff__legend-item--removed">
          Only in {labelA}
        </span>
        <span className="instance-yaml-diff__legend-item instance-yaml-diff__legend-item--added">
          Only in {labelB}
        </span>
        <span className="instance-yaml-diff__legend-item instance-yaml-diff__legend-item--same">
          Identical
        </span>
      </div>

      {/* Side-by-side columns */}
      <div className="instance-yaml-diff__cols" data-testid="yaml-diff-cols">
        {/* Column A */}
        <div className="instance-yaml-diff__col">
          <div className="instance-yaml-diff__col-header" title={labelA}>
            {labelA}
          </div>
          <div className="instance-yaml-diff__col-body" data-testid="yaml-diff-col-a">
            <table className="yaml-diff-table" aria-label={`YAML for ${labelA}`}>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`yaml-diff-table__row yaml-diff-table__row--${row.status === 'added' ? 'empty' : row.status}`}
                    data-testid={row.status !== 'added' ? `diff-a-${row.status}` : 'diff-a-empty'}
                  >
                    <td className="yaml-diff-table__gutter">
                      {row.aIndex !== null ? row.aIndex : ''}
                    </td>
                    <td className="yaml-diff-table__code">
                      {row.aLine !== null ? (
                        <code>{row.aLine}</code>
                      ) : (
                        <span className="yaml-diff-table__absent" aria-hidden="true" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column B */}
        <div className="instance-yaml-diff__col">
          <div className="instance-yaml-diff__col-header" title={labelB}>
            {labelB}
          </div>
          <div className="instance-yaml-diff__col-body" data-testid="yaml-diff-col-b">
            <table className="yaml-diff-table" aria-label={`YAML for ${labelB}`}>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`yaml-diff-table__row yaml-diff-table__row--${row.status === 'removed' ? 'empty' : row.status}`}
                    data-testid={row.status !== 'removed' ? `diff-b-${row.status}` : 'diff-b-empty'}
                  >
                    <td className="yaml-diff-table__gutter">
                      {row.bIndex !== null ? row.bIndex : ''}
                    </td>
                    <td className="yaml-diff-table__code">
                      {row.bLine !== null ? (
                        <code>{row.bLine}</code>
                      ) : (
                        <span className="yaml-diff-table__absent" aria-hidden="true" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
