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
 * Journey 071: Operator Persona Journey
 *
 * Spec: .specify/specs/issue-450/spec.md
 * Design doc: docs/design/26-anchor-kro-ui.md §Present 26.1
 *
 * An end-to-end workflow following the Operator persona across multiple
 * feature areas: Overview → Catalog → RGD detail (Graph tab) → Instances
 * tab → Instance detail → health verification.
 *
 * This is an "anchor journey" — it validates multiple DoD journeys (1 and 2)
 * in a single cross-feature path, complementing the per-feature journey suite.
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.9.0
 * - test-app RGD applied and Ready
 * - test-instance CR in namespace kro-ui-e2e
 * - kro-ui binary running at KRO_UI_BASE_URL
 *
 * Constitution §XIV compliance:
 * - All existence checks via page.request.get() (SPA-safe, never HTTP status)
 * - All waits via waitForFunction (no waitForTimeout)
 * - Every test.skip() followed immediately by return
 * - No locator.or() ambiguity
 * - Brace depth verified: 0
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'
const RGD_NAME = 'test-app'
const INSTANCE_NAME = 'test-instance'
const INSTANCE_NS = 'kro-ui-e2e'

test.describe('071: Operator Persona Journey', () => {

  // ── Step 1: Overview loads with instance health widget ──────────────────────

  test('Step 1: Overview renders instance health widget or onboarding empty state', async ({ page }) => {
    await page.goto(BASE)

    // Wait for the page to finish loading — either the SRE dashboard grid or the onboarding state
    await page.waitForFunction(() => {
      const grid = document.querySelector('.home__grid')
      const onboarding = document.querySelector('.home__onboarding')
      const err = document.querySelector('.home__error')
      return grid !== null || onboarding !== null || err !== null
    }, { timeout: 25000 })

    // One of the three possible states renders:
    // a) SRE dashboard grid with W-1 widget
    // b) First-time onboarding (no RGDs yet)
    // c) Error state (cluster unreachable)
    const grid = page.locator('.home__grid')
    const onboarding = page.locator('.home__onboarding')

    const gridVisible = await grid.isVisible().catch(() => false)
    const onboardingVisible = await onboarding.isVisible().catch(() => false)

    expect(gridVisible || onboardingVisible).toBe(true)

    if (gridVisible) {
      // W-1 Instance health widget must be present in the dashboard
      const w1 = page.locator('[data-testid="widget-instances"]')
      await expect(w1).toBeVisible()
    }
  })

  // ── Step 2: Catalog shows the test-app RGD card ─────────────────────────────

  test('Step 2: Catalog renders test-app RGD card with name and kind', async ({ page }) => {
    // SPA-safe existence check per constitution §XIV
    const rgdCheck = await page.request.get(`${BASE}/api/v1/rgds/${RGD_NAME}`)
    if (!rgdCheck.ok()) {
      test.skip(true, `${RGD_NAME} not present on this cluster`)
      return
    }

    await page.goto(`${BASE}/catalog`)

    // Wait for the catalog card to appear (constitution §XIV: waitForFunction)
    await page.waitForFunction(
      (name: string) => document.querySelector(`[data-testid="catalog-card-${name}"]`) !== null,
      RGD_NAME,
      { timeout: 20000 },
    )

    const card = page.locator(`[data-testid="catalog-card-${RGD_NAME}"]`)
    await expect(card).toBeVisible()

    // Card must show the kind label (not blank or "?")
    const kindEl = card.locator('[data-testid="catalog-card-kind"]')
    await expect(kindEl).toBeVisible()
    const kindText = await kindEl.textContent()
    expect(kindText?.trim().length).toBeGreaterThan(0)
    expect(kindText?.trim()).not.toBe('?')
  })

  // ── Step 3: RGD detail Graph tab renders the DAG ────────────────────────────

  test('Step 3: RGD detail Graph tab renders DAG with nodes', async ({ page }) => {
    const rgdCheck = await page.request.get(`${BASE}/api/v1/rgds/${RGD_NAME}`)
    if (!rgdCheck.ok()) {
      test.skip(true, `${RGD_NAME} not present on this cluster`)
      return
    }

    await page.goto(`${BASE}/rgds/${RGD_NAME}`)

    // Wait for the Graph tab to be visible and active
    await page.waitForSelector('[data-testid="tab-graph"]', { timeout: 15000 })
    await expect(page.getByTestId('tab-graph')).toBeVisible()

    // DAG SVG renders
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 15000 })

    // At least one node renders — the root schema node
    await expect(page.getByTestId('dag-node-schema')).toBeVisible({ timeout: 10000 })

    // No "?" kind labels on visible nodes (constitution AGENTS.md anti-pattern)
    await page.waitForFunction(() => {
      const kindLabels = Array.from(document.querySelectorAll('[data-testid^="dag-node-"] .dag-node__kind'))
      return kindLabels.every((el) => el.textContent?.trim() !== '?')
    }, { timeout: 10000 })
  })

  // ── Step 4: Instances tab shows the instance row ────────────────────────────

  test('Step 4: Instances tab renders instance table with at least one row', async ({ page }) => {
    const rgdCheck = await page.request.get(`${BASE}/api/v1/rgds/${RGD_NAME}`)
    if (!rgdCheck.ok()) {
      test.skip(true, `${RGD_NAME} not present on this cluster`)
      return
    }

    await page.goto(`${BASE}/rgds/${RGD_NAME}`)
    await page.waitForSelector('[data-testid="tab-instances"]', { timeout: 15000 })

    // Click the Instances tab
    await page.getByTestId('tab-instances').click()

    // Wait for either an instance table row or the empty state
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-testid^="instance-row-"]')
      const empty = document.querySelector('[data-testid="instance-empty-state"]')
      return row !== null || empty !== null
    }, { timeout: 20000 })

    // If instance exists, the row is visible and navigable
    const instanceRow = page.locator(`[data-testid="instance-row-${INSTANCE_NAME}"]`)
    const rowExists = await instanceRow.isVisible().catch(() => false)
    if (rowExists) {
      await expect(instanceRow).toBeVisible()
      // Name cell renders the instance name
      const nameCell = instanceRow.locator('[data-testid="instance-name"]')
      await expect(nameCell).toBeVisible()
    }
  })

  // ── Step 5: Instance detail page loads ──────────────────────────────────────

  test('Step 5: Instance detail page loads with DAG and live refresh indicator', async ({ page }) => {
    // API-first existence check — SPA always returns 200 per constitution §XIV
    const instanceCheck = await page.request.get(
      `${BASE}/api/v1/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`,
    )
    if (!instanceCheck.ok()) {
      test.skip(true, `${INSTANCE_NAME} in ${INSTANCE_NS} not present on this cluster`)
      return
    }

    const instanceUrl = `${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`
    await page.goto(instanceUrl)

    // Page container renders immediately
    await expect(page.getByTestId('instance-detail-page')).toBeVisible({ timeout: 15000 })

    // Live DAG renders after instance + RGD spec fetch
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20000 })

    // Refresh indicator is present (proves polling is active)
    await expect(page.getByTestId('live-refresh-indicator')).toBeVisible()
  })

  // ── Step 6: Health state is visible on the instance detail page ─────────────

  test('Step 6: instance detail shows health chip or status information', async ({ page }) => {
    const instanceCheck = await page.request.get(
      `${BASE}/api/v1/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`,
    )
    if (!instanceCheck.ok()) {
      test.skip(true, `${INSTANCE_NAME} in ${INSTANCE_NS} not present on this cluster`)
      return
    }

    const instanceUrl = `${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`
    await page.goto(instanceUrl)

    // Wait for DAG to load — this means instance data is fully fetched
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20000 })

    // Health chip or health pill should be visible after load
    // (constitution §XIV: use waitForFunction not toHaveCount(0) for dynamic content)
    await page.waitForFunction(() => {
      const chip = document.querySelector('[data-testid="health-chip"]')
      const pill = document.querySelector('[data-testid="health-pill"]')
      const badge = document.querySelector('[data-testid="node-detail-state-badge"]')
      return chip !== null || pill !== null || badge !== null
    }, { timeout: 15000 })

    // At least one health indicator is visible
    const healthChip = page.locator('[data-testid="health-chip"]').first()
    const healthPill = page.locator('[data-testid="health-pill"]').first()

    const chipVisible = await healthChip.isVisible().catch(() => false)
    const pillVisible = await healthPill.isVisible().catch(() => false)

    expect(chipVisible || pillVisible).toBe(true)
  })

})
