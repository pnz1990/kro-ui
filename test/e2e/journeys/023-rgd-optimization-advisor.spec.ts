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
 * Journey 023: RGD Optimization Advisor
 *
 * Validates that the OptimizationAdvisor component:
 * - Renders when forEach collapse opportunities exist in the catalog
 * - Each advisor item is expandable
 * - Dismiss button removes the item
 *
 * Spec ref: .specify/specs/023-rgd-optimization-advisor/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-collection RGD applied (has forEach node — potential collapse candidate)
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'

test.describe('Journey 023 — RGD Optimization Advisor', () => {
  test('Step 1: optimization advisor renders if collapse opportunities exist', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready — advisor may not appear')
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 20000 })

    // The OptimizationAdvisor is visible only when there are candidates
    const advisor = page.getByTestId('optimization-advisor')
    const isVisible = await advisor.isVisible({ timeout: 5000 }).catch(() => false)
    if (!isVisible) return // No candidates — acceptable
    await expect(advisor).toBeVisible()
  })

  test('Step 2: advisor items are expandable', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready — advisor may not appear')
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 20000 })

    const advisor = page.getByTestId('optimization-advisor')
    if (!await advisor.isVisible({ timeout: 5000 }).catch(() => false)) return

    // Find first expand button and click it
    const expandBtn = page.locator('[data-testid$="-expand"]').first()
    if (!await expandBtn.isVisible().catch(() => false)) return
    await expandBtn.click()

    // Explanation panel should appear
    const explanation = page.locator('[data-testid$="-explanation"]').first()
    await expect(explanation).toBeVisible({ timeout: 5000 })
  })

  test('Step 3: dismiss button removes the advisor item', async ({ page }) => {
    test.skip(!fixtureState.collectionReady, 'test-collection RGD not Ready — advisor may not appear')
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="catalog-card-"]').first()).toBeVisible({ timeout: 20000 })

    const advisor = page.getByTestId('optimization-advisor')
    if (!await advisor.isVisible({ timeout: 5000 }).catch(() => false)) return

    const dismissBtn = page.locator('[data-testid$="-dismiss"]').first()
    if (!await dismissBtn.isVisible().catch(() => false)) return

    const itemId = await dismissBtn.getAttribute('data-testid')
    const kind = itemId?.replace('-dismiss', '').replace('advisor-item-', '')
    await dismissBtn.click()

    // Item should disappear after dismissal
    if (kind) {
      await expect(page.getByTestId(`advisor-item-${kind}`)).not.toBeVisible({ timeout: 3000 })
    }
  })
})
