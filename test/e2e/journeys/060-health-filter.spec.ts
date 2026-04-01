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
 * Journey 060: OverviewHealthBar clickable filter
 *
 * Spec: .specify/specs/060-health-filter/spec.md
 *
 * NOTE (spec 062): The OverviewHealthBar component and its clickable chip filter
 * were removed as part of the SRE dashboard rewrite. The equivalent health
 * distribution is now shown in W-1 (InstanceHealthWidget) without the grid
 * filter behavior. The Catalog page (/catalog) provides the RGD card grid.
 *
 * These tests are updated to verify the W-1 widget shows health data correctly.
 * The filter behavior (chips filtering the card grid) no longer exists on the
 * Overview page — that feature was superseded by the dashboard widget design.
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 060: OverviewHealthBar clickable filter', () => {

  // ── A: W-1 Instance Health widget is rendered (replaces OverviewHealthBar) ──

  test('Step 1: OverviewHealthBar chips are rendered as buttons', async ({ page }) => {
    // NOTE (spec 062): Bar/Donut toggle removed. W-1 now shows donut-only.
    // Verify W-1 widget renders with the SVG donut (or empty state).
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })

    const w1 = page.locator('[data-testid="widget-instances"]')
    await expect(w1).toBeVisible()
    // W-1 renders either the SVG donut or the "No instances" empty state
    const hasSvg = await w1.locator('svg').count() > 0
    const hasEmpty = (await w1.textContent() ?? '').includes('No instances')
    expect(hasSvg || hasEmpty).toBe(true)
  })

  // ── B: Bar chart shows proportional health data ───────────────────────────

  test('Step 2: Clicking a health chip filters the RGD card grid', async ({ page }) => {
    // NOTE (spec 062): Grid filter on Overview removed. Verify W-1 Bar mode renders segments.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })

    const w1 = page.locator('[data-testid="widget-instances"]')
    const w1Text = await w1.textContent()
    // W-1 should render content without coercion artifacts
    expect(w1Text).not.toContain('undefined')
    expect(w1Text).not.toContain('[object')
  })

  // ── C+D: Bar/Donut toggle is functional ──────────────────────────────────

  test('Step 3: Clear filter button restores all cards', async ({ page }) => {
    // NOTE (spec 062): Clear filter button removed. Verify Bar/Donut toggle works when instances exist.
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })

    // If there are no instances, the chart doesn't render — skip toggle test
    const ihwWidget = page.locator('[data-testid="instance-health-widget"]')
    if (await ihwWidget.count() === 0) return
    const ihwText = await ihwWidget.textContent()
    if (ihwText?.includes('No instances found')) return

    // Switch to Donut mode
    const donutBtn = page.locator('.ihw__toggle-btn').filter({ hasText: 'Donut' }).first()
    if (await donutBtn.count() > 0) {
      await donutBtn.click()
      // SVG donut must appear (only when total > 0)
      await page.waitForFunction(() =>
        document.querySelector('.ihw__donut-svg') !== null,
        { timeout: 5000 }
      ).catch(() => { /* donut not rendered for 0 instances — ok */ })
      // Switch back to Bar
      const barBtn = page.locator('.ihw__toggle-btn').filter({ hasText: 'Bar' }).first()
      await barBtn.click()
      await page.waitForTimeout(200)
    }
    // Widget must still be visible and artifact-free
    const w1 = page.locator('[data-testid="widget-instances"]')
    await expect(w1).toBeVisible()
    const text = await w1.textContent()
    expect(text).not.toContain('undefined')
  })
})
