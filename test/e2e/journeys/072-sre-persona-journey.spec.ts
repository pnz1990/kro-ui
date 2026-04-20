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
 * Journey 072: SRE Persona Journey
 *
 * Spec: .specify/specs/issue-458/spec.md
 * Design doc: docs/design/26-anchor-kro-ui.md §Present 26.2
 *
 * An end-to-end workflow following the SRE persona across the fleet anomaly
 * investigation path: Overview SRE dashboard → RGD compile-error widget →
 * RGD detail Errors tab → Instance detail → Events panel.
 *
 * This is an "anchor journey" — it validates DoD journeys 1 and 3 in a single
 * cross-feature workflow, complementing the per-feature journey suite.
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.9.0
 * - test-app RGD applied (Ready or Errored — either is valid for this journey)
 * - test-instance CR in namespace kro-ui-e2e (optional — Step 4/5 skip if absent)
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

test.describe('072: SRE Persona Journey', () => {

  // ── Step 1: Overview SRE dashboard renders ──────────────────────────────────

  test('Step 1: Overview renders SRE dashboard grid or onboarding empty state', async ({ page }) => {
    await page.goto(BASE)

    // Wait for the page to finish loading — SRE dashboard grid, onboarding, or error state
    await page.waitForFunction(() => {
      const grid = document.querySelector('.home__grid')
      const onboarding = document.querySelector('.home__onboarding')
      const err = document.querySelector('.home__error')
      return grid !== null || onboarding !== null || err !== null
    }, { timeout: 25000 })

    const gridVisible = await page.locator('.home__grid').isVisible().catch(() => false)
    const onboardingVisible = await page.locator('.home__onboarding').isVisible().catch(() => false)

    expect(gridVisible || onboardingVisible).toBe(true)
  })

  // ── Step 2: W-3 RGD compile errors widget is visible ────────────────────────

  test('Step 2: Overview shows W-3 RGD compile errors widget', async ({ page }) => {
    await page.goto(BASE)

    // Wait for the dashboard grid to load
    await page.waitForFunction(() => {
      return document.querySelector('.home__grid') !== null
    }, { timeout: 25000 })

    const gridVisible = await page.locator('.home__grid').isVisible().catch(() => false)
    if (!gridVisible) {
      test.skip(true, 'Overview dashboard grid not present on this cluster (onboarding state)')
      return
    }

    // W-3 RGD compile errors widget must be visible
    await expect(page.getByTestId('widget-rgd-errors')).toBeVisible({ timeout: 15000 })

    // W-1 Instance health widget also visible
    await expect(page.getByTestId('widget-instances')).toBeVisible()
  })

  // ── Step 3: RGD detail Errors tab renders ───────────────────────────────────

  test('Step 3: RGD detail Errors tab renders (errors, all-healthy, or empty)', async ({ page }) => {
    // SPA-safe existence check per constitution §XIV
    const rgdCheck = await page.request.get(`${BASE}/api/v1/rgds/${RGD_NAME}`)
    if (!rgdCheck.ok()) {
      test.skip(true, `${RGD_NAME} not present on this cluster`)
      return
    }

    await page.goto(`${BASE}/rgds/${RGD_NAME}?tab=errors`)

    // Wait for the Errors tab to be visible
    await page.waitForSelector('[data-testid="tab-errors"]', { timeout: 15000 })
    await expect(page.getByTestId('tab-errors')).toBeVisible()

    // Wait for the errors-tab panel to render (errors, all-healthy, empty, or loading→resolved)
    await page.waitForFunction(() => {
      const tab = document.querySelector('[data-testid="errors-tab"]')
      const empty = document.querySelector('[data-testid="errors-empty"]')
      const healthy = document.querySelector('[data-testid="errors-all-healthy"]')
      const group = document.querySelector('[data-testid="error-group"]')
      return tab !== null || empty !== null || healthy !== null || group !== null
    }, { timeout: 20000 })

    // At least one of the valid error-tab states is visible
    const errorsTab = await page.locator('[data-testid="errors-tab"]').isVisible().catch(() => false)
    const errorsEmpty = await page.locator('[data-testid="errors-empty"]').isVisible().catch(() => false)
    const errorsHealthy = await page.locator('[data-testid="errors-all-healthy"]').isVisible().catch(() => false)

    expect(errorsTab || errorsEmpty || errorsHealthy).toBe(true)
  })

  // ── Step 4: Instance detail page loads ──────────────────────────────────────

  test('Step 4: Instance detail page loads with page container', async ({ page }) => {
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

    // DAG renders after instance + RGD spec fetch
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20000 })
  })

  // ── Step 5: Events panel visible on instance detail ─────────────────────────

  test('Step 5: Instance detail events panel or empty state is visible', async ({ page }) => {
    const instanceCheck = await page.request.get(
      `${BASE}/api/v1/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`,
    )
    if (!instanceCheck.ok()) {
      test.skip(true, `${INSTANCE_NAME} in ${INSTANCE_NS} not present on this cluster`)
      return
    }

    const instanceUrl = `${BASE}/rgds/${RGD_NAME}/instances/${INSTANCE_NS}/${INSTANCE_NAME}`
    await page.goto(instanceUrl)

    // Wait for DAG to load (proves instance data is fetched)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: 20000 })

    // Events panel or empty state renders (constitution §XIV: waitForFunction)
    await page.waitForFunction(() => {
      const panel = document.querySelector('[data-testid="events-panel"]')
      const empty = document.querySelector('[data-testid="events-panel-empty"]')
      return panel !== null || empty !== null
    }, { timeout: 20000 })

    const panelVisible = await page.locator('[data-testid="events-panel"]').isVisible().catch(() => false)
    const emptyVisible = await page.locator('[data-testid="events-panel-empty"]').isVisible().catch(() => false)

    expect(panelVisible || emptyVisible).toBe(true)
  })

})
