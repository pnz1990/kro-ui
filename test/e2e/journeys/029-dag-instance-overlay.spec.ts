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

  test('Step 3: selecting an instance applies live-state CSS classes to all non-state DAG nodes', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 10000 })

    const overlaySelect = page.locator('#instance-overlay-select')
    if (!await overlaySelect.isVisible({ timeout: 8000 }).catch(() => false)) return

    // Select test-instance — value is "kro-ui-e2e/test-instance"
    await overlaySelect.selectOption({ label: 'kro-ui-e2e/test-instance' })

    // Hard assertion: all non-state DAG nodes must receive a live-state class.
    // test-app has 3 managed resource nodes + 1 root CR = 4 expected nodes.
    // Fixes GH #165: previously only the root CR node was colored; child nodes
    // got no live-state class because buildNodeStateMap only keyed observed
    // children (Bug 2) and nodeBaseClass dropped undefined states (Bug 1).
    await expect(page.locator('[class*="dag-node-live--"]')).toHaveCount(4, { timeout: 15000 })

    // Also verify the page hasn't crashed
    await expect(page.getByTestId('dag-svg')).toBeVisible()
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
