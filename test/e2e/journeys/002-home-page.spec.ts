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
 * Journey 002: Home Page — RGD Card Grid and Navigation
 *
 * Validates that the home page renders RGD cards correctly, displays
 * the active context name, and navigates to graph/instances views.
 *
 * Spec ref: .specify/specs/002-rgd-list-home/spec.md § E2E User Journey
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied and Ready=True
 * - test-instance CR applied
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 002 — Home page RGD cards and navigation', () => {

  test('Step 1: Open the dashboard', async ({ page }) => {
    await page.goto(BASE)

    // Page title contains kro-ui
    await expect(page).toHaveTitle(/kro-ui/)

    // Top bar is visible and contains the kind cluster context name
    const contextName = page.getByTestId('context-name')
    await expect(contextName).toBeVisible()
    // The context name should be a non-empty string (kind cluster context)
    await expect(contextName).not.toHaveText('')
  })

  test('Step 2: RGD card renders', async ({ page }) => {
    await page.goto(BASE)

    // test-app card is visible
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Card shows correct name
    const name = card.getByTestId('rgd-name')
    await expect(name).toHaveText('test-app')

    // Card shows correct kind (from test fixture: WebApp)
    const kind = card.getByTestId('rgd-kind')
    await expect(kind).toHaveText('WebApp')

    // Status dot is visible and NOT in error state
    // (Ready condition may not be True yet — either alive or unknown is acceptable)
    const dot = card.getByTestId('status-dot')
    await expect(dot).toBeVisible()
    // Verify the dot does NOT have error class (healthy test RGD should not be red)
    await expect(dot).not.toHaveClass(/status-dot--error/)
  })

  test('Step 3: Navigate to RGD graph via Graph button', async ({ page }) => {
    await page.goto(BASE)

    // Wait for card to be visible
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Click Graph button
    const graphBtn = card.getByTestId('btn-graph')
    await graphBtn.click()

    // URL should be /rgds/test-app (React Router, no full reload)
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)

    // DAG SVG should be visible (stub from RGDDetail page)
    await expect(page.getByTestId('dag-svg')).toBeVisible()
  })

  test('Step 4: Navigate back and use Instances button', async ({ page }) => {
    await page.goto(BASE)

    // Wait for card
    const card = page.getByTestId('rgd-card-test-app')
    await expect(card).toBeVisible()

    // Navigate to Graph first
    await card.getByTestId('btn-graph').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app`)

    // Press browser back
    await page.goBack()
    await expect(page).toHaveURL(`${BASE}/`)

    // Card should still be visible
    await expect(page.getByTestId('rgd-card-test-app')).toBeVisible()

    // Click Instances button
    await page.getByTestId('rgd-card-test-app').getByTestId('btn-instances').click()
    await expect(page).toHaveURL(`${BASE}/rgds/test-app?tab=instances`)
  })
})
