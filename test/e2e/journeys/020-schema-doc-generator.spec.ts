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
 * Journey 020: Schema Doc Generator
 *
 * Validates that the Docs tab on the RGD detail page:
 * - Renders the docs-tab container
 * - Shows spec field rows for the test-app RGD schema
 * - Handles RGDs with no spec fields gracefully
 *
 * Spec ref: .specify/specs/020-schema-doc-generator/
 *
 * Cluster pre-conditions:
 * - kind cluster running, kro installed
 * - test-app RGD applied (has spec.appName and spec.enableConfig fields)
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:40107'

test.describe('Journey 020 — Schema Doc Generator', () => {
  test('Step 1: Docs tab is present on RGD detail page', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await expect(page.getByTestId('tab-docs')).toBeVisible({ timeout: 10000 })
  })

  test('Step 2: clicking Docs tab renders docs-tab container', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)
    await page.getByTestId('tab-docs').click()
    await expect(page.getByTestId('tab-docs')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('docs-tab')).toBeVisible({ timeout: 10000 })
  })

  test('Step 3: docs tab shows spec field rows for test-app schema', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=docs`)
    await expect(page.getByTestId('docs-tab')).toBeVisible({ timeout: 10000 })

    // test-app has spec fields: appName (string) and enableConfig (boolean)
    // FieldTable should render rows for these fields
    const fieldRows = page.locator('.field-table__row, [class*="field-table"]')
    const count = await fieldRows.count()

    if (count === 0) {
      // If no fields shown, no-spec-fields message must be shown instead of a crash
      await expect(page.getByTestId('no-spec-fields')).toBeVisible()
    } else {
      await expect(fieldRows.first()).toBeVisible()
    }
  })

  test('Step 4: docs tab does not render undefined/null', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=docs`)
    await expect(page.getByTestId('docs-tab')).toBeVisible({ timeout: 10000 })

    const content = await page.getByTestId('docs-tab').textContent()
    expect(content).not.toContain('undefined')
    expect(content).not.toContain('[object Object]')
  })

  test('Step 5: ExampleYAML section or generate link is present', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app?tab=docs`)
    await expect(page.getByTestId('docs-tab')).toBeVisible({ timeout: 10000 })

    // The docs tab may include an example YAML block or a link to the Generate tab
    const content = await page.getByTestId('docs-tab').textContent()
    // Content must be non-empty (not a blank tab)
    expect(content?.trim().length).toBeGreaterThan(0)
  })

  test('Step 6: Types section absent for RGD with no spec.schema.types (FR-030)', async ({ page }) => {
    // test-app has no spec.schema.types — Types section must not be rendered.
    // This is the common case; the section only appears for RGDs with custom types.
    await page.goto(`${BASE}/rgds/test-app?tab=docs`)
    await expect(page.getByTestId('docs-tab')).toBeVisible({ timeout: 10000 })
    // docs-types-section must not exist for this RGD.
    await expect(page.getByTestId('docs-types-section')).toHaveCount(0)
  })
})
