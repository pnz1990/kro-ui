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
 * Journey 007: Context Switcher
 *
 * Validates that the context switcher dropdown allows switching between
 * kubeconfig contexts, the UI updates immediately, the RGD list reloads,
 * and long context names are truncated with a tooltip.
 *
 * Spec ref: .specify/specs/007-context-switcher/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running (kro-ui-e2e), kro installed, test-app RGD applied
 * - Three contexts registered by global-setup pointing at the same endpoint:
 *     kro-ui-e2e-primary (initial context the server started with)
 *     kro-ui-e2e-alt     (alternate context — same cluster)
 *     arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name (fake ARN)
 *
 * Because both kro-ui-e2e-primary and kro-ui-e2e-alt point at the same cluster,
 * switching between them returns the same test-app RGD from both. The test
 * validates the UI flow rather than cluster isolation.
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// Context names registered by global-setup
const PRIMARY_CONTEXT = 'kind-kro-ui-e2e'
const ALT_CONTEXT = 'kro-ui-e2e-alt'
const LONG_CONTEXT = 'arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name'

test.describe('Journey 007 — Context Switcher', () => {
  test('Step 1: Initial context is shown in the top bar', async ({ page }) => {
    await page.goto(BASE)

    const contextName = page.getByTestId('context-name')
    await expect(contextName).toBeVisible()
    await expect(contextName).toContainText(PRIMARY_CONTEXT)
  })

  test('Step 2: Context dropdown opens and shows all contexts', async ({ page }) => {
    await page.goto(BASE)

    // Open the switcher
    await page.getByTestId('context-switcher-btn').click()

    const dropdown = page.getByTestId('context-dropdown')
    await expect(dropdown).toBeVisible()

    // Primary context should be listed and marked active (aria-selected)
    const primaryOption = dropdown.locator('[role="option"]', { hasText: PRIMARY_CONTEXT })
    await expect(primaryOption).toBeVisible()
    await expect(primaryOption).toHaveAttribute('aria-selected', 'true')

    // Alternate context should be listed and NOT active
    const altOption = dropdown.locator('[role="option"]', { hasText: ALT_CONTEXT })
    await expect(altOption).toBeVisible()
    await expect(altOption).toHaveAttribute('aria-selected', 'false')
  })

  test('Step 3: Switching to alternate context updates the top bar', async ({ page }) => {
    await page.goto(BASE)

    // Open the switcher
    await page.getByTestId('context-switcher-btn').click()
    await expect(page.getByTestId('context-dropdown')).toBeVisible()

    // Click the alternate context
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: ALT_CONTEXT })
      .click()

    // Dropdown should close
    await expect(page.getByTestId('context-dropdown')).not.toBeVisible()

    // Top bar should update to the new context name
    await expect(page.getByTestId('context-name')).toContainText(ALT_CONTEXT)

    // URL should still be / (no navigation)
    expect(page.url()).toBe(`${BASE}/`)
  })

  test('Step 4: RGD list reloads after context switch', async ({ page }) => {
    await page.goto(BASE)

    // Verify initial RGD is visible
    const rgdCard = page.getByTestId('rgd-card-test-app')
    await expect(rgdCard).toBeVisible()

    // Switch context
    await page.getByTestId('context-switcher-btn').click()
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: ALT_CONTEXT })
      .click()

    // RGD card should still be visible after context switch
    // (both contexts point at the same cluster, so the same RGD is returned)
    await expect(rgdCard).toBeVisible()

    // URL remains / — no navigation occurred
    expect(page.url()).toBe(`${BASE}/`)
  })

  test('Step 5: Long ARN context name is truncated in the top bar', async ({ page }) => {
    await page.goto(BASE)

    // Switch to the long-name context
    await page.getByTestId('context-switcher-btn').click()
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: 'kro-ui-e2e-long-name' })
      .click()

    // Wait for top bar to update
    await expect(page.getByTestId('context-name')).not.toContainText(PRIMARY_CONTEXT)

    const contextLabel = page.getByTestId('context-name')

    // The displayed text should NOT be the full ARN character-for-character
    const displayedText = await contextLabel.textContent()
    expect(displayedText).not.toBe(LONG_CONTEXT)
    // It should contain the truncation indicator or the suffix
    expect(displayedText?.includes('\u2026') || displayedText?.includes('kro-ui-e2e-long-name')).toBe(true)

    // The full ARN must be in the title attribute for tooltip
    await expect(contextLabel).toHaveAttribute('title', LONG_CONTEXT)
  })

  test('Step 6: Switch back to primary context', async ({ page }) => {
    await page.goto(BASE)

    // Switch to alt first
    await page.getByTestId('context-switcher-btn').click()
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: ALT_CONTEXT })
      .click()
    await expect(page.getByTestId('context-name')).toContainText(ALT_CONTEXT)

    // Switch back to primary
    await page.getByTestId('context-switcher-btn').click()
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: PRIMARY_CONTEXT })
      .click()

    await expect(page.getByTestId('context-name')).toContainText(PRIMARY_CONTEXT)

    // RGD list should still show the test-app card
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()
  })
})
