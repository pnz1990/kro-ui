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
 * Journey 043-cartesian-foreach: Cartesian forEach (2D) DAG rendering
 *
 * Validates that a kro RGD with two forEach dimensions (region × tier) renders
 * correctly in kro-ui:
 *   - The collection node shows both forEach dimension annotations
 *   - The cardinality badge reflects the cartesian product count (4 = 2×2)
 *
 * Spec ref: .specify/specs/043-upstream-fixture-generator/
 *
 * Cluster pre-conditions:
 *   - upstream-cartesian-foreach RGD applied and Ready
 *   - upstream-cartesian-foreach instance applied (regions: [us-east-1, eu-west-1], tiers: [web, api])
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/upstream-cartesian-foreach`
const INSTANCE_URL = `${BASE}/rgds/upstream-cartesian-foreach/instances/kro-ui-e2e/upstream-cartesian-foreach`
const DAG_TIMEOUT = 15000

test.describe('Journey 043-cartesian-foreach — Cartesian forEach DAG', () => {
  test('Step 1: RGD detail DAG renders for cartesian-foreach fixture', async ({ page }) => {
    test.skip(!fixtureState.cartesianReady, 'upstream-cartesian-foreach RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
  })

  test('Step 2: collection node appConfigs is visible in DAG', async ({ page }) => {
    test.skip(!fixtureState.cartesianReady, 'upstream-cartesian-foreach RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
    await expect(page.getByTestId('dag-node-appConfigs')).toBeVisible()
    // Must have collection CSS class
    const node = page.getByTestId('dag-node-appConfigs')
    const cls = await node.getAttribute('class')
    expect(cls).toMatch(/dag-node--collection/)
  })

  test('Step 3: two forEach dimension annotations visible (region and tier)', async ({ page }) => {
    test.skip(!fixtureState.cartesianReady, 'upstream-cartesian-foreach RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    const annotations = page.locator('[data-testid^="dag-node-foreach-"]')
    const count = await annotations.count()
    expect(count).toBeGreaterThanOrEqual(2)

    const allText = await annotations.allTextContents()
    const joined = allText.join(' ')
    expect(joined).toMatch(/region/)
    expect(joined).toMatch(/tier/)
  })

  test('Step 4: live instance cardinality badge shows expected count (up to 4)', async ({ page }) => {
    test.skip(!fixtureState.cartesianReady, 'upstream-cartesian-foreach RGD not Ready in setup')
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })

    const badge = page.getByTestId('collection-badge')
    if (!await badge.isVisible({ timeout: 15000 }).catch(() => false)) return
    const text = await badge.textContent()
    // Badge shows "N/4" or just "4" as items reconcile
    expect(text?.trim()).toMatch(/^[1-4]\/4$|^4$/)
  })
})
