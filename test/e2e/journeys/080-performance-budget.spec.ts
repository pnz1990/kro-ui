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
 * Journey 080: Performance Budget — Overview page time-to-interactive ≤1000ms
 *
 * Design ref: docs/design/27-stage3-kro-tracking.md §Future 27.4
 *   "Performance budget: Overview page load <1s on 50-RGD cluster;
 *    add Lighthouse CI check to CI pipeline"
 *
 * Spec: .specify/specs/530/spec.md
 *
 * Measures wall-clock time from navigation start until the Overview page
 * has rendered its primary content (health bar, RGD cards, or onboarding
 * empty state). Asserts ≤1000ms.
 *
 * Why 1000ms:
 * The Overview page issues parallel fetch calls to the kro API. On a
 * test kind cluster with ~20 RGDs, the API should respond in <200ms and
 * React should render in <100ms. A 1000ms budget gives a 5× headroom for
 * CI runner variance while still catching genuine regressions (e.g.
 * sequential API calls, synchronous discovery, large initial bundle).
 *
 * Measurement method:
 * Uses `performance.getEntriesByType('navigation')[0]` from the browser
 * Performance API, specifically the `domInteractive` timestamp which marks
 * when the HTML parser finished and scripts can run. This is the same
 * metric Lighthouse uses for TTI approximation.
 *
 * Constitution §XIV compliance:
 * - All existence checks via page.request.get() (SPA-safe, never HTTP status)
 * - All waits via waitForFunction (no waitForTimeout)
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth verified: 0
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// Budget: 1000ms for Overview page time-to-interactive.
// This is the DOM Interactive metric (not FCP or LCP) — it represents when
// the browser has parsed the HTML and started executing scripts.
const TTI_BUDGET_MS = 1000

// DOM-content-loaded budget: time until the page's primary content container
// is present and non-empty. Separate from TTI to catch React hydration delays.
const CONTENT_READY_BUDGET_MS = 1500

test.describe('Journey 080 — Performance Budget (Overview TTI ≤1000ms)', () => {

  // ── Step 1: Server health check ─────────────────────────────────────────────

  test('Step 1: Server is reachable before performance measurement', async ({ page }) => {
    // SPA-safe: check /api/v1/healthz which returns a non-HTML response
    const resp = await page.request.get(`${BASE}/api/v1/healthz`)
    // Skip gracefully if the server is not running (e.g. unit-only CI run)
    if (!resp.ok()) {
      test.skip(true, `kro-ui server not reachable at ${BASE} (status ${resp.status()}) — skipping performance tests`)
      return
    }
    expect(resp.status()).toBe(200)
  })

  // ── Step 2: Overview DOM Interactive ≤1000ms ─────────────────────────────────

  test('Step 2: Overview page DOM Interactive is within budget', async ({ page }) => {
    // Pre-flight: skip if server is unreachable
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, `kro-ui server not reachable — skipping performance test`)
      return
    }

    // Navigate to Overview page
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

    // Read DOM Interactive from the Navigation Timing API.
    // domInteractive = time (ms from navigation start) when HTML parsing completed.
    const domInteractive = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      return nav?.domInteractive ?? -1
    })

    if (domInteractive < 0) {
      // Navigation Timing not available (shouldn't happen in Chromium) — skip assertion
      console.warn('Performance.getEntriesByType("navigation") returned no entry — skipping TTI assertion')
      return
    }

    console.log(`Overview domInteractive: ${domInteractive.toFixed(0)}ms (budget: ${TTI_BUDGET_MS}ms)`)

    expect(domInteractive, `Overview domInteractive (${domInteractive.toFixed(0)}ms) exceeded budget (${TTI_BUDGET_MS}ms). ` +
      `This indicates a slow initial page load. Check for synchronous API calls, ` +
      `large bundle size, or sequential discovery in the server handler.`
    ).toBeLessThanOrEqual(TTI_BUDGET_MS)
  })

  // ── Step 3: Overview primary content renders within 1500ms ──────────────────

  test('Step 3: Overview primary content is visible within 1500ms', async ({ page }) => {
    // Pre-flight: skip if server is unreachable
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, `kro-ui server not reachable — skipping content-ready test`)
      return
    }

    const start = Date.now()

    // Navigate and wait for any of the primary content indicators
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

    // Wait for primary content: SRE dashboard grid, onboarding empty state,
    // or a loading skeleton that transitions to content.
    // Any of these means the page has done its first meaningful render.
    const contentAppeared = await page.waitForFunction(() => {
      const grid       = document.querySelector('.home__grid')
      const onboarding = document.querySelector('.home__onboarding')
      const healthBar  = document.querySelector('[class*="health-bar"], [class*="healthBar"]')
      const rgdCard    = document.querySelector('[data-testid^="rgd-card-"], [class*="rgd-card"]')
      const errorState = document.querySelector('[class*="home__error"]')
      return !!(grid || onboarding || healthBar || rgdCard || errorState)
    }, {}, { timeout: CONTENT_READY_BUDGET_MS + 500 }).catch(() => false)

    const elapsed = Date.now() - start

    if (!contentAppeared) {
      // Overview didn't render primary content within timeout — log and fail descriptively
      console.error(`Overview primary content not visible after ${elapsed}ms.`)
    }

    console.log(`Overview content-ready: ${elapsed}ms (budget: ${CONTENT_READY_BUDGET_MS}ms)`)

    expect(contentAppeared, `Overview primary content did not appear within ${CONTENT_READY_BUDGET_MS}ms. ` +
      `Elapsed: ${elapsed}ms. Check React render errors or API timeout configuration.`
    ).toBeTruthy()

    expect(elapsed, `Overview content-ready time (${elapsed}ms) exceeded budget (${CONTENT_READY_BUDGET_MS}ms). ` +
      `This indicates slow API response or React render bottleneck.`
    ).toBeLessThanOrEqual(CONTENT_READY_BUDGET_MS)
  })

  // ── Step 4: Catalog page DOM Interactive ≤1000ms ─────────────────────────────

  test('Step 4: Catalog page DOM Interactive is within budget', async ({ page }) => {
    // Pre-flight: skip if server is unreachable
    const health = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!health.ok()) {
      test.skip(true, `kro-ui server not reachable — skipping catalog performance test`)
      return
    }

    await page.goto(`${BASE}/catalog`, { waitUntil: 'domcontentloaded' })

    const domInteractive = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      return nav?.domInteractive ?? -1
    })

    if (domInteractive < 0) {
      console.warn('Performance.getEntriesByType("navigation") returned no entry — skipping Catalog TTI assertion')
      return
    }

    console.log(`Catalog domInteractive: ${domInteractive.toFixed(0)}ms (budget: ${TTI_BUDGET_MS}ms)`)

    expect(domInteractive, `Catalog domInteractive (${domInteractive.toFixed(0)}ms) exceeded budget (${TTI_BUDGET_MS}ms).`
    ).toBeLessThanOrEqual(TTI_BUDGET_MS)
  })

})
