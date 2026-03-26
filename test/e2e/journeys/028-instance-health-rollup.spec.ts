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
 * Journey 028: Instance Health Rollup
 *
 * Validates the health rollup feature across three surfaces:
 * 1. RGD home card shows a HealthChip that resolves after async load
 * 2. Instance table shows a ReadinessBadge for each instance row
 * 3. Instance detail header shows a HealthPill with state text
 * 4. ConditionsPanel empty state shows "Not reported" (constitution §XII)
 *
 * Spec ref: .specify/specs/028-instance-health-rollup/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (WebApp kind, 3 resources)
 * - test-instance CR applied in namespace kro-ui-e2e
 * - instance is reconciled (child resources exist)
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'
const RGD_NAME = process.env.TEST_RGD_NAME || 'test-app'
const INSTANCE_NS = process.env.TEST_INSTANCE_NS || 'kro-ui-e2e'
const INSTANCE_NAME = process.env.TEST_INSTANCE_NAME || 'test-instance'

test.describe('Journey 028: Instance Health Rollup', () => {
  test('Step 1: Home page renders RGD cards and health chip is present', async ({ page }) => {
    await page.goto(BASE)

    // RGD card must be visible
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })

    // After the async chip fetch, at least one chip should appear.
    // With 14 RGDs and potential API throttling under parallel load, allow
    // up to 20s for the first chip to resolve from skeleton.
    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })
    const chip = page.locator('[data-testid="health-chip"]').first()
    await expect(chip).toBeVisible()

    // Chip text should match the expected pattern
    const chipText = await chip.textContent()
    expect(chipText).toMatch(/\d+ ready|\d+ \/ \d+ ready|no instances/)
  })

  test('Step 2: Health chip resolves with meaningful text', async ({ page }) => {
    await page.goto(BASE)

    // Wait for health chip to be present and have non-skeleton content
    await page.waitForFunction(
      () => {
        const chips = document.querySelectorAll('[data-testid="health-chip"]')
        return Array.from(chips).some(
          (el) => el.textContent && el.textContent.trim() !== '' && !el.classList.contains('health-chip--skeleton'),
        )
      },
      { timeout: 8000 },
    )

    const chip = page.locator('[data-testid="health-chip"]').first()
    const text = await chip.textContent()
    expect(text?.trim()).toMatch(/\d+ ready|\d+ \/ \d+ ready|no instances/)
  })

  test('Step 3: Instance table shows ReadinessBadge for each row', async ({ page }) => {
    await page.goto(`${BASE}/rgds/${RGD_NAME}?tab=instances`)

    // Instance table must render
    await expect(page.locator('[data-testid="instance-table"]')).toBeVisible({ timeout: 10000 })

    // At least one readiness badge should be present
    const badges = page.locator('[data-testid="readiness-badge"]')
    const count = await badges.count()
    expect(count).toBeGreaterThan(0)

    // Badge text must be one of the 5 known states
    const firstBadgeText = await badges.first().textContent()
    expect(firstBadgeText?.trim()).toMatch(/^(Ready|Not Ready|Reconciling|Pending|Unknown)$/)
  })

  test('Step 4: Instance detail header shows HealthPill', async ({ page }) => {
    await page.goto(`${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`)

    // Detail page must render
    await expect(page.locator('[data-testid="instance-detail-page"]')).toBeVisible({ timeout: 10000 })

    // Wait for the pill to resolve from skeleton to an actual state label.
    // The skeleton renders with aria-hidden and empty text; the resolved pill
    // has text content matching one of the 5 known state labels.
    const pill = page.locator('[data-testid="health-pill"]')
    await expect(pill).toHaveText(/^(Ready|Reconciling|Error|Pending|Unknown)$/, { timeout: 10000 })
  })

  test('Step 5: ConditionsPanel empty state shows "Not reported" when no conditions', async ({ page }) => {
    await page.goto(`${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`)
    await expect(page.locator('[data-testid="instance-detail-page"]')).toBeVisible({ timeout: 10000 })

    // Check if the conditions panel empty state is visible
    const emptyEl = page.locator('[data-testid="conditions-panel-empty"]')
    const isVisible = await emptyEl.isVisible()

    if (isVisible) {
      const text = await emptyEl.textContent()
      expect(text?.trim()).toBe('Not reported')
      // Must NOT contain the old (incorrect) text
      expect(text).not.toContain('No conditions.')
    } else {
      // If there are conditions, confirm the summary header is visible instead
      const panel = page.locator('[data-testid="conditions-panel"]')
      await expect(panel).toBeVisible()
      const summaryEl = panel.locator('.conditions-summary')
      // If conditions exist, summary should show "N / M conditions healthy"
      const summaryVisible = await summaryEl.isVisible()
      if (summaryVisible) {
        const summaryText = await summaryEl.textContent()
        expect(summaryText).toMatch(/\d+ \/ \d+ conditions healthy/)
      }
    }
  })

  test('Step 6: ReconciliationSuspended=False is rendered as healthy (negation-polarity)', async ({ page }) => {
    await page.goto(`${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`)
    await expect(page.locator('[data-testid="instance-detail-page"]')).toBeVisible({ timeout: 10000 })

    const conditionRow = page.locator('[data-testid="condition-item-ReconciliationSuspended"]')
    const exists = await conditionRow.count() > 0

    if (!exists) {
      // ReconciliationSuspended not present on this instance — skip assertions
      return
    }

    // Must have the healthy CSS class (condition-item--true), not the unhealthy one
    await expect(conditionRow).toHaveClass(/condition-item--true/)
    await expect(conditionRow).not.toHaveClass(/condition-item--false/)

    // Conditions summary (if visible) must show equal healthy/total counts,
    // confirming ReconciliationSuspended=False is NOT counted as unhealthy.
    const summaryEl = page.locator('[data-testid="conditions-summary"]')
    const summaryVisible = await summaryEl.isVisible()
    if (summaryVisible) {
      const summaryText = await summaryEl.textContent()
      // Parse "N / M conditions healthy" — N must equal M
      const match = summaryText?.match(/(\d+)\s*\/\s*(\d+)\s+conditions healthy/)
      if (match) {
        const healthy = parseInt(match[1], 10)
        const total = parseInt(match[2], 10)
        expect(healthy).toBe(total)
      }
    }
  })
})
