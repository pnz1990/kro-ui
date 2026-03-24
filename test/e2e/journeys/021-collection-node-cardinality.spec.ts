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
 * Journey 021: Collection Node Cardinality
 *
 * Validates that forEach collection nodes in the DAG display:
 * - A cardinality badge (collection-badge) showing child instance count
 * - The forEach expression annotation below the node label
 *
 * Spec ref: .specify/specs/021-collection-node-cardinality/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-collection RGD applied (has forEach resource)
 * - test-collection-instance applied
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'

test.describe('Journey 021 — Collection Node Cardinality', () => {
  test('Step 1: forEach annotation is shown on collection node in static DAG', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // There should be at least one forEach annotation rendered
    const forEachAnnotations = page.locator('[data-testid^="dag-node-foreach-"]')
    const count = await forEachAnnotations.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 2: forEach annotation text is non-empty and not "?"', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    const annotation = page.locator('[data-testid^="dag-node-foreach-"]').first()
    const text = await annotation.textContent()
    expect(text?.trim()).toBeTruthy()
    expect(text?.trim()).not.toBe('?')
  })

  test('Step 3: cardinality badge appears on collection node in live DAG', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // CollectionBadge renders [data-testid="collection-badge"] on live collection nodes
    const badge = page.getByTestId('collection-badge')
    await expect(badge).toBeVisible({ timeout: 8000 })
  })

  test('Step 4: cardinality badge text is a valid count or dash', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    const badge = page.getByTestId('collection-badge')
    if (await badge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const badgeText = await badge.textContent()
      // Should be a number or dash (e.g. "3", "0", "—")
      expect(badgeText?.trim()).toMatch(/^\d+|—$/)
    }
  })
})
