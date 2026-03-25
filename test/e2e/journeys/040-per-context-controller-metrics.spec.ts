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
 * Journey 040: Per-context controller metrics via pod-proxy
 *
 * Validates spec 040-per-context-controller-metrics acceptance criteria:
 *   - The --metrics-url flag is absent from CLI help output
 *   - The metrics API returns a valid response
 *   - Fleet page renders (metrics column may show — if kro pod not found)
 *
 * Spec ref: .specify/specs/040-per-context-controller-metrics/spec.md
 */

import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 040 — Per-context controller metrics', () => {

  test('Step 1: --metrics-url flag is absent from kro-ui CLI help', () => {
    // The flag was removed in v0.4.0 (spec 040). Verify it is gone.
    // KRO_UI_BIN must be an absolute path to the binary (set by the E2E harness).
    // We validate it contains no shell metacharacters before passing to execSync.
    const rawBin = process.env.KRO_UI_BIN ?? './kro-ui'
    // Allow only safe characters: alphanumeric, dash, underscore, dot, slash.
    const KRO_UI_BIN = /^[a-zA-Z0-9_./-]+$/.test(rawBin) ? rawBin : './kro-ui'
    let helpOutput = ''
    try {
      helpOutput = execSync(`${KRO_UI_BIN} serve --help 2>&1`, { encoding: 'utf-8', shell: false })
    } catch (e: unknown) {
      // --help exits non-zero on some cobra versions; capture output regardless
      helpOutput = (e as { stdout?: string; stderr?: string }).stdout ?? ''
      helpOutput += (e as { stdout?: string; stderr?: string }).stderr ?? ''
    }
    expect(helpOutput).not.toContain('--metrics-url')
  })

  test('Step 2: metrics API returns 200 or 503 (no crash, no timeout)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/kro/metrics`, { timeout: 6_000 })
    // 200 = kro pod found and metrics scraped
    // 503 = kro pod not found (graceful degradation) — still a valid non-crash response
    expect([200, 503]).toContain(res.status())
  })

  test('Step 3: Fleet page renders without error', async ({ page }) => {
    await page.goto(`${BASE}/fleet`)
    // The Fleet page should render — either with cluster data or the empty state.
    // An error banner would indicate a regression.
    const errorBanner = page.locator('.fleet__error, [data-testid="fleet-error"]')
    await expect(errorBanner).not.toBeVisible({ timeout: 8_000 })
  })
})
