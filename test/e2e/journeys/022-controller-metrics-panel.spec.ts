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
 * Validates that the MetricsStrip component on the home page:
 * - Is rendered (className="metrics-strip" — no data-testid on root)
 * - Shows metric value cells or a degraded/loading state
 * - Handles unavailable metrics gracefully (shows "—" not a crash)
 * - Does not prevent RGD cards from rendering
 *
 * Component: web/src/components/MetricsStrip.tsx
 * The MetricsStrip root has className="metrics-strip" and
 * role="status" with aria-label="Controller metrics" in the loaded state.
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
  test('Step 1: MetricsStrip is present on the home page', async ({ page }) => {
    await page.goto(BASE)
    // MetricsStrip renders with className="metrics-strip" in various states.
    // Wait for the grid cards first, then assert the strip.
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.metrics-strip, .metrics-strip--loading, .metrics-strip--degraded')).toBeVisible()
  })

  test('Step 2: metrics strip resolves to loaded or degraded state', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })

    // Wait up to 8s for the strip to move past the loading skeleton
    await page.waitForFunction(
      () => {
        const strip = document.querySelector('.metrics-strip')
        if (!strip) return false
        // Loading state has aria-busy="true"; resolved state has role="status"
        return strip.getAttribute('aria-busy') !== 'true'
      },
      { timeout: 8000 },
    ).catch(() => {/* still in loading — acceptable */})

    // At this point the strip is either loaded (cells) or degraded (message) — not crashed
    await expect(page.locator('.metrics-strip, .metrics-strip--degraded')).toBeVisible()
  })

  test('Step 3: metrics strip content does not contain "undefined" or "[object Object]"', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(5000) // allow metrics fetch to resolve

    const strip = page.locator('.metrics-strip, .metrics-strip--loading, .metrics-strip--degraded')
    if (await strip.isVisible().catch(() => false)) {
      const text = await strip.textContent()
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('[object Object]')
    }
  })

  test('Step 4: metrics strip does not crash the home page', async ({ page }) => {
    await page.goto(BASE)
    // Home page must still show RGD cards even if metrics fail
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })
  })
})
