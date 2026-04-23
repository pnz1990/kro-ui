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
 * Journey 091: Designer CEL expression linter (spec issue-721 / PR #743)
 *
 * Validates that:
 *   1. The /author page loads with the RGD authoring form
 *   2. The Resources tab is accessible via the tab bar
 *   3. A resource can be added via "+ Add Resource" (Resources tab only)
 *   4. The advanced options accordion can be expanded to reveal readyWhen inputs
 *   5. A readyWhen row can be added and typed into
 *   6. Typing an unclosed string literal triggers the inline CEL error hint
 *      (CELLintHint component — role="alert", class rgd-authoring-form__cel-error)
 *   7. Clearing the expression removes the error hint
 *   8. A valid CEL expression produces no error hint
 *
 * The /author page has a tabbed layout (Schema | Resources | YAML | Preview).
 * The "+ Add Resource" button and resource editing controls live in the Resources tab.
 * Navigation to the Resources tab (data-testid="designer-tab-resources") is
 * required before any resource operation.
 *
 * Spec ref: .specify/specs/issue-744/spec.md
 *
 * Constitution §XIV compliance:
 * - Server health via page.request.get() — SPA returns HTTP 200 for all routes
 * - All waits via waitForFunction — no waitForTimeout
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth: 0
 */

import { test, expect, type Page } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

/**
 * Navigate to /author, switch to the Resources tab, add one resource,
 * expand its advanced section, and add one readyWhen row.
 * Returns the Playwright Page already positioned with the readyWhen input visible.
 */
async function openDesignerWithReadyWhen(page: Page): Promise<void> {
  await page.goto(`${BASE}/author`, { waitUntil: 'domcontentloaded' })

  // Wait for the authoring form to mount
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
      document.querySelector('.rgd-authoring-form') !== null,
    { timeout: 25_000 }
  )

  // Navigate to the Resources tab (default is Schema; resources live here)
  await page.locator('[data-testid="designer-tab-resources"]').click()

  // Wait for Resources tab to become active
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="designer-tab-resources"]')
        ?.getAttribute('aria-selected') === 'true',
    { timeout: 5_000 }
  )

  // Click "+ Add Resource" to create a resource node
  await page.getByText('+ Add Resource', { exact: true }).click()

  // Wait for at least one advanced-expand button (resource added)
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="advanced-expand-"]').length > 0,
    { timeout: 10_000 }
  )

  // Expand advanced options for the first resource
  await page.locator('[data-testid^="advanced-expand-"]').first().click()

  // Wait for readyWhen add button to appear
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="readywhen-add-"]').length > 0,
    { timeout: 10_000 }
  )

  // Add a readyWhen row
  await page.locator('[data-testid^="readywhen-add-"]').first().click()

  // Wait for the readyWhen expression input
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="readywhen-expr-"]').length > 0,
    { timeout: 10_000 }
  )
}

