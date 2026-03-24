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
})
