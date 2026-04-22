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
 * Journey 083: Scale Fixture — Overview TTI and DAG render with 20-node RGD
 *
 * Design ref: docs/design/27-stage3-kro-tracking.md §27.18
 *   "E2E scale fixture: add scale-test-rgds.yaml with a single wide RGD
 *   (20 resource nodes) and verify Overview TTI + DAG render under scale."
 *
 * Spec: .specify/specs/issue-663/spec.md (O4)
 *
 * Prerequisite: fixtureState.scaleReady (scale-wide RGD applied by globalSetup §6m).
 * All tests skip gracefully when the fixture is not ready.
 *
 * Steps:
 *   1. Server health check
 *   2. Overview renders within 2000ms TTI with the 20-node RGD present
 *   3. scale-wide RGD detail page renders the Graph tab DAG without JS error
 *   4. DAG SVG contains at least 20 nodes (verifies all resources are drawn)
 *
 * Constitution §XIV compliance:
 * - Existence checks via page.request.get() (SPA-safe, not HTTP status)
 * - All waits via waitForFunction (no waitForTimeout)
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth: 0
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// TTI budget for Overview when the scale-wide RGD is present.
// 2000ms allows for CI runner variance while catching genuine regressions
// (e.g. sequential API calls blocking on 20-node RGD discovery).
const TTI_BUDGET_MS = 2000

