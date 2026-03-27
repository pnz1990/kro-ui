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

// collection.test.ts — unit tests for isItemReady.
//
// Critical correctness tests: ConfigMap/Secret have no status → should be
// healthy (step 5). Failed phase, Ready=False → unhealthy. Actively healthy
// states → healthy.

import { describe, it, expect } from 'vitest'
import { isItemReady } from './collection'
import type { K8sObject } from './api'

function makeItem(status: unknown): K8sObject {
  return { metadata: { name: 'item', namespace: 'ns' }, status }
}

describe('isItemReady', () => {
  // ── Step 5: stateless resources with no/empty status → healthy ────────────

  it('returns true for ConfigMap with no status (no conditions, no phase)', () => {
    expect(isItemReady(makeItem(undefined))).toBe(true)
  })

  it('returns true for item with null status', () => {
    expect(isItemReady(makeItem(null))).toBe(true)
  })

  it('returns true for item with empty status object {}', () => {
    expect(isItemReady(makeItem({}))).toBe(true)
  })

  it('returns true for item with status but no recognized health fields', () => {
    expect(isItemReady(makeItem({ someField: 'value' }))).toBe(true)
  })

  // ── Step 1: actively failed phase → unhealthy ─────────────────────────────

  it('returns false for Pod with phase=Failed', () => {
    expect(isItemReady(makeItem({ phase: 'Failed' }))).toBe(false)
  })

  it('returns false for phase=Error', () => {
    expect(isItemReady(makeItem({ phase: 'Error' }))).toBe(false)
  })

  it('returns false for phase=CrashLoopBackOff', () => {
    expect(isItemReady(makeItem({ phase: 'CrashLoopBackOff' }))).toBe(false)
  })

  it('returns false for phase=Terminating', () => {
    expect(isItemReady(makeItem({ phase: 'Terminating' }))).toBe(false)
  })

  it('returns false for phase=Pending (not yet scheduled/running)', () => {
    expect(isItemReady(makeItem({ phase: 'Pending' }))).toBe(false)
  })

  // ── Step 2: successful phase → healthy ────────────────────────────────────

  it('returns true for Pod with phase=Running', () => {
    expect(isItemReady(makeItem({ phase: 'Running' }))).toBe(true)
  })

  it('returns true for phase=Active', () => {
    expect(isItemReady(makeItem({ phase: 'Active' }))).toBe(true)
  })

  it('returns true for phase=Succeeded', () => {
    expect(isItemReady(makeItem({ phase: 'Succeeded' }))).toBe(true)
  })

  it('returns true for PVC with phase=Bound', () => {
    expect(isItemReady(makeItem({ phase: 'Bound' }))).toBe(true)
  })

  // ── Step 3: Ready=False or Available=False → unhealthy ───────────────────

  it('returns false when Ready=False', () => {
    expect(isItemReady(makeItem({
      conditions: [{ type: 'Ready', status: 'False' }],
    }))).toBe(false)
  })

  it('returns false when Available=False', () => {
    expect(isItemReady(makeItem({
      conditions: [{ type: 'Available', status: 'False' }],
    }))).toBe(false)
  })

  // ── Step 4: Ready=True or Available=True → healthy ───────────────────────

  it('returns true when Ready=True', () => {
    expect(isItemReady(makeItem({
      conditions: [{ type: 'Ready', status: 'True' }],
    }))).toBe(true)
  })

  it('returns true when Available=True', () => {
    expect(isItemReady(makeItem({
      conditions: [{ type: 'Available', status: 'True' }],
    }))).toBe(true)
  })

  // ── Step 5: conditions present but none are Ready/Available → healthy ─────

  it('returns true for item with only non-Ready conditions (ConfigMap edge case)', () => {
    // ConfigMap might have some vendor-added conditions that aren't Ready/Available
    expect(isItemReady(makeItem({
      conditions: [{ type: 'CustomCondition', status: 'True' }],
    }))).toBe(true)
  })

  // ── False wins over True when both present ────────────────────────────────

  it('returns false when Ready=False even if other condition is True', () => {
    expect(isItemReady(makeItem({
      conditions: [
        { type: 'Progressing', status: 'True' },
        { type: 'Ready', status: 'False' },
      ],
    }))).toBe(false)
  })

  // ── Real-world: 9 ConfigMaps in a cartesian forEach should all be healthy ──

  it('9 ConfigMaps with no status all return true (cartesian forEach)', () => {
    const items = Array.from({ length: 9 }, () =>
      makeItem(null) as K8sObject & { metadata: { name: string } }
    )
    const healthyCount = items.filter(isItemReady).length
    expect(healthyCount).toBe(9)
  })
})
