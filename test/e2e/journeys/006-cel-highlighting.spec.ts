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
 * Journey 006: CEL Highlighting — token colors and copy button
 *
 * Validates that the kro CEL/schema highlighter renders the correct CSS colors
 * by reading computed styles from Chromium. This journey MUST run on Chromium
 * because CSS custom property resolution via getComputedStyle requires a real
 * rendering engine.
 *
 * Spec ref: .specify/specs/006-cel-highlighter/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

test.describe('Journey 006 — CEL syntax highlighting colors', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    await page.waitForSelector('[data-testid="kro-code-block"]', { timeout: 10_000 })
  })

  test('Step 1: YAML tab renders the kro code block', async ({ page }) => {
    await expect(page.getByTestId('kro-code-block')).toBeVisible()
  })

  test('Step 2: CEL expression tokens render with correct blue color (#93c5fd)', async ({ page }) => {
    const celSpan = page.locator('[data-testid="kro-code-block"] .token-cel').first()
    await expect(celSpan).toBeVisible()

    const color = await celSpan.evaluate(el =>
      window.getComputedStyle(el).color
    )
    // #93c5fd = rgb(147, 197, 253)
    expect(color).toBe('rgb(147, 197, 253)')
  })

  test('Step 3: kro keyword tokens render with correct dark slate color (#d6d3d1)', async ({ page }) => {
    const keywordSpan = page.locator('[data-testid="kro-code-block"] .token-kro-keyword').first()
    await expect(keywordSpan).toBeVisible()

    const color = await keywordSpan.evaluate(el =>
      window.getComputedStyle(el).color
    )
    // #d6d3d1 = rgb(214, 211, 209)
    expect(color).toBe('rgb(214, 211, 209)')
  })

  test('Step 4: YAML key tokens render with correct warm gray color (#a8a29e)', async ({ page }) => {
    const yamlKeySpan = page.locator('[data-testid="kro-code-block"] .token-yaml-key').first()
    await expect(yamlKeySpan).toBeVisible()

    const color = await yamlKeySpan.evaluate(el =>
      window.getComputedStyle(el).color
    )
    // #a8a29e = rgb(168, 162, 158)
    expect(color).toBe('rgb(168, 162, 158)')
  })

  test('Step 5: Copy button writes raw YAML to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions (also set in playwright.config.ts contextOptions)
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.getByTestId('code-block-copy-btn').click()

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())

    // Clipboard content should contain kro RGD markers
    expect(clipboardText).toContain('ResourceGraphDefinition')
    expect(clipboardText).toContain('test-app')
    // Should contain at least one raw CEL expression
    expect(clipboardText).toContain('${')
  })

})