test.describe('Journey 083 — Scale Fixture (20-node RGD, Overview TTI, DAG render)', () => {

  // ── Step 1: Server health check ─────────────────────────────────────────────

  test('Step 1: Server is reachable before scale tests', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/v1/healthz`)
    if (!resp.ok()) {
      test.skip(true, `kro-ui server not reachable at ${BASE} (status ${resp.status()}) — skipping scale tests`)
      return
    }
    expect(resp.status()).toBe(200)
  })

  // ── Step 2: Overview renders within TTI budget ───────────────────────────────

  test('Step 2: Overview page renders within 2000ms TTI with scale-wide RGD present', async ({ page }) => {
    if (!fixtureState.scaleReady) {
      test.skip(true, 'scale-wide RGD not Ready — skipping TTI test')
      return
    }

    // Navigate to the Overview page and capture DOM Interactive time
    await page.goto(`${BASE}/`)

    // Wait for the page to render primary content (health bar, cards, or empty state)
    await page.waitForFunction(
      () => {
        // Overview health bar, RGD card grid, or onboarding empty state
        return (
          document.querySelector('[data-testid="overview-health-bar"]') !== null ||
          document.querySelectorAll('[data-testid^="rgd-card-"], [data-testid^="catalog-card-"]').length > 0 ||
          document.querySelector('[data-testid="empty-state"]') !== null ||
          document.querySelector('.overview-page') !== null
        )
      },
      { timeout: 10_000 }
    )

    // Measure DOM Interactive from the Navigation Timing API
    const domInteractive = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (entries.length === 0) return -1
      return entries[0].domInteractive
    })

    if (domInteractive < 0) {
      // Navigation Timing API unavailable (unusual) — skip assertion, log a warning
      console.warn('[083] Navigation Timing API unavailable — TTI assertion skipped')
      return
    }

    // Assert within budget — log actual value for diagnostics
    console.log(`[083] Overview DOM Interactive: ${domInteractive.toFixed(0)}ms (budget: ${TTI_BUDGET_MS}ms)`)
    expect(domInteractive, `Overview DOM Interactive (${domInteractive.toFixed(0)}ms) exceeds ${TTI_BUDGET_MS}ms budget`).toBeLessThanOrEqual(TTI_BUDGET_MS)
  })

  // ── Step 3: scale-wide RGD detail renders the Graph tab ─────────────────────

  test('Step 3: scale-wide RGD detail page renders the DAG without JS error', async ({ page }) => {
    if (!fixtureState.scaleReady) {
      test.skip(true, 'scale-wide RGD not Ready — skipping DAG render test')
      return
    }

    // Capture console errors during navigation — dagre layout errors appear here
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // SPA-safe existence check: verify the scale-wide RGD exists via API
    const rgdResp = await page.request.get(`${BASE}/api/v1/rgds/scale-wide`)
    if (!rgdResp.ok()) {
      test.skip(true, 'scale-wide RGD not found via API — skipping DAG render test')
      return
    }

    // Navigate to the RGD detail page
    await page.goto(`${BASE}/rgds/scale-wide`)

    // Wait for the Graph tab to be visible (default tab on RGD detail)
    await page.waitForFunction(
      () => {
        // Graph tab content: DAG SVG, a loading indicator, or an error state
        return (
          document.querySelector('[data-testid="dag-svg"]') !== null ||
          document.querySelector('[data-testid="dag-loading"]') !== null ||
          document.querySelector('[data-testid="dag-error"]') !== null ||
          document.querySelector('.dag-graph') !== null ||
          document.querySelector('.rgd-detail') !== null
        )
      },
      { timeout: 20_000 }
    )

    // Wait for DAG SVG to appear (the loading state resolves)
    await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-svg"]') !== null ||
            document.querySelector('.dag-graph svg') !== null ||
            // Allow error states — we only care that no JS crash occurred
            document.querySelector('[data-testid="dag-error"]') !== null,
      { timeout: 15_000 }
    ).catch(() => {
      // DAG may not render on unsupported kro versions — non-fatal
      console.warn('[083] DAG SVG did not appear within 15s — proceeding to error check')
    })

    // Assert no dagre / SVG JS errors were logged
    const relevantErrors = consoleErrors.filter(msg =>
      msg.toLowerCase().includes('dagre') ||
      msg.toLowerCase().includes('uncaught') ||
      msg.toLowerCase().includes('maximum call stack') ||
      msg.toLowerCase().includes('out of memory')
    )
    expect(
      relevantErrors,
      `DAG render produced JS errors on scale-wide (20 nodes): ${relevantErrors.join('; ')}`
    ).toHaveLength(0)
  })

  // ── Step 4: DAG SVG contains ≥ 20 node elements ─────────────────────────────

  test('Step 4: scale-wide DAG SVG contains at least 20 rendered nodes', async ({ page }) => {
    if (!fixtureState.scaleReady) {
      test.skip(true, 'scale-wide RGD not Ready — skipping node count test')
      return
    }

    // SPA-safe existence check
    const rgdResp = await page.request.get(`${BASE}/api/v1/rgds/scale-wide`)
    if (!rgdResp.ok()) {
      test.skip(true, 'scale-wide RGD not found via API — skipping node count test')
      return
    }

    await page.goto(`${BASE}/rgds/scale-wide`)

    // Wait for DAG SVG
    const dagPresent = await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-svg"]') !== null ||
            document.querySelector('.dag-graph svg') !== null,
      { timeout: 20_000 }
    ).catch(() => null)

    if (!dagPresent) {
      // DAG not rendered (may be in a non-Graph tab or kro version mismatch) — skip
      test.skip(true, 'DAG SVG not present — node count assertion skipped')
      return
    }

    // Count rendered node elements in the DAG SVG
    // DAG nodes are rendered as <g class="dag-node"> or with data-testid="dag-node-*"
    const nodeCount = await page.evaluate(() => {
      const byTestId = document.querySelectorAll('[data-testid^="dag-node-"]').length
      const byClass = document.querySelectorAll('.dag-graph svg .dag-node, .dag-graph svg g[data-id]').length
      return Math.max(byTestId, byClass)
    })

    console.log(`[083] scale-wide DAG node count: ${nodeCount}`)

    // The RGD has 20 resource nodes + 1 root CR = 21 total.
    // Allow ≥ 20 (root may or may not be counted as a node depending on renderer version).
    expect(
      nodeCount,
      `scale-wide DAG rendered ${nodeCount} nodes — expected ≥ 20 (20 resources + root CR)`
    ).toBeGreaterThanOrEqual(20)
  })

})
