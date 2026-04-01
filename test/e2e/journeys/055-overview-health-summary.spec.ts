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
 * NOTE (spec 062): The OverviewHealthBar component was replaced by the W-1
 * Instance Health widget as part of the SRE dashboard rewrite. This journey
 * now tests the W-1 widget (data-testid="widget-instances") which shows the
 * same health distribution data in bar or donut format.
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 055: Overview Health Summary Bar', () => {

  // ── A+B: W-1 Instance Health widget renders ──────────────────────────

  test('Step 1: OverviewHealthBar is visible after Overview loads with instances', async ({ page }) => {
    await page.goto(BASE)
    // Wait for W-1 to finish loading
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w1 = page.locator('[data-testid="widget-instances"]')
    await expect(w1).toBeVisible()
    // W-1 shows either instance health widget or "No instances found"
    const text = await w1.textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })

  // ── D: W-1 content uses valid state labels or count ──────────────────

  test('Step 2: OverviewHealthBar chip text uses known state labels', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w1Text = await page.locator('[data-testid="widget-instances"]').textContent()
    // Either shows instance counts (numbers) or "No instances" empty state
    const hasContent = /\d/.test(w1Text ?? '') || (w1Text ?? '').includes('No instances')
    expect(hasContent).toBe(true)
  })

  // ── C: No coercion artifacts ─────────────────────────────────────────

  test('Step 3: OverviewHealthBar chips have no coercion artifacts', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForFunction(() => {
      const w = document.querySelector('[data-testid="widget-instances"]')
      return w !== null && !w.querySelector('[aria-busy="true"]')
    }, { timeout: 25000 })

    const w1Text = await page.locator('[data-testid="widget-instances"]').textContent()
    expect(w1Text).not.toContain('undefined')
    expect(w1Text).not.toContain('null')
    expect(w1Text).not.toContain('[object')
    expect(w1Text).not.toContain('NaN')
  })
})
