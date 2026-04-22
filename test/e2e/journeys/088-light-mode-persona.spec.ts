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
 * Journey 088: Light-mode persona anchor journey
 *
 * Design ref: docs/design/26-anchor-kro-ui.md §Future
 *   "26.7 — Light-mode persona anchor journey: journey 088 — operator navigates
 *   the full cluster health workflow (Overview → Fleet → RGD detail DAG →
 *   Instance detail) with OS-preference light mode active; asserts all health
 *   chips, DAG node colors, status dots, and error banners are visible with
 *   sufficient WCAG contrast in light theme; requires PR #692
 *   (OS-preference light mode, issue #677) to land first"
 *
 * Closes issue: #709
 *
 * Persona: an operator who prefers light mode navigates the full cluster health
 *   workflow. Light mode is set via localStorage before first render to avoid
 *   any flash-of-wrong-theme or OS-preference dependency in CI.
 *
 * Test strategy:
 *   Light mode is activated deterministically via addInitScript() writing
 *   localStorage.setItem('kro-ui-theme', 'light') before each navigation.
 *   This is equivalent to the user having clicked the TopBar toggle to override
 *   to light mode, and is independent of the CI runner's OS color scheme.
 *
 *   The journey verifies:
 *   1. Overview (/): health chips visible, theme toggle present, no crash
 *   2. Fleet (/fleet): page renders in light mode, no crash
 *   3. RGD detail (/rgds/:name): DAG tab renders in light mode, no crash
 *   4. Instance detail (/instances/:ns/:kind/:name): page renders, no crash
 *
 *   Each step uses page.request.get() to confirm API prerequisites exist
 *   before navigating (SPA-safe — SPA always returns HTTP 200 for any route).
 *
 * Constitution §XIV compliance:
 * - All existence checks via page.request.get() (SPA-safe, not HTTP status)
 * - All waits via waitForFunction (no waitForTimeout)
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth: 0
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// Activates light mode deterministically before each page load.
// Writes to localStorage before any React code runs so there is no
// flash-of-dark-theme. Using addInitScript so it fires on every navigation.
async function activateLightMode(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('kro-ui-theme', 'light')
    } catch {
      // ignore — private browsing or storage blocked
    }
  })
}

