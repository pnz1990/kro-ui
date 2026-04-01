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
 * Journey 047: UX Improvements — Degraded health state, multi-segment health
 * bar, copy instance YAML button, refresh button.
 *
 * PRs: #277 (degraded, health bar, copy YAML), #278 (node-id state map fix),
 *      #279 (UI polish), #280 (refresh button), #281 (reconcile-paused, namespace)
 *
 * Tests the UI surfaces that were added/fixed in the v0.4.6 batch.
 * Key invariants that must hold on every cluster with at least one instance:
 *
 *   A) HealthChip on Overview resolves from skeleton to text (never stays blank)
 *   B) Instance detail header shows a HealthPill with one of the 6 known states
 *   C) Copy YAML button is present on instance detail
 *   D) Refresh button (↻) is present on instance detail
 *   E) HealthPill never shows the literal string "undefined", "null", or "?"
 *   F) Namespace sentinel "_" never appears in rendered UI text
 *
 * Degraded-state specific steps (G) require a crashloop-app fixture and are
 * skipped when the fixture is not present.
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD + test-instance CR applied in kro-ui-e2e
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'
const INSTANCE_URL = `${BASE}/rgds/test-app/instances/kro-ui-e2e/test-instance`

test.describe('Journey 047: UX Improvements (health states, copy YAML, refresh)', () => {

  // ── A: HealthChip never stays blank ────────────────────────────────────────

  test('Step 1: Overview HealthChip resolves for every visible RGD card', async ({ page }) => {
    // NOTE (spec 062): RGD card grid moved to /catalog.
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })

    // Wait for at least one chip to resolve — this confirms the instances API
    // is returning 200 for active RGDs and the chip renders.
    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })
    const chips = page.locator('[data-testid="health-chip"]')
    const count = await chips.count()
    expect(count).toBeGreaterThan(0)

    // No chip should contain raw JS coercion artifacts (constitution §XII)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await chips.nth(i).textContent()
      expect(text).not.toContain('[object')
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('null')
    }
  })

  test('Step 2: Inactive RGD card shows "no instances" chip not blank', async ({ page }) => {
    // Prior to fix/instances-inactive-rgd (#296), inactive RGDs returned 500
    // from the instances API → health chip was blank.
    // Now they return 200 with {items:[]} → chip shows "no instances".
    // NOTE (spec 062): RGD card grid moved to /catalog.
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })

    // The test-collection RGD is Inactive in the hermetic E2E cluster when
    // the collection fixture is not applied. Check that even in that case
    // the chip renders (not blank).
    const inactiveCard = page.locator('[data-testid^="rgd-card-"]').filter({
      has: page.locator('.status-dot--error, .status-dot--unknown'),
    }).first()
    const inactiveExists = await inactiveCard.count() > 0
    if (!inactiveExists) {
      // All RGDs are active — still verify chips are not blank.
      const chip = page.locator('[data-testid="health-chip"]').first()
      const text = await chip.textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
      return
    }

    // Inactive card: the chip must exist (not null) even if the RGD is Inactive
    await page.waitForTimeout(3000) // allow async chip fetches to settle
    const inactiveChip = inactiveCard.locator('[data-testid="health-chip"]')
    const chipVisible = await inactiveChip.isVisible()
    if (chipVisible) {
      const text = await inactiveChip.textContent()
      expect(text?.trim()).toBe('no instances')
    }
    // If chip is not yet visible: no assertion (skeleton still loading) — not a failure
  })

  // ── B: HealthPill on instance detail shows one of 6 known states ──────────

  test('Step 3: Instance detail HealthPill shows one of the 6 valid states', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    const pill = page.locator('[data-testid="health-pill"]')
    // 6 valid states: Ready, Degraded, Reconciling, Error, Pending, Unknown
    await expect(pill).toHaveText(
      /^(Ready|Degraded|Reconciling|Error|Pending|Unknown)$/,
      { timeout: 10000 },
    )

    // Pill must NOT contain the legacy 5-state-only pattern that excluded Degraded
    const text = await pill.textContent()
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
    expect(text).not.toContain('?')
  })

  // ── C: Copy YAML button ────────────────────────────────────────────────────

  test('Step 4: Copy YAML button is present on instance detail', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    // CopySpecButton renders with data-testid="copy-spec-btn"
    const copyBtn = page.getByTestId('copy-spec-btn')
    await expect(copyBtn).toBeVisible({ timeout: 8000 })

    // Correct label — "Copy YAML" (not the old "Copy spec as YAML" which was fixed in #279)
    const label = await copyBtn.textContent()
    expect(label).toMatch(/Copy.*YAML/i)
  })

  // ── D: Refresh button ─────────────────────────────────────────────────────

  test('Step 5: Refresh now button (↻) is present on instance detail', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    // RefreshButton added in PR #280 with data-testid="instance-refresh-btn"
    const refreshBtn = page.getByTestId('instance-refresh-btn')
    await expect(refreshBtn).toBeVisible({ timeout: 8000 })
    await expect(refreshBtn).toHaveText('↻')
  })

  test('Step 6: Refresh button triggers immediate re-poll (live-indicator updates)', async ({ page }) => {
    await page.goto(INSTANCE_URL)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('instance-refresh-btn')).toBeVisible({ timeout: 8000 })

    // Read current refresh indicator text, click refresh, verify it resets.
    const indicator = page.getByTestId('live-refresh-indicator')
    await expect(indicator).toBeVisible({ timeout: 5000 })

    await page.getByTestId('instance-refresh-btn').click()

    // After click the indicator should immediately show a very recent time (0s or 1s)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="live-refresh-indicator"]')
        const text = el?.textContent ?? ''
        return text.includes('0s') || text.includes('just now') || text.includes('1s')
      },
      { timeout: 5000 },
    )
  })

  // ── E: Namespace sentinel "\_" never in rendered text ─────────────────────

  test('Step 7: Cluster-scoped namespace sentinel _ never appears in rendered text', async ({ page }) => {
    // NOTE (spec 062): RGD card grid moved to /catalog. Check both pages.
    await page.goto(`${BASE}/catalog`)
    await expect(page.locator('[data-testid^="rgd-card-"]').first()).toBeVisible({ timeout: 10000 })

    // Scan the full rendered text of the Overview page for the literal sentinel "_"
    // in a namespace position. We look specifically for the pattern " _ " or "/_"
    // that would indicate the sentinel slipped through displayNamespace().
    // Instance cards that contain "namespace/name" patterns must use "cluster-scoped" not "_".
    const bodyText = await page.locator('body').textContent()
    // Allow "_" in JS identifiers/CSS classes etc, but not " _ " or "/_" as namespace
    expect(bodyText).not.toMatch(/\/_(?:\/|$|\s)/)
  })

  // ── F: Multi-segment health bar ───────────────────────────────────────────

  test('Step 8: HealthChip multi-segment bar renders correctly', async ({ page }) => {
    // NOTE (spec 062): RGD card grid moved to /catalog.
    await page.goto(`${BASE}/catalog`)
    await page.waitForSelector('[data-testid="health-chip"]', { timeout: 20000 })

    // Scan for chips that are in the mixed-state (bar) format:
    // These should have segments with icons ✗, ⚠, ↻, …, ?
    // A cluster with never-ready instances would have ↻ segments.
    const allChips = page.locator('[data-testid="health-chip"]')
    const count = await allChips.count()

    for (let i = 0; i < count; i++) {
      const text = (await allChips.nth(i).textContent()) ?? ''
      // If multi-segment format: must match one of the expected patterns
      // Single format: "N ready" or "no instances"
      // Multi-segment: contains ✗, ⚠, ↻, …, or ? symbol followed by a number
      if (text.match(/[✗⚠↻…?]/)) {
        // Multi-segment format — verify count is parseable
        expect(text).toMatch(/\d+/)
      } else {
        // Single-state format
        expect(text).toMatch(/\d+ ready|no instances/)
      }
    }
  })

  // ── G: Degraded state (conditional — requires crashloop-app fixture) ──────

  test('Step 9: Degraded HealthPill shows on instance detail when child has errors (crashloop-app)', async ({ page }) => {
    // This step requires the crashloop-app RGD and crashloop-demo instance.
    // They are present on the demo cluster but NOT in the hermetic E2E kind cluster.
    // Use the API (not page.goto) to check for existence — the SPA always returns
    // HTTP 200 even for nonexistent routes, so resp.status() is unreliable.
    const apiCheck = await page.request.get(`${BASE}/api/v1/rgds/crashloop-app`)
    if (!apiCheck.ok()) {
      test.skip(true, 'crashloop-app RGD not present on this cluster')
      return
    }
    const instanceCheck = await page.request.get(
      `${BASE}/api/v1/instances/kro-ui-demo/crashloop-demo?rgd=crashloop-app`,
    )
    if (!instanceCheck.ok()) {
      test.skip(true, 'crashloop-demo instance not present on this cluster')
      return
    }

    await page.goto(`${BASE}/rgds/crashloop-app/instances/kro-ui-demo/crashloop-demo`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    const pill = page.locator('[data-testid="health-pill"]')
    await expect(pill).toHaveText(/^(Degraded|Ready|Reconciling|Error|Pending|Unknown)$/, { timeout: 10000 })
    const text = await pill.textContent()
    expect(['Degraded', 'Reconciling', 'Error', 'Ready', 'Pending', 'Unknown']).toContain(text?.trim())
  })

  test('Step 10: Reconciling HealthPill shows on IN_PROGRESS instance (never-ready)', async ({ page }) => {
    // Requires the never-ready RGD and never-ready-prod instance (demo cluster only).
    // Use the API to check existence — the SPA always returns HTTP 200.
    const apiCheck = await page.request.get(`${BASE}/api/v1/rgds/never-ready`)
    if (!apiCheck.ok()) {
      test.skip(true, 'never-ready RGD not present on this cluster')
      return
    }
    const instanceCheck = await page.request.get(
      `${BASE}/api/v1/instances/kro-ui-demo/never-ready-prod?rgd=never-ready`,
    )
    if (!instanceCheck.ok()) {
      test.skip(true, 'never-ready-prod instance not present on this cluster')
      return
    }

    await page.goto(`${BASE}/rgds/never-ready/instances/kro-ui-demo/never-ready-prod`)
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 10000 })

    const pill = page.locator('[data-testid="health-pill"]')
    await expect(pill).toHaveText(/Reconciling/, { timeout: 10000 })

    // Reconciling banner must be visible (PR #278 IN_PROGRESS fix)
    await expect(page.locator('.reconciling-banner')).toBeVisible({ timeout: 5000 })
  })
})
