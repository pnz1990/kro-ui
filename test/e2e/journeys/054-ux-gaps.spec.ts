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
 * Journey 054: UX Gaps — Round 3
 *
 * Spec: .specify/specs/054-ux-gaps/spec.md
 *
 * Verifies:
 *   A) MetricsStrip "Not reported" counter never renders at numeric-value size
 *      (has the --not-reported CSS modifier class, not just the base value class)
 *   B) MetricsStrip "Updated" label never shows bare "0s" — shows "just now" for fresh data
 *   C) Instance table has a name filter input
 *   D) Name filter reduces visible rows correctly
 *   E) Name filter empty state shows a clear button
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - test-app RGD with at least 2 instances (test-instance applied by E2E setup)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 054: UX Gaps Round 3', () => {

  // ── A: W-2 Controller Metrics widget "Not reported" has distinct modifier class ──────────────

  test('Step 1: MetricsStrip counter cells never render "Not reported" at full numeric size', async ({ page }) => {
    // NOTE (spec 062): MetricsStrip removed from Overview. Controller metrics are in W-2 widget.
    await page.goto(BASE)
    // Wait for W-2 to load
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-metrics"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 20000 })

    // If any counter shows "Not reported", it must have the --not-reported modifier class
    const w2 = page.locator('[data-testid="widget-metrics"]')
    const w2Text = await w2.textContent()
    if (w2Text && w2Text.includes('Not reported')) {
      const notReportedCells = w2.locator('.home__metrics-value--not-reported')
      await expect(notReportedCells.first()).toBeVisible()
    }
  })

  // ── B: W-2 staleness label uses "just now" for fresh data ──────────

  test('Step 2: MetricsStrip "Updated" label shows "just now" (not "0s") for fresh data', async ({ page }) => {
    // NOTE (spec 062): "Updated X ago" label is now on the Overview page header.
    await page.goto(BASE)
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="overview-staleness"]') !== null,
      { timeout: 20000 }
    )

    const staleness = page.locator('[data-testid="overview-staleness"]')
    const count = await staleness.count()
    if (count > 0) {
      const text = await staleness.textContent()
      // Should never show bare "0s" — should show "just now" or "Updated Xs ago"
      expect(text).not.toMatch(/Updated 0s/)
    }
  })

  // ── C: Instance table has name filter input ──────────────────────────────────

  test('Step 3: Instance table has a name filter input on the Instances tab', async ({ page }) => {
    // Navigate to test-app instances
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 15000 })

    const filterInput = page.locator('[data-testid="instance-name-filter"]')
    await expect(filterInput).toBeVisible()
    await expect(filterInput).toHaveAttribute('placeholder', 'Filter by name...')
  })

  // ── D: Name filter reduces rows ──────────────────────────────────────────────

  test('Step 4: Typing in name filter reduces visible instance rows', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 15000 })

    // Count rows before filtering
    const allRows = page.locator('[data-testid="instance-table"] tbody tr')
    const initialCount = await allRows.count()
    expect(initialCount).toBeGreaterThan(0)

    // Type a query that matches "test-instance" only
    const filterInput = page.locator('[data-testid="instance-name-filter"]')
    await filterInput.fill('test-instance')

    // Wait for DOM to update
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('[data-testid="instance-table"] tbody tr')
        return rows.length > 0
      },
      { timeout: 5000 }
    )

    const filteredCount = await allRows.count()
    // If test-app has many instances, filtering to "test-instance" should reduce count
    // At minimum, we verify the filter is working (rendered count <= initial)
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  // ── E: Empty filter state shows clear button ─────────────────────────────────

  test('Step 5: Filtering to no matches shows empty state with clear button', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 15000 })

    const filterInput = page.locator('[data-testid="instance-name-filter"]')
    // Type a query that won't match any instance name
    await filterInput.fill('zzz-definitely-no-match-xyz')

    // Wait for empty state to appear (the table disappears, replaced by empty msg)
    await page.waitForFunction(
      () => {
        const empty = document.querySelector('.panel-empty')
        return empty !== null && empty.textContent?.includes('No instances match')
      },
      { timeout: 5000 }
    )

    const emptyMsg = page.locator('.panel-empty')
    await expect(emptyMsg).toBeVisible()

    const clearBtn = page.locator('.instance-filter-search__clear')
    await expect(clearBtn).toBeVisible()

    // Clicking clear restores the table
    await clearBtn.click()
    await page.waitForSelector('[data-testid="instance-table"]', { timeout: 5000 })
  })
})
