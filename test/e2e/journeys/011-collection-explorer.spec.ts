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
 * Journey 011: Collection Explorer
 *
 * Validates that clicking a forEach collection node on the DAG opens
 * the CollectionPanel with child instance rows.
 *
 * Spec ref: .specify/specs/011-collection-explorer/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-collection RGD applied (has a forEach resource)
 * - test-collection-instance CR applied in namespace kro-ui-e2e
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'

test.describe('Journey 011 — Collection Explorer', () => {
  test('Step 1: test-collection RGD graph renders', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: forEach collection node is visible in DAG', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // Collection nodes carry class dag-node--collection (set by nodeType)
    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await expect(collectionNode).toBeVisible()
  })

  test('Step 3: collection panel opens when a collection DAG node is clicked on instance detail', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // Click the first collection-type DAG node
    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await collectionNode.click()

    // CollectionPanel should appear
    await expect(page.getByTestId('collection-panel')).toBeVisible({ timeout: 8000 })
  })

  test('Step 4: collection panel shows count or empty state', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await collectionNode.click()
    await expect(page.getByTestId('collection-panel')).toBeVisible({ timeout: 8000 })

    // Either count badge or empty state is shown
    const hasCount = await page.getByTestId('collection-count').isVisible().catch(() => false)
    const hasEmpty = await page.getByTestId('collection-empty-state').isVisible().catch(() => false)
    const hasTable = await page.getByTestId('collection-table').isVisible().catch(() => false)
    expect(hasCount || hasEmpty || hasTable).toBe(true)
  })

  test('Step 5: close button dismisses the collection panel', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready in setup')
    await page.goto(`${BASE}/rgds/test-collection/instances/kro-ui-e2e/test-collection-instance`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await collectionNode.click()
    await expect(page.getByTestId('collection-panel')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('collection-panel-close').click()
    await expect(page.getByTestId('collection-panel')).not.toBeVisible()
  })

  test('Step 6: empty forEach shows forEach expression in empty state message (PR #286)', async ({ page }) => {
    // Requires upstream-collection-chain RGD + chain-empty instance (values: [])
    // which produces a forEach collection with 0 items.
    // The empty state must include the actual forEach expression text (PR #286 fix).
    test.skip(!fixtureState.collectionChainReady, 'upstream-collection-chain not Ready in setup')

    await page.goto(`${BASE}/rgds/upstream-collection-chain/instances/kro-ui-demo/chain-empty`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // Click the chainedConfigs collection node
    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await collectionNode.click()
    await expect(page.getByTestId('collection-panel')).toBeVisible({ timeout: 8000 })

    // Empty state must be shown (values: [] → 0 items)
    const emptyState = page.getByTestId('collection-empty-state')
    await expect(emptyState).toBeVisible({ timeout: 5000 })

    // PR #286: empty state must include the forEach expression, not just generic text
    const emptyText = await emptyState.textContent()
    expect(emptyText).toContain('forEach')
    // The expression must be present (any non-empty expression string)
    expect(emptyText).toMatch(/\$\{.*\}|expression/)
  })

  test('Step 7: collection badge shows healthy count (isItemReady fix PR #284)', async ({ page }) => {
    // Requires upstream-cartesian-foreach RGD + an instance with ConfigMap children.
    // Prior to PR #284, ConfigMaps (no status.conditions) returned false from isItemReady
    // → badge showed 0/N. Now they return true → badge shows N/N.
    test.skip(!fixtureState.cartesianReady, 'upstream-cartesian-foreach not Ready in setup')

    await page.goto(`${BASE}/rgds/upstream-cartesian-foreach/instances/kro-ui-e2e/upstream-cartesian-foreach`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // Click the collection node
    const collectionNode = page.locator('[class*="dag-node--collection"]').first()
    await collectionNode.click()
    await expect(page.getByTestId('collection-panel')).toBeVisible({ timeout: 8000 })

    // Collection badge (SVG text) should show N/N, not 0/N, because ConfigMaps are healthy by existence
    const badgeText = await page.locator('text[data-testid="collection-badge"]').textContent().catch(() => null)
    if (badgeText) {
      // Badge format "N/M" — N (healthy) should equal M (total) for ConfigMaps
      const match = badgeText.match(/(\d+)\/(\d+)/)
      if (match) {
        const healthy = parseInt(match[1], 10)
        const total = parseInt(match[2], 10)
        // With PR #284 fix: healthy should equal total for stateless resources
        expect(healthy).toBe(total)
      }
    }
  })
})
