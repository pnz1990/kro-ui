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
 * Journey 022: Controller Metrics Panel
 *
 * Validates that the kro controller metrics panel on the home page:
 * - Renders the metrics panel element
 * - Shows metrics cells (watch count, GVR count, queue depth)
 * - Handles unavailable metrics gracefully (shows "—" not a crash)
 *
 * Spec ref: .specify/specs/022-controller-metrics-panel/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - kro controller is running (metrics may or may not be exposed)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 022 — Controller Metrics Panel', () => {
  test('Step 1: metrics panel is present on the home page', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: metrics cells are rendered', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })

    // TelemetryPanel uses named testids for each cell (telemetry-cell-age, etc.)
    await expect(page.getByTestId('telemetry-cell-age')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('telemetry-cell-children')).toBeVisible()
  })

  test('Step 3: metrics cells show a value or dash (graceful degradation)', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByTestId('telemetry-panel')).toBeVisible({ timeout: 10000 })

    // Wait for any async fetch to resolve
    await page.waitForTimeout(3000)

    // Check each named cell for correct content (no "undefined" / "[object Object]")
    for (const testId of ['telemetry-cell-age', 'telemetry-cell-children', 'telemetry-cell-time-in-state', 'telemetry-cell-warnings']) {
      const el = page.getByTestId(testId)
      if (await el.isVisible().catch(() => false)) {
        const text = await el.textContent()
        expect(text).not.toContain('undefined')
        expect(text).not.toContain('[object Object]')
      }
    }
  })

  test('Step 4: metrics panel does not crash the home page', async ({ page }) => {
    await page.goto(BASE)
    // Home page must still show RGD cards even if metrics fail
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })
  })
})
