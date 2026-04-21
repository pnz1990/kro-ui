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

// diff.test.ts — unit tests for computeLineDiff and countChangedLines.
// Spec: .specify/specs/issue-537/spec.md § O7.

import { describe, it, expect } from 'vitest'
import { computeLineDiff, countChangedLines } from './diff'

describe('computeLineDiff', () => {
  it('returns empty array for two empty strings', () => {
    const rows = computeLineDiff('', '')
    // '' split on '\n' yields [''] — one empty line that matches
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('same')
    expect(rows[0].aLine).toBe('')
    expect(rows[0].bLine).toBe('')
  })

  it('marks all lines as same when inputs are identical', () => {
    const yaml = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: foo'
    const rows = computeLineDiff(yaml, yaml)
    expect(rows.every((r) => r.status === 'same')).toBe(true)
  })

  it('marks added lines when B has extra content', () => {
    const a = 'line1\nline2'
    const b = 'line1\nline2\nline3'
    const rows = computeLineDiff(a, b)
    const added = rows.filter((r) => r.status === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].bLine).toBe('line3')
    expect(added[0].aLine).toBeNull()
    expect(added[0].aIndex).toBeNull()
    expect(added[0].bIndex).toBe(3)
  })

  it('marks removed lines when A has extra content', () => {
    const a = 'line1\nline2\nline3'
    const b = 'line1\nline2'
    const rows = computeLineDiff(a, b)
    const removed = rows.filter((r) => r.status === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].aLine).toBe('line3')
    expect(removed[0].bLine).toBeNull()
    expect(removed[0].bIndex).toBeNull()
    expect(removed[0].aIndex).toBe(3)
  })

  it('handles a changed line (remove old + add new)', () => {
    const a = 'replicas: 3'
    const b = 'replicas: 1'
    const rows = computeLineDiff(a, b)
    // Two entirely different lines: 1 removed + 1 added
    expect(rows.filter((r) => r.status === 'removed')).toHaveLength(1)
    expect(rows.filter((r) => r.status === 'added')).toHaveLength(1)
  })

  it('correctly uses LCS to keep common lines as same', () => {
    const a = 'a\nb\nc\nd'
    const b = 'a\nX\nc\nd'
    const rows = computeLineDiff(a, b)
    const same = rows.filter((r) => r.status === 'same').map((r) => r.aLine)
    expect(same).toContain('a')
    expect(same).toContain('c')
    expect(same).toContain('d')
    const removed = rows.filter((r) => r.status === 'removed')
    expect(removed.map((r) => r.aLine)).toContain('b')
    const added = rows.filter((r) => r.status === 'added')
    expect(added.map((r) => r.bLine)).toContain('X')
  })

  it('assigns 1-based line numbers to same rows', () => {
    const yaml = 'line1\nline2\nline3'
    const rows = computeLineDiff(yaml, yaml)
    expect(rows[0].aIndex).toBe(1)
    expect(rows[0].bIndex).toBe(1)
    expect(rows[1].aIndex).toBe(2)
    expect(rows[2].aIndex).toBe(3)
  })

  it('assigns correct line numbers when lines are inserted in B', () => {
    const a = 'a\nb'
    const b = 'a\nINSERTED\nb'
    const rows = computeLineDiff(a, b)
    const inserted = rows.find((r) => r.status === 'added')
    expect(inserted?.bLine).toBe('INSERTED')
    expect(inserted?.bIndex).toBe(2)
    const sameRows = rows.filter((r) => r.status === 'same')
    const lastSame = sameRows[sameRows.length - 1]
    expect(lastSame?.aIndex).toBe(2)
    expect(lastSame?.bIndex).toBe(3)
  })

  it('handles completely different inputs', () => {
    const a = 'x\ny\nz'
    const b = 'a\nb\nc'
    const rows = computeLineDiff(a, b)
    expect(rows.every((r) => r.status !== 'same')).toBe(true)
  })

  it('handles typical YAML with matching keys', () => {
    const a = 'spec:\n  replicas: 3\n  image: nginx'
    const b = 'spec:\n  replicas: 1\n  image: nginx'
    const rows = computeLineDiff(a, b)
    const same = rows.filter((r) => r.status === 'same').map((r) => r.aLine)
    expect(same).toContain('spec:')
    expect(same).toContain('  image: nginx')
    const removed = rows.filter((r) => r.status === 'removed')
    expect(removed.map((r) => r.aLine)).toContain('  replicas: 3')
    const added = rows.filter((r) => r.status === 'added')
    expect(added.map((r) => r.bLine)).toContain('  replicas: 1')
  })
})

describe('countChangedLines', () => {
  it('returns 0 for identical inputs', () => {
    const yaml = 'a: 1\nb: 2'
    expect(countChangedLines(computeLineDiff(yaml, yaml))).toBe(0)
  })

  it('counts added + removed lines', () => {
    const a = 'a\nb\nc'
    const b = 'a\nX\nY\nc'
    const count = countChangedLines(computeLineDiff(a, b))
    // b removed, X and Y added = 3 changed lines
    expect(count).toBe(3)
  })
})
