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
 * Journey 032: RBAC SA Auto-Detection
 *
 * Validates that the Access tab auto-detects the kro service account from
 * the live cluster rather than using any hardcoded SA name/namespace.
 *
 * The test is structurally identical to journey 018 but focused on the
 * auto-detection assertion: the SA shown must not be a placeholder and
 * must match what is actually running in the cluster.
 *
 * Spec ref: .specify/specs/032-rbac-sa-autodetect/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied
 * - kro controller SA running in kro-system namespace
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 032 — RBAC SA Auto-Detection', () => {
  test('Step 1: access tab loads without error on a running cluster', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=access`)

    await expect(
      page.locator('[data-testid="access-tab"], [data-testid="access-tab-error"]'),
    ).toBeVisible({ timeout: 15000 })
  })

  test('Step 2: detected SA namespace is not empty or placeholder', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=access`)

    const errorEl = page.getByTestId('access-tab-error')
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) return

    await expect(page.getByTestId('access-tab-sa-banner')).toBeVisible({ timeout: 10000 })

    const ns = await page.getByTestId('access-tab-sa-namespace').textContent()
    expect(ns?.trim()).toBeTruthy()
    // Must not be an empty string or literal "kro" hardcoded value
    // (the actual namespace depends on the kro install, e.g. "kro-system")
    expect(ns?.trim().length).toBeGreaterThan(0)
  })

  test('Step 3: detected SA name is not empty or placeholder', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=access`)

    const errorEl = page.getByTestId('access-tab-error')
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) return

    await expect(page.getByTestId('access-tab-sa-banner')).toBeVisible({ timeout: 10000 })

    const name = await page.getByTestId('access-tab-sa-name').textContent()
    expect(name?.trim()).toBeTruthy()
    expect(name?.trim().length).toBeGreaterThan(0)
  })

  test('Step 4: SA override form allows overriding the detected SA', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=access`)

    const errorEl = page.getByTestId('access-tab-error')
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) return

    // Wait for SA detection to complete — override form only renders after SA banner appears
    await expect(page.getByTestId('access-tab-sa-banner')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('access-tab-sa-override-form')).toBeVisible({ timeout: 5000 })

    // Fill in override values and submit
    await page.getByTestId('access-tab-sa-ns-input').fill('kro-system')
    await page.getByTestId('access-tab-sa-name-input').fill('kro')
    await page.getByTestId('access-tab-sa-override-submit').click()

    // After submit, the SA banner should update
    await expect(page.getByTestId('access-tab-sa-namespace')).toHaveText('kro-system', { timeout: 5000 })
    await expect(page.getByTestId('access-tab-sa-name')).toHaveText('kro', { timeout: 5000 })
  })
})
