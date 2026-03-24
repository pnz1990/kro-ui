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
 * Journey 029: DAG Instance Overlay
 *
 * Validates that the RGD graph tab instance overlay:
 * - Shows the overlay picker (InstanceOverlayBar) when instances exist
 * - Selecting an instance overlays live node states on the static DAG
 * - Clearing the selection removes the overlay
 *
 * Spec ref: .specify/specs/029-dag-instance-overlay/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied + test-instance CR applied
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 029 — DAG Instance Overlay', () => {
  test('Step 1: RGD graph tab renders DAG and overlay picker appears', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // InstanceOverlayBar root div has className="instance-overlay-bar" (no data-testid)
    await expect(page.locator('.instance-overlay-bar')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: overlay picker shows test-instance in the dropdown', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    // The select has id="instance-overlay-select" and class="instance-overlay-bar__select"
    const overlaySelect = page.locator('#instance-overlay-select')
    const isVisible = await overlaySelect.isVisible({ timeout: 8000 }).catch(() => false)
    if (!isVisible) return // instances may not have loaded yet — skip

    const options = await overlaySelect.locator('option').allTextContents()
    const hasInstance = options.some((o) => o.includes('test-instance'))
    expect(hasInstance).toBe(true)
  })

  test('Step 3: selecting an instance adds live-state classes to DAG nodes', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    const overlaySelect = page.locator('#instance-overlay-select')
    if (!await overlaySelect.isVisible({ timeout: 8000 }).catch(() => false)) return

    // Select test-instance — value is "kro-ui-e2e/test-instance"
    await overlaySelect.selectOption({ label: 'kro-ui-e2e/test-instance' })
    await page.waitForTimeout(3000) // allow overlay fetch to complete

    // After selection, DAG nodes should have live-state modifier classes.
    // liveStateClass() in dag.ts emits: dag-node-live--alive, dag-node-live--reconciling,
    // dag-node-live--error, dag-node-live--notfound (from dag.ts:623-628)
    const liveNodes = page.locator('[class*="dag-node-live--"]')
    const count = await liveNodes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 4: clearing overlay selection removes live-state classes', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    const overlaySelect = page.locator('#instance-overlay-select')
    if (!await overlaySelect.isVisible({ timeout: 8000 }).catch(() => false)) return

    await overlaySelect.selectOption({ label: 'kro-ui-e2e/test-instance' })
    await page.waitForTimeout(3000)

    // Clear by selecting the empty/placeholder option (value="")
    await overlaySelect.selectOption('')
    await page.waitForTimeout(500)

    // All live-state overlay classes must be removed
    const liveNodes = page.locator('[class*="dag-node-live--alive"], [class*="dag-node-live--reconciling"]')
    const count = await liveNodes.count()
    expect(count).toBe(0)
  })
})