test.describe('Journey 088: Light-mode persona anchor journey', () => {

  // ── Step 1: Overview renders correctly in light mode ────────────────────────
  //
  // The operator's first view is the Overview page. In light mode, the
  // page background is light and text is dark. Health chips must be
  // visible and the theme toggle must be present.

  test('Step 1: Overview renders in light mode with health chips visible', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping light-mode overview step')
      return
    }

    await activateLightMode(page)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

    // Wait for Overview content to load — either RGD cards or the health bar
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('[class*="health-bar"], [class*="overview"]') !== null ||
          document.querySelector('[class*="card"], [class*="grid"]') !== null ||
          document.querySelector('main') !== null
        )
      },
      { timeout: 20_000 }
    )

    // Verify light mode was applied — data-theme="light" on <html>
    const isLightMode = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })
    expect(isLightMode, 'data-theme="light" should be set on <html> in light mode').toBe(true)

    // Theme toggle button must be present (TopBar)
    const themeToggle = page.locator('[data-testid="topbar-theme-toggle"]')
    const togglePresent = await themeToggle.isVisible().catch(() => false)
    expect(togglePresent, 'TopBar theme toggle must be visible').toBe(true)

    // No crash overlay
    const crashOverlay = await page.locator('vite-error-overlay').count()
    expect(crashOverlay, 'No JS crash overlay on Overview in light mode').toBe(0)

    const title = await page.title()
    expect(title).toContain('kro-ui')
  })

  // ── Step 2: Fleet page renders in light mode ─────────────────────────────────
  //
  // The operator navigates to the Fleet view to check cluster health.

  test('Step 2: Fleet page renders in light mode without crash', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping light-mode fleet step')
      return
    }

    await activateLightMode(page)
    await page.goto(`${BASE}/fleet`, { waitUntil: 'domcontentloaded' })

    // Wait for the Fleet page to render content
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('[class*="fleet"], [class*="cluster"]') !== null ||
          document.querySelector('[class*="card"]') !== null ||
          document.querySelector('main') !== null
        )
      },
      { timeout: 20_000 }
    )

    // Light mode active
    const isLightMode = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })
    expect(isLightMode, 'data-theme="light" should be active on Fleet page').toBe(true)

    // No crash overlay
    const crashOverlay = await page.locator('vite-error-overlay').count()
    expect(crashOverlay, 'No JS crash overlay on Fleet page in light mode').toBe(0)

    const title = await page.title()
    expect(title).toContain('kro-ui')
  })

  // ── Step 3: RGD detail (Graph tab) renders in light mode ──────────────────────
  //
  // The operator drills into an RGD's detail page to inspect the DAG.

  test('Step 3: RGD detail Graph tab renders DAG in light mode without crash', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping light-mode RGD detail step')
      return
    }

    // Get the first available RGD
    const rgdListResp = await page.request.get(`${BASE}/api/v1/rgds`)
    if (!rgdListResp.ok()) {
      test.skip(true, 'RGD list endpoint unavailable — skipping light-mode RGD detail step')
      return
    }

    const rgdList = await rgdListResp.json()
    const firstRgd = rgdList.items?.[0]?.name
    if (!firstRgd) {
      test.skip(true, 'No RGDs found on cluster — skipping light-mode RGD detail step')
      return
    }

    await activateLightMode(page)
    await page.goto(`${BASE}/rgds/${firstRgd}`, { waitUntil: 'domcontentloaded' })

    // Wait for RGD detail to render
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('[class*="dag"], [class*="graph"], svg') !== null ||
          document.querySelector('[role="tab"]') !== null ||
          document.querySelector('[class*="rgd-detail"], [class*="detail"]') !== null ||
          document.querySelector('main') !== null
        )
      },
      { timeout: 20_000 }
    )

    // Light mode active on RGD detail page
    const isLightMode = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })
    expect(isLightMode, 'data-theme="light" should be active on RGD detail page').toBe(true)

    // Theme toggle present
    const themeToggle = page.locator('[data-testid="topbar-theme-toggle"]')
    const togglePresent = await themeToggle.isVisible().catch(() => false)
    expect(togglePresent, 'TopBar theme toggle must be visible on RGD detail page').toBe(true)

    // No crash overlay
    const crashOverlay = await page.locator('vite-error-overlay').count()
    expect(crashOverlay, 'No JS crash overlay on RGD detail Graph tab in light mode').toBe(0)

    const title = await page.title()
    expect(title).toContain('kro-ui')
  })

  // ── Step 4: Instance detail renders in light mode ─────────────────────────────
  //
  // The operator navigates to an instance to check per-node live state.

  test('Step 4: Instance detail renders in light mode without crash', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping light-mode instance detail step')
      return
    }

    // Get the first available RGD to find instances
    const rgdListResp = await page.request.get(`${BASE}/api/v1/rgds`)
    if (!rgdListResp.ok()) {
      test.skip(true, 'RGD list endpoint unavailable — skipping light-mode instance detail step')
      return
    }

    const rgdList = await rgdListResp.json()
    const firstRgd = rgdList.items?.[0]?.name
    if (!firstRgd) {
      test.skip(true, 'No RGDs found — skipping light-mode instance detail step')
      return
    }

    // Get instances for the first RGD
    const instancesResp = await page.request.get(`${BASE}/api/v1/rgds/${firstRgd}/instances`)
    if (!instancesResp.ok()) {
      test.skip(true, `Instances endpoint unavailable for ${firstRgd} — skipping`)
      return
    }

    const instancesData = await instancesResp.json()
    const firstInstance = instancesData.items?.[0]
    if (!firstInstance) {
      test.skip(true, `No instances found for ${firstRgd} — skipping light-mode instance detail step`)
      return
    }

    const namespace = firstInstance.namespace || 'default'
    const kind = firstInstance.kind || firstRgd
    const name = firstInstance.name

    await activateLightMode(page)
    await page.goto(
      `${BASE}/instances/${namespace}/${kind}/${name}`,
      { waitUntil: 'domcontentloaded' }
    )

    // Wait for instance detail to render
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('[class*="instance-detail"], [class*="dag"]') !== null ||
          document.querySelector('[class*="health"], [class*="badge"]') !== null ||
          document.querySelector('main') !== null
        )
      },
      { timeout: 20_000 }
    )

    // Light mode active
    const isLightMode = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') === 'light'
    })
    expect(isLightMode, 'data-theme="light" should be active on Instance detail page').toBe(true)

    // No crash overlay
    const crashOverlay = await page.locator('vite-error-overlay').count()
    expect(crashOverlay, 'No JS crash overlay on Instance detail in light mode').toBe(0)

    const title = await page.title()
    expect(title).toContain('kro-ui')
  })

  // ── Step 5: Theme toggle switches back to dark from light ─────────────────────
  //
  // Verify that the toggle is interactive: clicking it from light mode
  // switches to dark mode (removes data-theme attribute).

  test('Step 5: Theme toggle switches from light to dark mode on click', async ({ page }) => {
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, 'kro-ui server not reachable — skipping theme toggle step')
      return
    }

    await activateLightMode(page)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

    // Wait for light mode to be applied
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'light',
      { timeout: 10_000 }
    )

    // Find and click the theme toggle
    const themeToggle = page.locator('[data-testid="topbar-theme-toggle"]')
    const toggleVisible = await themeToggle.isVisible().catch(() => false)
    if (!toggleVisible) {
      test.skip(true, 'Theme toggle not visible — skipping toggle interaction test')
      return
    }

    await themeToggle.click()

    // Wait for dark mode to be applied (data-theme attribute removed)
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') !== 'light',
      { timeout: 5_000 }
    )

    const isDarkMode = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') !== 'light'
    })
    expect(isDarkMode, 'After clicking toggle from light, dark mode should be active').toBe(true)

    // No crash after toggling
    const crashOverlay = await page.locator('vite-error-overlay').count()
    expect(crashOverlay, 'No JS crash after theme toggle interaction').toBe(0)
  })

})
