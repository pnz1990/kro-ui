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

// conditions.test.ts — unit tests for isHealthyCondition and NEGATION_POLARITY_CONDITIONS.
//
// Spec: .specify/specs/028-instance-health-rollup/ US5 FR-011, FR-012
// Issue: https://github.com/pnz1990/kro-ui/issues/171

import { describe, it, expect } from 'vitest'
import { isHealthyCondition, NEGATION_POLARITY_CONDITIONS } from './conditions'

describe('NEGATION_POLARITY_CONDITIONS', () => {
  it('contains ReconciliationSuspended', () => {
    expect(NEGATION_POLARITY_CONDITIONS.has('ReconciliationSuspended')).toBe(true)
  })

  it('does not contain Ready (normal polarity)', () => {
    expect(NEGATION_POLARITY_CONDITIONS.has('Ready')).toBe(false)
  })
})

describe('isHealthyCondition', () => {
  // ── Normal (positive-polarity) conditions ──────────────────────────────

  it('returns true for a normal condition with status=True', () => {
    expect(isHealthyCondition('Ready', 'True')).toBe(true)
  })

  it('returns false for a normal condition with status=False', () => {
    expect(isHealthyCondition('Ready', 'False')).toBe(false)
  })

  it('returns false for a normal condition with status=Unknown', () => {
    expect(isHealthyCondition('Ready', 'Unknown')).toBe(false)
  })

  it('returns true for GraphVerified with status=True', () => {
    expect(isHealthyCondition('GraphVerified', 'True')).toBe(true)
  })

  it('returns false for GraphVerified with status=False', () => {
    expect(isHealthyCondition('GraphVerified', 'False')).toBe(false)
  })

  // ── Negation-polarity conditions ───────────────────────────────────────
  // ReconciliationSuspended: False = healthy (controller is running normally)
  //                          True  = unhealthy (reconciliation is suspended)

  it('returns true for ReconciliationSuspended with status=False (healthy — controller running)', () => {
    expect(isHealthyCondition('ReconciliationSuspended', 'False')).toBe(true)
  })

  it('returns false for ReconciliationSuspended with status=True (unhealthy — reconciliation is suspended)', () => {
    expect(isHealthyCondition('ReconciliationSuspended', 'True')).toBe(false)
  })

  it('returns false for ReconciliationSuspended with status=Unknown', () => {
    expect(isHealthyCondition('ReconciliationSuspended', 'Unknown')).toBe(false)
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  it('returns false for an empty type string with status=True (unknown type treated as normal polarity)', () => {
    expect(isHealthyCondition('', 'True')).toBe(true)
  })

  it('returns false for an empty status string', () => {
    expect(isHealthyCondition('Ready', '')).toBe(false)
  })
})
