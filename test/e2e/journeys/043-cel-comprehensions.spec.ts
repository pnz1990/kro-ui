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
 * Journey 043-cel-comprehensions: CEL two-variable comprehension rendering
 *
 * Validates that kro-ui correctly tokenises and renders CEL two-variable
 * comprehension macros (transformMap, transformList, transformMapEntry) in the
 * YAML tab's syntax-highlighted output:
 *   - The DAG renders for the cel-comprehensions RGD
 *   - The YAML tab shows CEL token spans
 *   - The comprehension function names appear in the highlighted output
 *   - No ? or undefined tokens are produced
 *
 * Spec ref: .specify/specs/043-upstream-fixture-generator/
 *
 * Cluster pre-conditions:
 *   - upstream-cel-comprehensions RGD applied and Ready
 *   - upstream-cel-comprehensions instance applied
 */

import { test, expect } from '@playwright/test'
import { fixtureState } from '../fixture-state'

const BASE = 'http://localhost:40107'
const RGD_URL = `${BASE}/rgds/upstream-cel-comprehensions`
const DAG_TIMEOUT = 15000

test.describe('Journey 043-cel-comprehensions — CEL two-variable comprehension rendering', () => {
  test('Step 1: RGD detail DAG renders for cel-comprehensions fixture', async ({ page }) => {
    test.skip(!fixtureState.celComprehensionsReady, 'upstream-cel-comprehensions RGD not Ready in setup')
    await page.goto(RGD_URL)
    await expect(page.getByTestId('dag-svg')).toBeVisible({ timeout: DAG_TIMEOUT })
  })

  test('Step 2: YAML tab renders without error', async ({ page }) => {
    test.skip(!fixtureState.celComprehensionsReady, 'upstream-cel-comprehensions RGD not Ready in setup')
    await page.goto(`${RGD_URL}?tab=yaml`)
    // Wait for the code block to appear
    const codeBlock = page.locator('[data-testid="kro-code-block"], .kro-code-block, pre').first()
    await expect(codeBlock).toBeVisible({ timeout: DAG_TIMEOUT })
  })

  test('Step 3: CEL expression token spans are present in YAML tab', async ({ page }) => {
    test.skip(!fixtureState.celComprehensionsReady, 'upstream-cel-comprehensions RGD not Ready in setup')
    await page.goto(`${RGD_URL}?tab=yaml`)
    const celSpans = page.locator('.token-cel-expression')
    const count = await celSpans.count()
    // There should be multiple CEL spans (transformMap, transformList, transformMapEntry each produce tokens)
    expect(count).toBeGreaterThan(0)
  })

  test('Step 4: comprehension function names appear in highlighted output', async ({ page }) => {
    test.skip(!fixtureState.celComprehensionsReady, 'upstream-cel-comprehensions RGD not Ready in setup')
    await page.goto(`${RGD_URL}?tab=yaml`)
    const codeBlock = page.locator('[data-testid="kro-code-block"], .kro-code-block, pre').first()
    await expect(codeBlock).toBeVisible({ timeout: DAG_TIMEOUT })

    const text = await codeBlock.textContent() ?? ''
    // At least one of the comprehension macros must appear in the rendered output
    expect(text).toMatch(/transformMap|transformList|transformMapEntry/)
  })

  test('Step 5: no ? or undefined tokens in the highlighted output', async ({ page }) => {
    test.skip(!fixtureState.celComprehensionsReady, 'upstream-cel-comprehensions RGD not Ready in setup')
    await page.goto(`${RGD_URL}?tab=yaml`)
    const celSpans = page.locator('.token-cel-expression')
    const count = await celSpans.count()
    if (count === 0) return // no CEL tokens rendered — Step 3 would catch this

    const allText = await celSpans.allTextContents()
    for (const t of allText) {
      expect(t.trim()).not.toBe('?')
      expect(t.trim()).not.toBe('undefined')
      expect(t.trim()).not.toBe('[object Object]')
    }
  })
})
