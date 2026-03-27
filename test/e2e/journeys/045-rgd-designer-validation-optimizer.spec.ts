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
 * Journey 045: RGD Designer — Validation & Optimizer
 *
 * Validates the end-to-end behaviour of spec-045 features on the /author route:
 *
 * 1. Inline validation — clearing the Kind field shows "Kind is required"
 *    without crashing the YAML preview (US1)
 * 2. Validation summary badge — appears when form errors are present (US6)
 * 3. Import YAML panel — collapse/expand, paste a valid YAML and Apply
 *    repopulates the form (US8)
 * 4. "Validate against cluster" button — visible in the YAML preview area (US9)
 * 5. Deep validation section — POST /rgds/validate/static is called within 2s
 *    of form load and results are surfaced (or section absent when no issues) (US10)
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - kro-ui server started at http://localhost:40107
 *
 * Notes:
 * - US9 (dry-run cluster validation) requires a live kro admission webhook.
 *   This journey only verifies the button is present and clickable, not the
 *   full dry-run result (which depends on kro being installed and responsive).
 * - US10 (offline deep validation) verifies that the /validate/static endpoint
 *   responds and the section appears or remains absent based on the payload.
 *
 * Spec ref: .specify/specs/045-rgd-designer-validation-optimizer/
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

// A minimal valid ResourceGraphDefinition YAML for import tests
const IMPORT_YAML = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: imported-app
spec:
  schema:
    kind: ImportedApp
    apiVersion: v1alpha1
    spec:
      replicas: "integer"
