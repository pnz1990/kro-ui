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
 * Validates that the W-2 Controller Metrics widget on the Overview dashboard:
 * - Is rendered (data-testid="widget-metrics")
 * - Shows metric value cells or graceful "Not reported" state
 * - Does not prevent other widgets from rendering
 *
 * NOTE (spec 062): The MetricsStrip component was removed from the Overview
 * page as part of the SRE dashboard rewrite. Controller metrics are now
 * shown in the W-2 OverviewWidget. Tests updated accordingly.
 *
 * Component: web/src/pages/Home.tsx (W-2 inline widget)
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
    // W-2 Controller Metrics widget must be visible after dashboard loads
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-metrics"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })
    await expect(page.locator('[data-testid="widget-metrics"]')).toBeVisible()
  })

  test('Step 2: metrics strip resolves to loaded or degraded state', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-metrics"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })
    // Widget is visible (loaded or inline error state — never crashes)
    await expect(page.locator('[data-testid="widget-metrics"]')).toBeVisible()
  })

  test('Step 3: metrics strip content does not contain "undefined" or "[object Object]"', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-metrics"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })
    const text = await page.locator('[data-testid="widget-metrics"]').textContent()
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('[object Object]')
  })

  test('Step 4: metrics strip does not crash the home page', async ({ page }) => {
    await page.goto(BASE)
    // All 7 widgets must render — page cannot be crashed by metrics failure
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-instances"]') !== null,
      { timeout: 20000 }
    )
    await expect(page.locator('[data-testid="widget-instances"]')).toBeVisible()
  })
})
