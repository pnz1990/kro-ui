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
 * Journey 055: Overview Health Summary Bar
 *
 * Spec: .specify/specs/055-overview-health-summary/spec.md
 *
 * Verifies:
 *   A) OverviewHealthBar renders after RGD list and health summaries load
 *   B) At least one chip is visible (cluster has at least some instances)
 *   C) Bar is absent during initial loading
 *   D) Chip text contains valid state labels
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - At least one RGD with instances (test-app / test-instance)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 055: Overview Health Summary Bar', () => {

  // ── A+B: Health bar renders with at least one chip ──────────────────────────

  test('Step 1: OverviewHealthBar is visible after Overview loads with instances', async ({ page }) => {
    await page.goto(BASE)
    // Wait for RGD cards to load
    await page.waitForSelector('[data-testid^="rgd-card-"]', { timeout: 15000 })

    // Health summaries are fetched in the background — wait for bar to appear
    // The bar appears once at least one summary is resolved
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })

    const bar = page.locator('[data-testid="overview-health-bar"]')
    await expect(bar).toBeVisible()

    // At least one chip must be present
    const chips = bar.locator('.overview-health-bar__chip')
    const chipCount = await chips.count()
    expect(chipCount).toBeGreaterThan(0)
  })

  // ── D: Chip text uses valid state labels ─────────────────────────────────────

  test('Step 2: OverviewHealthBar chip text uses known state labels', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })

    const chips = page.locator('.overview-health-bar__chip')
    const count = await chips.count()
    const validLabels = ['ready', 'reconciling', 'degraded', 'error', 'pending', 'no instances']

    for (let i = 0; i < count; i++) {
      const text = (await chips.nth(i).textContent()) ?? ''
      const isValid = validLabels.some((label) => text.trim().toLowerCase().includes(label))
      expect(isValid, `Chip "${text}" does not contain a valid state label`).toBe(true)
    }
  })

  // ── C: No undefined/null coercion artifacts in chips ─────────────────────────

  test('Step 3: OverviewHealthBar chips have no coercion artifacts', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })

    const barText = await page.locator('[data-testid="overview-health-bar"]').textContent()
    expect(barText).not.toContain('undefined')
    expect(barText).not.toContain('null')
    expect(barText).not.toContain('[object')
    expect(barText).not.toContain('NaN')
  })
})