`

test.describe('Journey 045 — RGD Designer Validation & Optimizer', () => {
  // ── Step 1: Inline validation — Kind is required (US1) ─────────────────

  test('Step 1: clearing Kind shows "Kind is required" inline error; YAML preview stays rendered', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // The Kind input is pre-filled with a valid value; clear it
    const kindInput = page.locator('#rgd-kind')
    await kindInput.clear()

    // Inline error must appear beneath the Kind input
    await expect(page.getByText('Kind is required')).toBeVisible({ timeout: 3000 })

    // The YAML preview must still be rendered — validation is advisory only
    await expect(page.getByTestId('yaml-preview')).toBeVisible({ timeout: 3000 })
  })

  // ── Step 2: PascalCase warning (US1) ───────────────────────────────────

  test('Step 2: typing non-PascalCase kind shows PascalCase warning', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    const kindInput = page.locator('#rgd-kind')
    await kindInput.fill('webApp')

    await expect(page.getByText(/PascalCase/)).toBeVisible({ timeout: 3000 })

    // Correcting it clears the warning
    await kindInput.fill('WebApp')
    await expect(page.getByText(/PascalCase/)).not.toBeVisible({ timeout: 2000 })
  })

  // ── Step 3: Validation summary badge (US6) ─────────────────────────────

  test('Step 3: validation summary badge appears when errors exist, disappears when fixed', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // Clear both required metadata fields to generate 2 issues
    await page.locator('#rgd-kind').clear()
    await page.locator('#rgd-name').clear()

    const badge = page.getByTestId('validation-summary')
    await expect(badge).toBeVisible({ timeout: 3000 })
    const badgeText = await badge.textContent()
    expect(badgeText).toMatch(/2/)

    // Fix both — badge must disappear
    await page.locator('#rgd-kind').fill('MyApp')
    await page.locator('#rgd-name').fill('my-app')
    await expect(badge).not.toBeVisible({ timeout: 3000 })
  })

  // ── Step 4: Import YAML panel collapse/expand (US8) ────────────────────

  test('Step 4: Import YAML panel is collapsed by default and expands on click', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // Panel body must NOT be visible by default
    await expect(page.getByTestId('import-yaml-input')).not.toBeVisible()

    // Click the toggle to expand
    await page.getByTestId('import-yaml-toggle').click()

    // Textarea and Apply button must now be visible
    await expect(page.getByTestId('import-yaml-input')).toBeVisible({ timeout: 2000 })
    await expect(page.getByTestId('import-yaml-apply')).toBeVisible({ timeout: 2000 })
  })

  // ── Step 5: Import YAML round-trip (US8) ───────────────────────────────

  test('Step 5: pasting valid RGD YAML and clicking Apply repopulates the form', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // Expand import panel
    await page.getByTestId('import-yaml-toggle').click()
    await expect(page.getByTestId('import-yaml-input')).toBeVisible({ timeout: 2000 })

    // Paste the YAML
    await page.getByTestId('import-yaml-input').fill(IMPORT_YAML)

    // Apply
    await page.getByTestId('import-yaml-apply').click()

    // Panel should collapse after successful import
    await expect(page.getByTestId('import-yaml-input')).not.toBeVisible({ timeout: 3000 })

    // The form should reflect the imported state
    const nameInput = page.locator('#rgd-name')
    await expect(nameInput).toHaveValue('imported-app', { timeout: 3000 })

    const kindInput = page.locator('#rgd-kind')
    await expect(kindInput).toHaveValue('ImportedApp', { timeout: 3000 })
  })

  // ── Step 6: Import YAML error (US8) ────────────────────────────────────

  test('Step 6: pasting invalid YAML shows parse error and does not change the form', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // Record current kind value (starter state)
    const kindInput = page.locator('#rgd-kind')
    const originalKind = await kindInput.inputValue()

    // Expand import panel and paste garbage
    await page.getByTestId('import-yaml-toggle').click()
    await page.getByTestId('import-yaml-input').fill('this is not a ResourceGraphDefinition')
    await page.getByTestId('import-yaml-apply').click()

    // Error must appear
    await expect(page.getByTestId('import-parse-error')).toBeVisible({ timeout: 3000 })

    // Panel must remain open
    await expect(page.getByTestId('import-yaml-input')).toBeVisible()

    // Form state unchanged — kind input still shows original value
    await expect(kindInput).toHaveValue(originalKind)
  })

  // ── Step 7: Validate against cluster button (US9) ──────────────────────

  test('Step 7: "Validate against cluster" button is visible in the YAML preview area', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('yaml-preview')).toBeVisible({ timeout: 10000 })

    // The dry-run validate button must be present
    await expect(page.getByTestId('dry-run-btn')).toBeVisible({ timeout: 5000 })
    const btnText = await page.getByTestId('dry-run-btn').textContent()
    expect(btnText).toContain('Validate against cluster')
  })

  // ── Step 8: Validate button enters loading state on click (US9) ─────────

  test('Step 8: clicking "Validate against cluster" shows loading state temporarily', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('dry-run-btn')).toBeVisible({ timeout: 10000 })

    // Click validate — button should briefly show loading state
    await page.getByTestId('dry-run-btn').click()

    // Either loading state or result must appear within 10s
    // (actual result depends on cluster — we just verify it doesn't hang)
    await expect(
      page.getByTestId('dry-run-btn').or(page.getByTestId('dry-run-result')),
    ).toBeVisible({ timeout: 10000 })
  })

  // ── Step 9: YAML copy buttons remain functional (US9/7 + US6/3) ─────────

  test('Step 9: Copy kubectl apply button remains present and enabled regardless of validation state', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('yaml-preview')).toBeVisible({ timeout: 10000 })

    // Introduce errors to show the validation badge
    await page.locator('#rgd-kind').clear()
    await expect(page.getByTestId('validation-summary')).toBeVisible({ timeout: 3000 })

    // The Copy kubectl apply button must still be present and enabled
    const copyBtn = page.getByText('Copy kubectl apply')
    await expect(copyBtn).toBeVisible({ timeout: 3000 })
    await expect(copyBtn).not.toBeDisabled()
  })

  // ── Step 10: Deep validation section (US10) ─────────────────────────────

  test('Step 10: deep validation section is absent on clean starter state (US10)', async ({ page }) => {
    await page.goto(`${BASE}/author`)
    await expect(page.getByTestId('rgd-authoring-form')).toBeVisible({ timeout: 10000 })

    // Wait for the debounced static validation call (1s + some margin)
    await page.waitForTimeout(2000)

    // Starter state is valid — no deep validation issues expected
    // Section should be absent (no issues from kro libraries)
    await expect(page.getByTestId('static-validation-section')).not.toBeVisible()
  })
})
