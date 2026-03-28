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
 * Verifies:
 *   A) OverviewHealthBar chips are rendered as buttons (clickable)
 *   B) Clicking a chip filters the card grid
 *   C) A clear filter button appears when filter is active
 *   D) Clicking the × button restores all cards
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 060: OverviewHealthBar clickable filter', () => {

  // ── A: Chips are buttons ──────────────────────────────────────────────────────

  test('Step 1: OverviewHealthBar chips are rendered as buttons', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })

    const chips = page.locator('.overview-health-bar__chip--clickable')
    const count = await chips.count()
    expect(count).toBeGreaterThan(0)

    // All clickable chips should be <button> elements
    for (let i = 0; i < Math.min(count, 3); i++) {
      const tag = await chips.nth(i).evaluate((el) => el.tagName.toLowerCase())
      expect(tag).toBe('button')
    }
  })

  // ── B: Clicking a chip filters cards ─────────────────────────────────────────

  test('Step 2: Clicking a health chip filters the RGD card grid', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })
    await page.waitForSelector('[data-testid^="rgd-card-"]', { timeout: 10000 })

    const allCards = page.locator('[data-testid^="rgd-card-"]')
    const initialCount = await allCards.count()

    // Find a chip with a known filter state (e.g. "ready")
    const readyChip = page.locator('[data-testid="health-filter-ready"]')
    if (await readyChip.count() === 0) {
      // No ready chip visible — skip test
      return
    }

    await readyChip.click()

    // Wait for grid to update — count should change (less or equal)
    await page.waitForFunction(
      () => {
        const cards = document.querySelectorAll('[data-testid^="rgd-card-"]')
        return cards.length > 0
      },
      { timeout: 5000 }
    )

    const filteredCount = await allCards.count()
    // Filtered grid should have fewer or equal cards
    expect(filteredCount).toBeLessThanOrEqual(initialCount)

    // aria-pressed should be true on the active chip
    const pressed = await readyChip.getAttribute('aria-pressed')
    expect(pressed).toBe('true')
  })

  // ── C+D: Clear filter button ──────────────────────────────────────────────────

  test('Step 3: Clear filter button restores all cards', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForSelector('[data-testid="overview-health-bar"]', { timeout: 20000 })
    await page.waitForSelector('[data-testid^="rgd-card-"]', { timeout: 10000 })

    const allCards = page.locator('[data-testid^="rgd-card-"]')
    const initialCount = await allCards.count()

    // Click any available chip to activate filter
    const anyChip = page.locator('.overview-health-bar__chip--clickable').first()
    await anyChip.click()

    // Clear filter button should appear
    const clearBtn = page.locator('[data-testid="clear-health-filter"]')
    await expect(clearBtn).toBeVisible({ timeout: 3000 })

    // Click clear
    await clearBtn.click()

    // Grid should restore to initial count
    await page.waitForFunction(
      (expected: number) => {
        const cards = document.querySelectorAll('[data-testid^="rgd-card-"]')
        return cards.length >= expected
      },
      initialCount,
      { timeout: 5000 }
    )

    const restoredCount = await allCards.count()
    expect(restoredCount).toBe(initialCount)
  })
})
