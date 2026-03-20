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
 * Journey 007: Context Switcher — switching contexts and top bar update
 *
 * Validates that the operator can switch between kubeconfig contexts via the
 * top bar dropdown, and that the UI updates accordingly.
 *
 * Two kubeconfig contexts are registered during global setup pointing at the
 * same kind cluster:
 *   - kro-ui-e2e (primary, server starts with this)
 *   - kro-ui-e2e-alt (alternate, same endpoint)
 *   - arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name (fake ARN for truncation test)
 *
 * Spec ref: .specify/specs/007-context-switcher/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

test.describe('Journey 007 — Context switcher', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="context-name"]', { timeout: 10_000 })
  })

  test('Step 1: Initial context name is visible in the top bar', async ({ page }) => {
    const contextName = page.getByTestId('context-name')
    await expect(contextName).toBeVisible()
    await expect(contextName).toContainText('kro-ui-e2e')
  })

  test('Step 2: Context dropdown lists all registered contexts', async ({ page }) => {
    await page.getByTestId('context-switcher-btn').click()
    const dropdown = page.getByTestId('context-dropdown')
    await expect(dropdown).toBeVisible()

    // Primary context is marked as active
    const primaryOption = dropdown.locator('[data-context="kind-kro-ui-e2e"]')
    await expect(primaryOption).toBeVisible()
    const isActive = await primaryOption.getAttribute('data-active')
    expect(isActive).toBe('true')

    // Alternate context is listed
    const altOption = dropdown.locator('[data-context="kro-ui-e2e-alt"]')
    await expect(altOption).toBeVisible()
  })

  test('Step 3: Switching to alternate context updates the top bar', async ({ page }) => {
    await page.getByTestId('context-switcher-btn').click()
    await page.locator('[data-context="kro-ui-e2e-alt"]').click()

    // Dropdown closes
    await expect(page.getByTestId('context-dropdown')).not.toBeVisible()

    // Top bar reflects new context
    await expect(page.getByTestId('context-name')).toContainText('kro-ui-e2e-alt')
  })

  test('Step 4: RGD list reloads after context switch', async ({ page }) => {
    await page.getByTestId('context-switcher-btn').click()
    await page.locator('[data-context="kro-ui-e2e-alt"]').click()

    // Same cluster — test-app RGD should still appear
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible({ timeout: 10_000 })

    // URL has not changed (no full-page navigation)
    expect(page.url()).toMatch(/\/$/)
  })

  test('Step 5: Long context name is truncated in the top bar', async ({ page }) => {
    const LONG_CONTEXT = 'arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name'

    // Switch to the long-named context
    await page.getByTestId('context-switcher-btn').click()
    await page.locator(`[data-context="${LONG_CONTEXT}"]`).click()
    await expect(page.getByTestId('context-dropdown')).not.toBeVisible()

    const contextEl = page.getByTestId('context-name')

    // Visible text should NOT be the full ARN (it's truncated)
    const visibleText = await contextEl.textContent()
    expect(visibleText?.length).toBeLessThan(LONG_CONTEXT.length)

    // Full name must be in the title tooltip
    const titleAttr = await contextEl.getAttribute('title')
    expect(titleAttr).toBe(LONG_CONTEXT)
  })

  test('Step 6: Can switch back to primary context', async ({ page }) => {
    // Switch away first
    await page.getByTestId('context-switcher-btn').click()
    await page.locator('[data-context="kro-ui-e2e-alt"]').click()
    await expect(page.getByTestId('context-name')).toContainText('kro-ui-e2e-alt')

    // Switch back
    await page.getByTestId('context-switcher-btn').click()
    await page.locator('[data-context="kind-kro-ui-e2e"]').click()
    await expect(page.getByTestId('context-name')).toContainText('kro-ui-e2e')
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible({ timeout: 10_000 })
  })

})
