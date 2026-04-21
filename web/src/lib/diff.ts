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

/**
 * diff.ts — pure line-level diff utility (no external dependencies).
 *
 * Computes a side-by-side diff between two YAML strings using a simple
 * LCS (longest-common-subsequence) algorithm.  Returns a list of
 * LinePairRow entries — one entry per "visual row" in the diff view.
 *
 * Used by InstanceYamlDiff for instance snapshot comparison (spec issue-537).
 */

export type LineStatus = 'same' | 'added' | 'removed'

/**
 * One row in the side-by-side diff output.
 *
 * `aLine` is the left column (instance A).  `bLine` is the right column (instance B).
 * When `status === 'same'` both sides hold the same text.
 * When `status === 'removed'` the line exists only in A (bLine is null).
 * When `status === 'added'` the line exists only in B (aLine is null).
 */
export interface LinePairRow {
  status: LineStatus
  aLine: string | null
  bLine: string | null
  aIndex: number | null  // 1-based line number in A, null when absent
  bIndex: number | null  // 1-based line number in B, null when absent
}

// ── LCS implementation ────────────────────────────────────────────────────

/**
 * Compute the LCS table for two string arrays.
 * Returns the dp table (length (n+1) × (m+1)).
 * Space: O(n*m).  For typical YAML blobs (<2000 lines) this is fast enough.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length
  const m = b.length
  // Allocate with typed arrays for speed
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

/**
 * Back-track through the LCS table to produce the diff sequence.
 * Returns an array of `{ op: 'same' | 'removed' | 'added', line: string }`.
 */
function backtrack(
  dp: number[][],
  a: string[],
  b: string[],
  i: number,
  j: number,
  result: Array<{ op: LineStatus; line: string }>,
): void {
  // Iterative version to avoid stack overflow on large files
  const stack: Array<{ i: number; j: number }> = [{ i, j }]
  const ops: Array<{ op: LineStatus; line: string }> = []

  let ci = i
  let cj = j
  while (ci > 0 || cj > 0) {
    if (ci > 0 && cj > 0 && a[ci - 1] === b[cj - 1]) {
      ops.push({ op: 'same', line: a[ci - 1] })
      ci--
      cj--
    } else if (cj > 0 && (ci === 0 || dp[ci][cj - 1] >= dp[ci - 1][cj])) {
      ops.push({ op: 'added', line: b[cj - 1] })
      cj--
    } else {
      ops.push({ op: 'removed', line: a[ci - 1] })
      ci--
    }
  }

  // ops is in reverse order — push in reverse
  for (let k = ops.length - 1; k >= 0; k--) {
    result.push(ops[k])
  }
  void stack // suppress unused warning
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Compute a side-by-side line diff between two YAML strings.
 *
 * Both inputs are split on `\n`.  The LCS algorithm finds the longest
 * matching subsequence; non-matching lines are marked `removed` (A only)
 * or `added` (B only).
 *
 * Returns an array of LinePairRow, one per visual row in the diff view.
 * Removed lines appear on the left (aLine set, bLine null).
 * Added lines appear on the right (aLine null, bLine set).
 */
export function computeLineDiff(yamlA: string, yamlB: string): LinePairRow[] {
  const aLines = yamlA.split('\n')
  const bLines = yamlB.split('\n')

  // Cap at 3000 lines per side to keep the diff responsive
  const a = aLines.slice(0, 3000)
  const b = bLines.slice(0, 3000)

  const dp = lcsTable(a, b)
  const ops: Array<{ op: LineStatus; line: string }> = []
  backtrack(dp, a, b, a.length, b.length, ops)

  const rows: LinePairRow[] = []
  let aIdx = 1
  let bIdx = 1

  for (const { op, line } of ops) {
    if (op === 'same') {
      rows.push({ status: 'same', aLine: line, bLine: line, aIndex: aIdx++, bIndex: bIdx++ })
    } else if (op === 'removed') {
      rows.push({ status: 'removed', aLine: line, bLine: null, aIndex: aIdx++, bIndex: null })
    } else {
      rows.push({ status: 'added', aLine: null, bLine: line, aIndex: null, bIndex: bIdx++ })
    }
  }

  return rows
}

/**
 * Count the number of changed lines (added + removed) in a diff result.
 * Useful for summary badges.
 */
export function countChangedLines(rows: LinePairRow[]): number {
  return rows.filter((r) => r.status !== 'same').length
}
