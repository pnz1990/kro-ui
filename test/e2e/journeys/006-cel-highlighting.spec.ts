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
 * Journey 006: CEL / Schema Syntax Highlighting
 *
 * Validates that kro YAML renders with correct token colors using CSS custom
 * properties. Uses getComputedStyle() to assert actual rendered colors.
 *
 * Requires Chromium — CSS custom property resolution via getComputedStyle
 * works in Chromium headless.
 *
 * Pre-conditions: kind cluster running, test-app RGD applied. The test-app
 * fixture contains CEL expressions, readyWhen keywords, and YAML keys.
 *
 * Spec ref: .specify/specs/006-cel-highlighter/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

test.describe('Journey 006 — CEL syntax highlighting', () => {

  test('Step 1: Navigate to YAML tab and see code block', async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    const codeBlock = page.locator('[data-testid="kro-code-block"]')
    await expect(codeBlock).toBeVisible()
  })

  test('Step 2: CEL expression token is the correct blue (#93c5fd)', async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    // Locate the first CEL expression span (token-cel-expression or token-cel)
    const celSpan = page.locator('[data-testid="kro-code-block"] span.token-cel-expression').first()
    await expect(celSpan).toBeVisible()

    // Assert computed color is rgb(147, 197, 253) — which is #93c5fd (dark mode)
    const color = await celSpan.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    expect(color).toBe('rgb(147, 197, 253)')
  })

  test('Step 3: kro keyword token is the correct dark slate (#d6d3d1)', async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    const kroSpan = page.locator('[data-testid="kro-code-block"] span.token-kro-keyword').first()
    await expect(kroSpan).toBeVisible()

    const color = await kroSpan.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    expect(color).toBe('rgb(214, 211, 209)')
  })

  test('Step 4: YAML key token is the correct warm gray (#a8a29e)', async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    const yamlSpan = page.locator('[data-testid="kro-code-block"] span.token-yaml-key').first()
    await expect(yamlSpan).toBeVisible()

    const color = await yamlSpan.evaluate((el) => {
      return window.getComputedStyle(el).color
    })
    expect(color).toBe('rgb(168, 162, 158)')
  })

  test('Step 5: Copy button copies raw YAML to clipboard', async ({ page }) => {
    await page.goto('/rgds/test-app?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    // Click the copy button
    const copyBtn = page.locator('[data-testid="code-block-copy-btn"]').first()
    await copyBtn.click()

    // Read clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())

    // The clipboard should contain the raw YAML of the test-app RGD
    // It should have at least the apiVersion and kind fields
    expect(clipboardText).toContain('apiVersion')
    expect(clipboardText).toContain('kind')
    expect(clipboardText.length).toBeGreaterThan(100)
  })

  // ── Steps 6-8: cel-functions RGD — broader CEL token coverage ────────────

  test('Step 6: cel-functions YAML tab shows token-cel-expression spans with .split( call', async ({ page }) => {
    test.skip(!fixtureState.celFunctionsReady, 'cel-functions RGD not Ready in setup')
    await page.goto('/rgds/cel-functions?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    const celSpans = page.locator('[data-testid="kro-code-block"] span.token-cel-expression')
    await expect(celSpans.first()).toBeVisible()

    const texts = await celSpans.allTextContents()
    const hasSplit = texts.some(t => t.includes('.split('))
    expect(hasSplit).toBe(true)
  })

  test('Step 7: cel-functions YAML tab contains json.marshal CEL expression token', async ({ page }) => {
    test.skip(!fixtureState.celFunctionsReady, 'cel-functions RGD not Ready in setup')
    await page.goto('/rgds/cel-functions?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    const celSpans = page.locator('[data-testid="kro-code-block"] span.token-cel-expression')
    const texts = await celSpans.allTextContents()
    const hasJsonMarshal = texts.some(t => t.includes('json.marshal'))
    expect(hasJsonMarshal).toBe(true)
  })

  test('Step 8: cel-functions YAML tab has YAML key tokens visible', async ({ page }) => {
    test.skip(!fixtureState.celFunctionsReady, 'cel-functions RGD not Ready in setup')
    await page.goto('/rgds/cel-functions?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    // token-yaml-key is the standard kro highlighter token for YAML keys
    const keySpans = page.locator('[data-testid="kro-code-block"] span.token-yaml-key')
    await expect(keySpans.first()).toBeVisible()
  })

  // ── Step 9: external-ref RGD — optional chaining token ───────────────────

  test('Step 9: external-ref YAML tab contains orValue in a CEL expression token', async ({ page }) => {
    test.skip(!fixtureState.externalRefReady, 'external-ref RGD not Ready in setup')
    await page.goto('/rgds/external-ref?tab=yaml')
    await expect(page.locator('[data-testid="kro-code-block"]')).toBeVisible()

    const celSpans = page.locator('[data-testid="kro-code-block"] span.token-cel-expression')
    await expect(celSpans.first()).toBeVisible()

    const texts = await celSpans.allTextContents()
    const hasOrValue = texts.some(t => t.includes('orValue'))
    expect(hasOrValue).toBe(true)
  })

})
