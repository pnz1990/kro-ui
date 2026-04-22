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
 * Journey 073: Developer Persona Journey
 *
 * Spec: .specify/specs/issue-459/spec.md
 * Design doc: docs/design/26-anchor-kro-ui.md §Present 26.3
 *
 * An end-to-end workflow following the Developer persona through the RGD
 * authoring workflow: Nav → Designer form → YAML preview → DAG preview →
 * scope configuration.
 *
 * This is an "anchor journey" — it validates DoD journey 4 (RGD authoring)
 * in a single cross-feature workflow.
 *
 * Cluster pre-conditions:
 * - kro-ui binary running at KRO_UI_BASE_URL
 * - Cluster connection is optional — the Designer works in standalone mode
 *
 * Constitution §XIV compliance:
 * - All waits via waitForFunction (no waitForTimeout)
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth verified: 0
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('073: Developer Persona Journey', () => {

  // ── Step 1: Designer page loads ─────────────────────────────────────────────

  test('Step 1: /author route renders RGD Designer form', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the authoring form or author page to render
    await page.waitForFunction(() => {
      const form = document.querySelector('[data-testid="rgd-authoring-form"]')
      const page2 = document.querySelector('.author-page')
      return form !== null || page2 !== null
    }, { timeout: 20000 })

    // RGD authoring form must be visible
    const formVisible = await page.locator('[data-testid="rgd-authoring-form"]').isVisible().catch(() => false)
    const pageVisible = await page.locator('.author-page').isVisible().catch(() => false)

    expect(formVisible || pageVisible).toBe(true)
  })

  // ── Step 2: YAML preview panel is visible ───────────────────────────────────

  test('Step 2: YAML preview panel renders on the Designer page', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the YAML preview panel
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="yaml-preview"]') !== null
    }, { timeout: 20000 })

    await expect(page.getByTestId('yaml-preview')).toBeVisible({ timeout: 10000 })
  })

  // ── Step 3: DAG preview pane renders ────────────────────────────────────────

  test('Step 3: DAG preview pane renders (hint, DAG, or error state)', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the author page to be fully loaded
    await page.waitForFunction(() => {
      return document.querySelector('.author-page') !== null
    }, { timeout: 20000 })

    // DAG preview pane should show one of: hint text, DAG SVG, or error hint
    await page.waitForFunction(() => {
      const dagSvg = document.querySelector('[data-testid="dag-svg"]')
      const dagHint = document.querySelector('.author-page__dag-hint')
      const dagError = document.querySelector('[data-testid="author-dag-error"]')
      const dagPane = document.querySelector('.author-page__dag-pane')
      return dagSvg !== null || dagHint !== null || dagError !== null || dagPane !== null
    }, { timeout: 15000 })

    const svgVisible = await page.locator('[data-testid="dag-svg"]').isVisible().catch(() => false)
    const hintVisible = await page.locator('.author-page__dag-hint').isVisible().catch(() => false)
    const paneVisible = await page.locator('.author-page__dag-pane').isVisible().catch(() => false)

    expect(svgVisible || hintVisible || paneVisible).toBe(true)
  })

  // ── Step 4: Top bar Designer nav link is present ─────────────────────────────

  test('Step 4: Top bar contains RGD Designer navigation link', async ({ page }) => {
    await page.goto(BASE)

    // Wait for top bar to render
    await page.waitForFunction(() => {
      const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]')
      return nav !== null
    }, { timeout: 15000 })

    // Top bar Designer link navigates to /author
    const designerLink = page.locator('a[href="/author"]').first()
    await expect(designerLink).toBeVisible({ timeout: 10000 })
  })

  // ── Step 5: Scope configuration is visible in the authoring form ─────────────

  test('Step 5: RGD authoring form shows scope configuration (namespaced or cluster)', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the authoring form
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="rgd-authoring-form"]') !== null
    }, { timeout: 20000 })

    // Scope selection (namespaced or cluster-scoped) must be visible
    await page.waitForFunction(() => {
      const ns = document.querySelector('[data-testid="scope-namespaced"]')
      const cluster = document.querySelector('[data-testid="scope-cluster"]')
      return ns !== null || cluster !== null
    }, { timeout: 10000 })

    const namespacedVisible = await page.locator('[data-testid="scope-namespaced"]').isVisible().catch(() => false)
    const clusterVisible = await page.locator('[data-testid="scope-cluster"]').isVisible().catch(() => false)

    expect(namespacedVisible || clusterVisible).toBe(true)
  })

  // ── Step 6: Tab bar renders all four tabs ─────────────────────────────────────

  test('Step 6: RGD Designer tab bar renders Schema, Resources, YAML, Preview tabs', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for the tab bar to render
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="designer-tab-bar"]') !== null
    }, { timeout: 20000 })

    // All four tabs must be visible
    await expect(page.getByTestId('designer-tab-schema')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('designer-tab-resources')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('designer-tab-yaml')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('designer-tab-preview')).toBeVisible({ timeout: 5000 })

    // Schema tab is active by default
    const schemaTab = page.getByTestId('designer-tab-schema')
    const schemaSelected = await schemaTab.getAttribute('aria-selected')
    expect(schemaSelected).toBe('true')
  })

  // ── Step 7: Tab focus restoration after navigation ─────────────────────────────

  test('Step 7: Navigating to Resources tab and returning restores tab state', async ({ page }) => {
    await page.goto(`${BASE}/author`)

    // Wait for tab bar
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="designer-tab-bar"]') !== null
    }, { timeout: 20000 })

    // Click Resources tab
    await page.getByTestId('designer-tab-resources').click()

    // Verify Resources tab is now active
    await page.waitForFunction(() => {
      const tab = document.querySelector('[data-testid="designer-tab-resources"]')
      return tab?.getAttribute('aria-selected') === 'true'
    }, { timeout: 5000 })

    // Navigate away (to Overview)
    const overviewLink = page.locator('a[href="/"]').first()
    const hasLink = await overviewLink.isVisible().catch(() => false)
    if (hasLink) {
      await overviewLink.click()
      // Wait for navigation away from /author
      await page.waitForFunction(() => {
        return !window.location.pathname.startsWith('/author')
      }, { timeout: 5000 })
    } else {
      // Fallback: navigate programmatically
      await page.goto(BASE)
    }

    // Navigate back to /author
    await page.goto(`${BASE}/author`)

    // Wait for tab bar to re-render
    await page.waitForFunction(() => {
      return document.querySelector('[data-testid="designer-tab-bar"]') !== null
    }, { timeout: 20000 })

    // Resources tab should be restored from sessionStorage (spec issue-684 O3)
    await page.waitForFunction(() => {
      const tab = document.querySelector('[data-testid="designer-tab-resources"]')
      return tab?.getAttribute('aria-selected') === 'true'
    }, { timeout: 5000 })

    const resourcesTab = page.getByTestId('designer-tab-resources')
    await expect(resourcesTab).toHaveAttribute('aria-selected', 'true')
  })

})
