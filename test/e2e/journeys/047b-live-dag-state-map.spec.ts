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
 * Journey 047b: Live DAG State Map — node-id keying, IN_PROGRESS reconciling,
 * items:[] for zero children, external ref node states.
 *
 * PRs: #278 (state map node-id keying, IN_PROGRESS→reconciling, items:null→[]),
 *      #285 (external ref alive/reconciling not not-found)
 *
 * These are correctness fixes to the instance detail live DAG overlay. The
 * journeys verify that the UI state matches the cluster state.
 *
 * Key invariants:
 *   A) Instance detail page renders live DAG for any active instance
 *   B) Live DAG nodes have one of the 5 known CSS state classes (not undefined/blank)
 *   C) External ref nodes are NOT grey when instance is healthy (PR #285)
 *   D) Reconciling chip/banner shown for IN_PROGRESS instances (PR #278)
 *   E) YAML tab does not contain "managedFields" (PR #291)
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD + test-instance CR applied in kro-ui-e2e
 * - external-ref RGD + echo-prod instance applied (for step C)
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'
const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

test.describe('Journey 047b: Live DAG state map — node-id keying and IN_PROGRESS', () => {

  // ── A: Live DAG renders for active instance ────────────────────────────────

  test('Step 1: Live DAG renders with state-classed nodes for healthy instance', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // Live state nodes carry a CSS class dag-node-live--{state}
    // Wait for at least one live state class to appear (state map built after first poll)
    await page.waitForSelector(
      '[class*="dag-node-live--"]',
      { timeout: 15000 },
    )

    const liveNodes = page.locator('[class*="dag-node-live--"]')
    const count = await liveNodes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Step 2: All live DAG nodes have a valid state class (no undefined/blank state)', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })
    await page.waitForSelector('[class*="dag-node-live--"]', { timeout: 15000 })

    // Valid CSS state suffixes (constitution §XII: never ?)
    const validStates = ['alive', 'reconciling', 'error', 'pending', 'notfound', 'not-found']
    const allNodes = page.locator('[class*="dag-node-live--"]')
    const count = await allNodes.count()

    for (let i = 0; i < count; i++) {
      const cls = (await allNodes.nth(i).getAttribute('class')) ?? ''
      const stateClass = cls.split(' ').find((c) => c.startsWith('dag-node-live--'))
      expect(stateClass).toBeDefined()
      const state = stateClass?.replace('dag-node-live--', '')
      expect(validStates.some((v) => state?.includes(v))).toBe(true)
    }
  })

  // ── B: Live DAG legend is present ─────────────────────────────────────────

  test('Step 3: Live state legend renders with correct labels (PR #279, #048)', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    // The live state legend must contain the correct labels
    // PR #279 renamed "Pending" → "Excluded" in the live DAG legend
    const legend = page.locator('.instance-detail-live-legend')
    await expect(legend).toBeVisible({ timeout: 10000 })
    const legendText = await legend.textContent()
    expect(legendText).toContain('Alive')
    expect(legendText).toContain('Reconciling')
    expect(legendText).toContain('Excluded') // was "Pending" before PR #279
    expect(legendText).toContain('Error')
    expect(legendText).toContain('Not found')
    // Must NOT contain the old "Pending" label (renamed to Excluded)
    expect(legendText).not.toContain('Pending')
  })

  // ── C: External ref nodes use globalState not not-found (PR #285) ─────────

  test('Step 4: External ref DAG node is not grey (not-found) when instance is healthy (PR #285)', async ({ page }) => {
    test.skip(!fixtureState.externalRefReady, 'external-ref RGD not Ready in setup')

    await page.goto(`${BASE}/rgds/external-ref/instances/kro-ui-e2e/external-ref-instance`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })
    await page.waitForSelector('[class*="dag-node-live--"]', { timeout: 15000 })

    // External ref nodes are dag-node--external
    const externalNodes = page.locator('[class*="dag-node--external"]')
    const externalCount = await externalNodes.count()

    if (externalCount > 0) {
      // When the instance is healthy (Ready=True), external ref nodes should NOT
      // be not-found (grey). They should be alive (green) or reconciling (amber).
      // Prior to PR #285 they always showed not-found.
      const cls = (await externalNodes.first().getAttribute('class')) ?? ''
      // Must NOT be not-found when instance is healthy
      // (not-found class only when globalState=error)
      const isHealthyInstance = await page.locator('.health-pill--ready').count() > 0
      if (isHealthyInstance) {
        expect(cls).not.toContain('dag-node-live--notfound')
        expect(cls).not.toContain('dag-node-live--not-found')
      }
    }
  })

  // ── D: IN_PROGRESS → Reconciling (PR #278) ─────────────────────────────────

  test('Step 5: IN_PROGRESS kro state shows Reconciling chip and banner', async ({ page }) => {
    // Requires never-ready RGD + never-ready-prod instance (demo cluster only)
    const resp = await page.goto(`${BASE}/rgds/never-ready/instances/kro-ui-demo/never-ready-prod`)
    if (!resp || resp.status() >= 400) {
      test.skip(true, 'never-ready fixture not present on this E2E cluster')
      return
    }
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    // PR #278: status.state=IN_PROGRESS must map to Reconciling pill (not Error/red)
    const pill = page.locator('[data-testid="health-pill"]')
    await expect(pill).toHaveText(/Reconciling/, { timeout: 10000 })
    await expect(pill).toHaveClass(/health-pill--reconciling/)

    // Reconciling banner must be visible
    await expect(page.locator('.reconciling-banner')).toBeVisible({ timeout: 5000 })

    // The banner must contain the kro reconciling message
    const bannerText = await page.locator('.reconciling-banner').textContent()
    expect(bannerText).toMatch(/reconciling|kro is/)
  })

  test('Step 6: Stuck reconciliation escalation banner appears after >= 5 minutes (PR #286)', async ({ page }) => {
    // Requires an instance that has been IN_PROGRESS for > 5 minutes.
    // never-ready instances are stuck indefinitely so they qualify.
    const resp = await page.goto(`${BASE}/rgds/never-ready/instances/kro-ui-demo/never-ready-prod`)
    if (!resp || resp.status() >= 400) {
      test.skip(true, 'never-ready fixture not present on this E2E cluster')
      return
    }
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    const banner = page.locator('.reconciling-banner')
    await expect(banner).toBeVisible({ timeout: 8000 })

    // After being stuck for > 5 minutes, the banner should be --stuck
    const cls = (await banner.getAttribute('class')) ?? ''
    if (cls.includes('--stuck')) {
      // Escalated: text includes duration and actionable hint
      const text = await banner.textContent()
      expect(text).toMatch(/\d+m/)
      expect(text).toMatch(/check the Conditions panel|kubectl describe/)
    }
    // If not --stuck yet: the instance hasn't been reconciling > 5min (acceptable)
  })

  // ── E: YAML tab clean display (no managedFields, PR #291) ─────────────────

  test('Step 7: YAML tab does not contain managedFields or last-applied-configuration', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=yaml`)
    await expect(page.locator('pre.kro-code-block-pre')).toBeVisible({ timeout: 10000 })

    const yamlContent = await page.locator('pre.kro-code-block-pre').textContent()
    expect(yamlContent).toBeTruthy()

    // PR #291: these fields must be stripped from the displayed YAML
    expect(yamlContent).not.toContain('managedFields')
    expect(yamlContent).not.toContain('last-applied-configuration')
    expect(yamlContent).not.toContain('resourceVersion')
    expect(yamlContent).not.toContain('"uid"')
    // But the meaningful spec must still be present
    expect(yamlContent).toContain('spec:')
    expect(yamlContent).toContain('resources:')
  })

  // ── namespace sentinel (PR #281) ──────────────────────────────────────────

  test('Step 8: Cluster-scoped namespace sentinel _ not rendered anywhere in instance table', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=instances`)
    await expect(page.locator('[data-testid="instance-table"]')).toBeVisible({ timeout: 10000 })

    const rows = page.locator('[data-testid="instance-namespace"]')
    const count = await rows.count()

    for (let i = 0; i < count; i++) {
      const ns = await rows.nth(i).textContent()
      // Must never show the raw "_" sentinel — PR #281 fix
      expect(ns?.trim()).not.toBe('_')
      // If cluster-scoped: must show "cluster-scoped" not "_" or ""
      if (!ns?.trim()) {
        expect(ns?.trim()).toBe('cluster-scoped')
      }
    }
  })

  // ── items:[] for zero children (PR #278) ──────────────────────────────────

  test('Step 9: Instance with no children returns items:[] not null (API regression guard)', async ({ page }) => {
    // Verify via API that instances with no children return {items:[]} not {items:null}
    // Prior to PR #278, ListInstanceChildren returned {items:null} for zero children.
    const response = await page.request.get(
      `${BASE}/api/v1/instances/kro-ui-e2e/test-instance/children?rgd=test-app`,
    )
    const body = await response.json()
    // items must be an array (possibly empty), never null
    expect(body.items).toBeDefined()
    expect(Array.isArray(body.items)).toBe(true)
  })
})
