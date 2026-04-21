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
 * Journey 074: Accessibility — axe-core assertions on Tier 1 + Tier 2 pages
 *
 * Runs WCAG 2.1 AA axe-core scans on 8 pages:
 * Tier 1 (original):
 * - RGD list (Catalog page — /catalog)
 * - RGD DAG view (/rgds/test-app)
 * - Instance list (/rgds/test-app/instances)
 * - Context switcher (top bar present on all pages)
 *
 * Tier 2 (spec issue-581):
 * - Overview / SRE dashboard (/)
 * - Fleet view (/fleet)
 * - RGD Designer (/author)
 * - Errors tab (/rgds/test-app?tab=errors)
 *
 * Design ref: docs/design/30-health-system.md §Future
 *   "Accessibility audit expansion: journey 074 covers only 4 Tier-1 pages"
 *
 * Spec: .specify/specs/issue-581/spec.md
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.9.0
 * - test-app RGD applied and Ready
 * - kro-ui binary running at KRO_UI_BASE_URL
 *
 * Note: axe violations are reported as test failures. critical and serious
 * violations block; minor/moderate are informational (reviewed in the HTML report).
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixtureState } from '../fixture-state'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

// Only block on critical + serious violations.
// Minor/moderate are surfaced in the HTML report but do not fail CI.
// This threshold prevents noise from browser-specific rendering quirks.
const CRITICAL_IMPACT_LEVELS = ['critical', 'serious'] as const

function assertNoViolations(violations: Array<{ impact?: string | null; id: string; description: string; nodes: unknown[] }>) {
  const blocking = violations.filter(
    (v) => v.impact && (CRITICAL_IMPACT_LEVELS as readonly string[]).includes(v.impact),
  )
  if (blocking.length > 0) {
    const summary = blocking
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
      .join('\n')
    expect(blocking).toHaveLength(0, `Axe found ${blocking.length} critical/serious violation(s):\n${summary}`)
  }
}

test.describe('Journey 074 — Accessibility (axe-core WCAG 2.1 AA)', () => {

  // ── Step 1: RGD list (Catalog page) ────────────────────────────────────────

  test('Step 1: Catalog page has no critical/serious axe violations', async ({ page }) => {
    test.skip(!fixtureState.testAppReady, 'test-app not Ready — skipping Catalog axe scan')

    await page.goto(`${BASE}/catalog`)
    // Wait for catalog cards to render
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="catalog-card-"]') !== null ||
             document.querySelector('[class*="catalog"]') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    assertNoViolations(results.violations)
    // Informational: log total violation count even if not blocking
    console.log(`Catalog axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 2: RGD DAG view ─────────────────────────────────────────────────────

  test('Step 2: RGD DAG page has no critical/serious axe violations', async ({ page }) => {
    test.skip(!fixtureState.testAppReady, 'test-app not Ready — skipping DAG axe scan')

    await page.goto(`${BASE}/rgds/test-app`)
    // Wait for DAG SVG to render
    await page.waitForFunction(
      () => document.querySelector('[data-testid="dag-svg"]') !== null ||
             document.querySelector('svg') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-testid="dag-svg"]')  // SVG graph: complex custom widget, separate audit
      .analyze()

    assertNoViolations(results.violations)
    console.log(`DAG axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 3: Instance list ──────────────────────────────────────────────────

  test('Step 3: Instance list page has no critical/serious axe violations', async ({ page }) => {
    test.skip(!fixtureState.testAppReady, 'test-app not Ready — skipping instance list axe scan')

    await page.goto(`${BASE}/rgds/test-app/instances`)
    // Wait for instance table or empty state
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="instance-row-"]') !== null ||
             document.querySelector('[data-testid="instance-list-empty"]') !== null ||
             document.querySelector('[class*="instance"]') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Instance list axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 4: Context switcher (top bar) ────────────────────────────────────

  test('Step 4: Context switcher (top bar) has no critical/serious axe violations', async ({ page }) => {
    await page.goto(BASE)
    // Wait for top bar to render
    await page.waitForFunction(
      () => document.querySelector('[data-testid="context-switcher-btn"]') !== null ||
             document.querySelector('header, nav, [role="banner"]') !== null,
      { timeout: 15000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('header, nav, [role="banner"], [data-testid="context-switcher-btn"]')
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Context switcher axe: ${results.violations.length} total violations.`)
  })

  // ── Step 5: Overview / SRE dashboard (spec issue-581 O3) ──────────────────

  test('Step 5: Overview (SRE dashboard) has no critical/serious axe violations', async ({ page }) => {
    await page.goto(BASE)
    // Wait for Overview content: health summary bar or overview page container
    await page.waitForFunction(
      () => document.querySelector('[data-testid="overview-page"]') !== null ||
             document.querySelector('[data-testid="overview-health-bar"]') !== null ||
             document.querySelector('[class*="overview"]') !== null ||
             document.querySelector('main') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Overview axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 6: Fleet view (spec issue-581 O2) ────────────────────────────────

  test('Step 6: Fleet view has no critical/serious axe violations', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    // Wait for fleet cards or empty state
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="fleet-card-"]') !== null ||
             document.querySelector('[class*="fleet"]') !== null ||
             document.querySelector('main') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Fleet axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 7: RGD Designer (/author) (spec issue-581 O1) ────────────────────

  test('Step 7: RGD Designer (/author) has no critical/serious axe violations', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    // Wait for Designer canvas or main content to render
    await page.waitForFunction(
      () => document.querySelector('[data-testid="designer-canvas"]') !== null ||
             document.querySelector('[class*="designer"]') !== null ||
             // The Designer page renders node-type buttons in a sidebar
             document.querySelector('[class*="author"]') !== null ||
             document.querySelector('main') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('svg')  // Designer DAG preview: complex SVG widget, separate audit
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Designer axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

  // ── Step 8: Errors tab on RGD detail (spec issue-581 O4) ─────────────────

  test('Step 8: Errors tab on RGD detail has no critical/serious axe violations', async ({ page }) => {
    test.skip(!fixtureState.testAppReady, 'test-app not Ready — skipping Errors tab axe scan')

    await page.goto(`${BASE}/rgds/test-app?tab=errors`)
    // Wait for Errors tab content or empty state
    await page.waitForFunction(
      () => document.querySelector('[data-testid="errors-tab"]') !== null ||
             document.querySelector('[class*="errors"]') !== null ||
             // Tab content renders in a panel; wait for any main content
             document.querySelector('[role="tabpanel"]') !== null ||
             document.querySelector('main') !== null,
      { timeout: 20000 },
    ).catch(() => {})

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    assertNoViolations(results.violations)
    console.log(`Errors tab axe: ${results.violations.length} total violations, ` +
      `${results.passes.length} passes.`)
  })

})
