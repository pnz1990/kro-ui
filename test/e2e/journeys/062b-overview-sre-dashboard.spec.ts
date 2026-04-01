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
 * Journey 062b: Overview SRE Dashboard
 *
 * Spec: .specify/specs/062-overview-sre-dashboard/spec.md
 * GH Issue: #397
 *
 * Verifies:
 *   A) Overview page loads with 7 widgets visible
 *   B) W-1 Instance Health widget renders (with or without instances)
 *   C) W-2 Controller Metrics widget renders
 *   D) Refresh button is present, functional, and shows loading state
 *   E) "Updated X ago" staleness label appears after load
 *   F) Layout toggle Grid/Bento switches layout class
 *   G) MetricsStrip is NOT rendered on the Overview page
 *   H) VirtualGrid of RGDCards is NOT rendered on the Overview page
 *
 * Constitution §XIV compliance:
 *   - API-first checks before UI navigation
 *   - waitForFunction instead of waitForTimeout
 *   - All testids use data-testid attributes
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('062b: Overview SRE Dashboard', () => {

  test('A — Overview page loads with all 7 widget containers', async ({ page }) => {
    // §XIV: Check API is reachable before navigating
    const check = await page.request.get(`${BASE}/api/v1/instances`)
    if (!check.ok()) {
      test.skip(true, 'instances API not reachable on this cluster')
      return
    }

    await page.goto(BASE)

    // Wait for the page to finish loading (at least one widget resolves out of skeleton)
    await page.waitForFunction(() => {
      const w1 = document.querySelector('[data-testid="widget-instances"]')
      return w1 !== null && !w1.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    // All 7 widget containers present
    await expect(page.getByTestId('widget-instances')).toBeVisible()
    await expect(page.getByTestId('widget-metrics')).toBeVisible()
    await expect(page.getByTestId('widget-rgd-errors')).toBeVisible()
    await expect(page.getByTestId('widget-reconciling')).toBeVisible()
    await expect(page.getByTestId('widget-top-erroring')).toBeVisible()
    await expect(page.getByTestId('widget-events')).toBeVisible()
    await expect(page.getByTestId('widget-activity')).toBeVisible()
  })

  test('B — W-1 Instance Health widget contains a count or empty state', async ({ page }) => {
    const check = await page.request.get(`${BASE}/api/v1/instances`)
    if (!check.ok()) {
      test.skip(true, 'instances API not reachable')
      return
    }

    await page.goto(BASE)

    await page.waitForFunction(() => {
      const widget = document.querySelector('[data-testid="instance-health-widget"]')
      return widget !== null
    }, { timeout: 25000 })

    const widget = page.getByTestId('instance-health-widget')
    await expect(widget).toBeVisible()
    // Should show either a number or the "No instances found" empty state
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="instance-health-widget"]')
      if (!el) return false
      const text = el.textContent ?? ''
      return /\d/.test(text) || text.includes('No instances found')
    }, { timeout: 20000 })
  })

  test('C — W-2 Controller Metrics widget is visible', async ({ page }) => {
    await page.goto(BASE)

    await page.waitForFunction(() => {
      const w2 = document.querySelector('[data-testid="widget-metrics"]')
      return w2 !== null && !w2.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    await expect(page.getByTestId('widget-metrics')).toBeVisible()
  })

  test('D — Refresh button is visible and disables during re-fetch', async ({ page }) => {
    const check = await page.request.get(`${BASE}/api/v1/instances`)
    if (!check.ok()) {
      test.skip(true, 'instances API not reachable')
      return
    }

    await page.goto(BASE)

    // Wait for page to finish initial load
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="overview-refresh"]')
      return btn !== null && !(btn as HTMLButtonElement).disabled
    }, { timeout: 25000 })

    const refreshBtn = page.getByTestId('overview-refresh')
    await expect(refreshBtn).toBeVisible()
    await expect(refreshBtn).not.toBeDisabled()

    // Click Refresh — button should immediately disable
    await refreshBtn.click()
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="overview-refresh"]') as HTMLButtonElement | null
      return btn !== null && btn.disabled
    }, { timeout: 5000 })

    // Wait for re-fetch to complete
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="overview-refresh"]') as HTMLButtonElement | null
      return btn !== null && !btn.disabled
    }, { timeout: 25000 })
  })

  test('E — staleness label shows "Updated" or "just now" after load', async ({ page }) => {
    const check = await page.request.get(`${BASE}/api/v1/instances`)
    if (!check.ok()) {
      test.skip(true, 'instances API not reachable')
      return
    }

    await page.goto(BASE)

    // Wait for staleness label to contain a timestamp
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="overview-staleness"]')
      if (!el) return false
      const text = el.textContent ?? ''
      return text.includes('Updated') || text.includes('just now')
    }, { timeout: 25000 })

    const staleness = page.getByTestId('overview-staleness')
    await expect(staleness).toBeVisible()
  })

  test('F — Bento layout toggle switches grid class', async ({ page }) => {
    // NOTE: Bento layout removed in redesign — grid-only now.
    // Verify the grid layout class is always present.
    await page.goto(BASE)

    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-instances"]') !== null,
      { timeout: 20000 }
    )

    await expect(page.locator('.home__grid')).toBeVisible()
    await expect(page.locator('.home__bento')).not.toBeVisible()
    // Layout toggle buttons are gone — verify they are absent
    await expect(page.locator('[data-testid="overview-layout-bento"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="overview-layout-grid"]')).not.toBeVisible()
  })

  test('G — MetricsStrip is NOT rendered on Overview', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-metrics"]') !== null,
      { timeout: 20000 }
    )
    // MetricsStrip renders .metrics-strip — must be absent from Overview
    await expect(page.locator('.metrics-strip')).not.toBeVisible()
  })

  test('H — VirtualGrid of RGDCards is NOT rendered on Overview', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-instances"]') !== null,
      { timeout: 20000 }
    )
    // Old RGD card grid rendered .rgd-card elements inside VirtualGrid
    await expect(page.locator('.rgd-card')).not.toBeVisible()
  })

})
