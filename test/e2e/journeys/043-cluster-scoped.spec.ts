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
 * Journey 043-cluster-scoped: Cluster-scoped CR rendering
 *
 * Validates that a kro RGD with scope: Cluster renders correctly in kro-ui:
 *   - The RGD appears in the Overview/Catalog
 *   - The DAG renders normally
 *   - The instance list shows no namespace (or empty namespace) for cluster-scoped CRs
 *
 * Spec ref: .specify/specs/043-upstream-fixture-generator/
 *
 * Cluster pre-conditions:
 *   - upstream-cluster-scoped RGD applied and Ready
 *   - No instance applied (cluster-scoped — tested via instance list empty state)
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/upstream-cluster-scoped`
const DAG_TIMEOUT = 15000

test.describe('Journey 043-cluster-scoped — Cluster-scoped CR rendering', () => {
  test('Step 1: upstream-cluster-scoped RGD appears on Overview or Catalog', async ({ page }) => {
    test.skip(!fixtureState.clusterScopedReady, 'upstream-cluster-scoped RGD not Ready in setup')
    // Try overview first, fall back to catalog
    await page.goto(`${BASE}/`)
    const card = page.locator('[data-testid="rgd-card-upstream-cluster-scoped"], [data-testid="catalog-card-upstream-cluster-scoped"]')
    if (!await card.isVisible({ timeout: 8000 }).catch(() => false)) {
      await page.goto(`${BASE}/catalog`)
      const catalogCard = page.locator('[data-testid="catalog-card-upstream-cluster-scoped"]')
      await expect(catalogCard).toBeVisible({ timeout: 10000 })
    } else {
      await expect(card).toBeVisible()
    }
  })

  test('Step 2: RGD detail DAG renders for cluster-scoped fixture', async ({ page }) => {
    test.skip(!fixtureState.clusterScopedReady, 'upstream-cluster-scoped RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    // Root node should be visible
    await expect(page.getByTestId('dag-node-schema')).toBeVisible()
  })

  test('Step 3: instance list shows no-namespace state for cluster-scoped RGD', async ({ page }) => {
    test.skip(!fixtureState.clusterScopedReady, 'upstream-cluster-scoped RGD not Ready in setup')
    await page.goto(`${RGD_URL}?tab=instances`)
    // Either empty state (no instances applied) or rows with empty namespace
    const emptyState = page.locator('[data-testid="instance-list-empty"], .instance-list__empty, [data-testid*="empty"]')
    const hasEmpty = await emptyState.isVisible({ timeout: 8000 }).catch(() => false)
    if (hasEmpty) {
      // Empty state is valid — no instances deployed
      await expect(emptyState).toBeVisible()
      return
    }
    // If rows are present, namespace column should be empty or show dash
    const nsCell = page.locator('td[data-col="namespace"], .instance-row__namespace').first()
    if (await nsCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await nsCell.textContent()
      expect(text?.trim()).toMatch(/^$|^—$|^-$/)
    }
  })
})