test.describe('Journey 091 — Designer CEL expression linter', () => {

  // ── Step 1: Server health check ─────────────────────────────────────────────

  test('Step 1: Server is reachable before CEL linter journey', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!resp.ok()) {
      test.skip(true, `kro-ui server not reachable at ${BASE} — skipping CEL linter journey`)
      return
    }
    expect(resp.status()).toBe(200)
  })

  // ── Step 2: /author page loads and authoring form is visible ─────────────────

  test('Step 2: /author page loads with RGD authoring form', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping CEL linter journey')
      return
    }

    await page.goto(`${BASE}/author`, { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
        document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 25_000 }
    )

    const formVisible =
      (await page.locator('[data-testid="rgd-authoring-form"]').isVisible().catch(() => false)) ||
      (await page.locator('.rgd-authoring-form').isVisible().catch(() => false))

    expect(formVisible, 'RGD authoring form must be visible on /author').toBe(true)
  })

  // ── Step 3: Navigate to Resources tab, add resource, expand advanced ─────────

  test('Step 3: Navigate to Resources tab, add resource and expand advanced section', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping CEL linter journey')
      return
    }

    await page.goto(`${BASE}/author`, { waitUntil: 'domcontentloaded' })

    // Wait for form
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="rgd-authoring-form"]') !== null ||
        document.querySelector('.rgd-authoring-form') !== null,
      { timeout: 25_000 }
    )

    // Navigate to the Resources tab
    const resourcesTab = page.locator('[data-testid="designer-tab-resources"]')
    await expect(resourcesTab).toBeVisible({ timeout: 10_000 })
    await resourcesTab.click()

    // Wait for Resources tab to be active
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="designer-tab-resources"]')
          ?.getAttribute('aria-selected') === 'true',
      { timeout: 5_000 }
    )

    // Click "+ Add Resource" (only available in Resources tab)
    const addResourceBtn = page.getByText('+ Add Resource', { exact: true })
    await expect(addResourceBtn).toBeVisible({ timeout: 10_000 })
    await addResourceBtn.click()

    // Wait for advanced-expand button to appear
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="advanced-expand-"]').length > 0,
      { timeout: 10_000 }
    )

    // Expand the advanced section
    await page.locator('[data-testid^="advanced-expand-"]').first().click()

    // readyWhen add button should be visible
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="readywhen-add-"]').length > 0,
      { timeout: 10_000 }
    )

    const readyWhenAddBtn = page.locator('[data-testid^="readywhen-add-"]').first()
    await expect(readyWhenAddBtn).toBeVisible({ timeout: 5_000 })
  })

  // ── Step 4: Type invalid CEL — assert lint error hint appears ────────────────

  test('Step 4: Typing unclosed string literal triggers CEL error hint', async ({ page }) => {
    test.setTimeout(60_000)

    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping CEL linter journey')
      return
    }

    await openDesignerWithReadyWhen(page)

    const readyWhenInput = page.locator('[data-testid^="readywhen-expr-"]').first()
    await expect(readyWhenInput).toBeVisible({ timeout: 5_000 })

    // Type an unclosed string literal — triggers the CEL linter after 300ms debounce
    await readyWhenInput.fill('"hello')

    // Wait for the lint error hint to appear (debounce: 300ms + tolerance)
    // Uses waitForFunction to avoid fixed-ms waits (constitution §XIV O2)
    await page.waitForFunction(
      () => {
        const alerts = document.querySelectorAll('[role="alert"]')
        for (const el of alerts) {
          const text = el.textContent ?? ''
          if (text.includes('nclosed') || text.includes('string') || text.includes('missing')) {
            return true
          }
        }
        return false
      },
      { timeout: 5_000 }
    )

    // The error hint must specifically mention the unclosed string issue
    const errorAlerts = page.locator('[role="alert"]').filter({
      hasText: /[Uu]nclosed|string|missing/
    })
    await expect(errorAlerts.first()).toBeVisible({ timeout: 5_000 })
  })

  // ── Step 5: Clearing expression removes error hint ───────────────────────────

  test('Step 5: Clearing the expression removes the CEL error hint', async ({ page }) => {
    test.setTimeout(60_000)

    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping CEL linter journey')
      return
    }

    await openDesignerWithReadyWhen(page)

    const readyWhenInput = page.locator('[data-testid^="readywhen-expr-"]').first()
    await readyWhenInput.fill('"hello')

    // Wait for error hint to appear
    await page.waitForFunction(
      () => {
        const alerts = document.querySelectorAll('[role="alert"]')
        for (const el of alerts) {
          const text = el.textContent ?? ''
          if (text.includes('nclosed') || text.includes('string') || text.includes('missing')) {
            return true
          }
        }
        return false
      },
      { timeout: 5_000 }
    )

    // Now clear the expression
    await readyWhenInput.fill('')

    // Wait for the CEL error hint to disappear (debounce fires; empty string → no diag)
    await page.waitForFunction(
      () => {
        const alerts = document.querySelectorAll('[role="alert"]')
        for (const el of alerts) {
          const text = el.textContent ?? ''
          if (text.includes('nclosed') || text.includes('string') || text.includes('missing')) {
            return false  // error still present
          }
        }
        return true  // no matching error hint
      },
      { timeout: 5_000 }
    )

    // Confirm the cel-error class element is gone
    const celErrors = await page.locator('.rgd-authoring-form__cel-error').count()
    expect(celErrors).toBe(0)
  })

  // ── Step 6: Valid CEL expression produces no error hint ──────────────────────

  test('Step 6: Valid CEL expression produces no error hint', async ({ page }) => {
    test.setTimeout(60_000)

    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping CEL linter journey')
      return
    }

    await openDesignerWithReadyWhen(page)

    const readyWhenInput = page.locator('[data-testid^="readywhen-expr-"]').first()
    // Valid CEL: compare a resource field to a number
    await readyWhenInput.fill('${schema.spec.replicas} >= 1')

    // Wait for debounce to settle and assert no CEL error hint via polling
    // (no waitForTimeout — poll until DOM stable with no lint error for 2 checks)
    await page.waitForFunction(
      () => document.querySelectorAll('.rgd-authoring-form__cel-error').length === 0,
      { timeout: 3_000 }
    )

    // No CEL error hint should exist
    const celErrors = await page.locator('.rgd-authoring-form__cel-error').count()
    expect(celErrors).toBe(0)
  })

}) // end test.describe
