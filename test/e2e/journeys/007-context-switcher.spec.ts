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

    // Verify RGD is visible before the switch
    const rgdCard = page.getByTestId('rgd-card-test-app')
    await expect(rgdCard).toBeVisible()

    // Open the dropdown and switch to a non-active context.
    // Server state is shared across tests — whichever context is active,
    // we pick one that isn't to guarantee a real switch.
    await page.getByTestId('context-switcher-btn').click()
    const dropdown = page.getByTestId('context-dropdown')
    await expect(dropdown).toBeVisible()

    // Find a non-active option. Read its `data-context` or `title` attribute
    // (not textContent) to avoid mismatches when the name is truncated in the label.
    const nonActiveOption = dropdown.locator(
      '[role="option"]:not(.context-switcher__option--active)',
    ).first()
    await expect(nonActiveOption).toBeVisible()
    // Use title attribute of the option for reliable comparison with the top-bar label
    const switchedToTitle = await nonActiveOption.getAttribute('title') ?? await nonActiveOption.textContent()
    await nonActiveOption.click()

    // Dropdown should close and top bar should update to the switched context.
    await expect(dropdown).not.toBeVisible()
    // The displayed name may be truncated, so check the title attribute instead.
    const contextLabel = page.getByTestId('context-name')
    await expect(contextLabel).toHaveAttribute('title', switchedToTitle?.trim() ?? '')

    // RGD card should still be visible after context switch
    // (all test contexts point at the same cluster, so the same RGD is returned).
    await expect(rgdCard).toBeVisible()

    // URL is / — navigate('/') from handleSwitch is idempotent when already on /.
    expect(page.url()).toBe(`${BASE}/`)
  })

  test('Step 5: Long ARN context name is truncated in the top bar', async ({ page }) => {
    await page.goto(BASE)

    // Switch to the long-name context
    await page.getByTestId('context-switcher-btn').click()
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: 'kro-ui-e2e-long-name' })
      .click()

    // Wait for top bar to update — check that truncation indicator appears
    await expect(page.getByTestId('context-name')).toContainText('kro-ui-e2e-long-name')

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

    // Open dropdown and check the current active context
    await page.getByTestId('context-switcher-btn').click()
    const dropdown = page.getByTestId('context-dropdown')
    await expect(dropdown).toBeVisible()

    // If we are not already on primary, switch to primary directly.
    // (Previous tests may have left the server on a different context.)
    const primaryOption = dropdown.locator('[role="option"]', { hasText: PRIMARY_CONTEXT })
    const isPrimaryActive = (await primaryOption.getAttribute('aria-selected')) === 'true'

    if (!isPrimaryActive) {
      await primaryOption.click()
      await expect(page.getByTestId('context-name')).toContainText(PRIMARY_CONTEXT)
    } else {
      // Already on primary — close the dropdown
      await page.keyboard.press('Escape')
    }

    // Regardless of path, verify primary is now active
    await expect(page.getByTestId('context-name')).toContainText(PRIMARY_CONTEXT)

    // RGD list should still show the test-app card
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()
  })

  test('Step 7: all fixture RGD cards visible after switching context and back', async ({ page }) => {
    // Extend per-test timeout — the double context switch + cache flush +
    // throttled API reload can take longer than the default 60s test timeout.
    // Budget: 2s(goto) + 60s(opt1) + 10s(close) + 30s(stab) + 60s(opt2) + 10s(close) + 45s(cards)
    test.setTimeout(240_000)

    await page.goto(BASE)

    // Switch to alt context — wait for the option to be visible (context list loads from API)
    await page.getByTestId('context-switcher-btn').click()
    // Wait for the dropdown option to appear — the /contexts API call may be slow on throttled clusters
    await page.waitForFunction(
      (ctx: string) => {
        const dropdown = document.querySelector('[data-testid="context-dropdown"]')
        if (!dropdown) return false
        const options = Array.from(dropdown.querySelectorAll('[role="option"]'))
        return options.some((o) => o.textContent?.includes(ctx))
      },
      ALT_CONTEXT,
      { timeout: 60000 }
    )
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: ALT_CONTEXT })
      .click()
    await expect(page.getByTestId('context-dropdown')).not.toBeVisible({ timeout: 10000 })

    // Wait for the page to stabilize after the context switch + cache flush.
    await page.waitForFunction(
      () => document.querySelector('[data-testid="context-switcher-btn"]') !== null,
      { timeout: 30000 }
    )

    // Switch back to primary — wait for option before clicking
    await page.getByTestId('context-switcher-btn').click()
    await page.waitForFunction(
      (ctx: string) => {
        const dropdown = document.querySelector('[data-testid="context-dropdown"]')
        if (!dropdown) return false
        const options = Array.from(dropdown.querySelectorAll('[role="option"]'))
        return options.some((o) => o.textContent?.includes(ctx))
      },
      PRIMARY_CONTEXT,
      { timeout: 60000 }
    )
    await page.getByTestId('context-dropdown')
      .locator('[role="option"]', { hasText: PRIMARY_CONTEXT })
      .click()
    await expect(page.getByTestId('context-dropdown')).not.toBeVisible({ timeout: 10000 })

    // After context switch the cache is flushed (spec 057) — the RGD list is
    // refetched from the API. On throttled E2E clusters this may take >5s.
    // Wait for ALL 5 fixture cards at once (not serially) to stay within budget.
    await page.waitForFunction(
      (names: string[]) => names.every((n) => document.querySelector(`[data-testid="rgd-card-${n}"]`) !== null),
      ['test-app', 'test-collection', 'multi-resource', 'external-ref', 'cel-functions'],
      { timeout: 45000 }
    )
  })

    // After context switch the cache is flushed (spec 057) — the RGD list is
    // refetched from the API. On throttled E2E clusters this may take >5s.
    // Wait for ALL 5 fixture cards at once (not serially) to stay within budget.
    await page.waitForFunction(
      (names: string[]) => names.every((n) => document.querySelector(`[data-testid="rgd-card-${n}"]`) !== null),
      ['test-app', 'test-collection', 'multi-resource', 'external-ref', 'cel-functions'],
      { timeout: 45000 }
    )
  })
})
