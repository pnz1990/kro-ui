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
 * Journey 026: RGD YAML Generator
 *
 * Validates that the Generate tab on the RGD detail page:
 * - Is accessible and clickable
 * - Renders the generate-tab container with Form and Batch mode buttons
 * - Form mode shows the instance form with field inputs
 * - Filling a form field updates the YAML preview output
 * - Batch mode renders the batch form
 * - Copy button is present in the YAML preview
 *
 * Spec ref: .specify/specs/026-rgd-yaml-generator/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (has spec fields appName and enableConfig)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 026 — RGD YAML Generator', () => {
  test('Step 1: Generate tab is present and clickable on test-app RGD', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('tab-generate')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('tab-generate').click()
    await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-selected', 'true')
  })

  test('Step 2: Generate tab renders mode buttons — Form and Batch', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await expect(page.getByTestId('generate-tab')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('mode-btn-form')).toBeVisible()
    await expect(page.getByTestId('mode-btn-batch')).toBeVisible()
  })

  test('Step 3: Form mode shows instance form with input fields', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-form').click()
    const form = page.getByTestId('instance-form')
    await expect(form).toBeVisible({ timeout: 5000 })
    // Instance form must contain at least one input element
    const inputs = form.locator('input, textarea, select')
    await expect(inputs.first()).toBeVisible()
  })

  test('Step 4: Typing a value in a form field updates the YAML preview', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-form').click()
    await expect(page.getByTestId('instance-form')).toBeVisible({ timeout: 5000 })

    // Find the first text input and type a value
    const textInput = page.locator('[data-testid="instance-form"] input[type="text"]').first()
    await expect(textInput).toBeVisible()

    const testValue = 'e2e-test-instance'
    await textInput.fill(testValue)

    // YAML preview should contain the typed value somewhere in its output
    const yamlPreview = page.locator('[class*="yaml-preview"], [data-testid="yaml-preview"], pre').first()
    await expect(yamlPreview).toContainText(testValue, { timeout: 3000 })
  })

  test('Step 5: Batch mode renders the batch form component', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-batch').click()
    // Batch mode renders either instance-form or a batch-form element
    await expect(
      page.locator('[data-testid="instance-form"], [class*="batch-form"]').first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('Step 6: Copy button is present in the YAML preview area', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=generate`)
    await page.getByTestId('mode-btn-form').click()
    await expect(page.getByTestId('instance-form')).toBeVisible({ timeout: 5000 })
    // Copy button should be present (label may vary — match by role or partial text)
    const copyBtn = page.locator('button').filter({ hasText: /copy/i })
    await expect(copyBtn.first()).toBeVisible({ timeout: 5000 })
  })
})
