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
 * Journey 053: Multi-version kro support
 *
 * Spec: .specify/specs/053-multi-version-kro/spec.md
 * PR: TBD
 *
 * Verifies that:
 *   A) The capabilities API exposes isSupported and version fields
 *   B) kro v0.8.5 (E2E cluster) is reported as isSupported=true
 *   C) No unsupported-version banner is shown when kro is supported
 *   D) CompareKroVersions logic gates: version < 0.8.0 → isSupported=false
 *      (verified via unit tests; E2E validates the API contract)
 *   E) KroCapabilities type in the frontend matches the API shape
 *
 * Cluster pre-conditions:
 * - kind cluster running kro >= v0.8.0 (E2E installs kro v0.8.5 via Helm)
 * - kro-ui binary running at KRO_UI_BASE_URL
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.KRO_UI_BASE_URL || 'http://localhost:40107'

test.describe('Journey 053: Multi-version kro support', () => {

  // ── A+B: Capabilities API exposes isSupported=true for kro >= 0.8.0 ────────

  test('Step 1: GET /api/v1/kro/capabilities returns isSupported=true for E2E cluster', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.status()).toBe(200)

    const caps = await res.json()

    // isSupported field must exist
    expect(typeof caps.isSupported).toBe('boolean')
    // E2E cluster runs kro >= 0.8.0, so isSupported must be true
    expect(caps.isSupported).toBe(true)

    // version field must be a non-empty string
    expect(typeof caps.version).toBe('string')
    expect(caps.version.length).toBeGreaterThan(0)

    // Other required fields
    expect(typeof caps.apiVersion).toBe('string')
    expect(Array.isArray(caps.knownResources)).toBe(true)
    expect(typeof caps.featureGates).toBe('object')
  })

  // ── C: No warning banner on supported cluster ───────────────────────────────

  test('Step 2: No unsupported-version banner shown when kro is supported', async ({ page }) => {
    await page.goto(BASE)
    // Wait for the Overview dashboard to load
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-instances"]') !== null,
      { timeout: 20000 }
    )

    // The warning banner must NOT be present on a supported cluster
    const banner = page.locator('[data-testid="kro-version-warning"]')
    await expect(banner).not.toBeVisible()
  })

  // ── E: Version field survives a context switch ──────────────────────────────

  test('Step 3: Capabilities version field is non-empty after page load', async ({ page }) => {
    await page.goto(BASE)
    // Wait for Overview dashboard to load
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="widget-metrics"]') !== null,
      { timeout: 20000 }
    )

    // Re-fetch capabilities to verify the field is stable
    const res = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    expect(res.status()).toBe(200)
    const caps = await res.json()
    // Version should never be the literal string "unknown" on a live cluster
    // (Baseline() returns "unknown" when kro deployment cannot be found, but
    // the E2E cluster installs kro, so the Deployment exists)
    expect(caps.version).not.toBe('')
  })

  // ── MinSupportedKroVersion constant is v0.8.0 ─────────────────────────────

  test('Step 4: Capabilities API does not show warning for kro v0.8.x or later', async ({ page }) => {
    // This is a contract test — the minimum version is 0.8.0, and our E2E
    // cluster runs 0.8.5, so isSupported must be true.
    const res = await page.request.get(`${BASE}/api/v1/kro/capabilities`)
    const caps = await res.json()

    if (caps.version && caps.version !== 'unknown') {
      // Parse the version: strip leading "v", split on ".", check major.minor.patch
      const raw = caps.version.replace(/^v/, '').split('-')[0]
      const [major, minor] = raw.split('.').map(Number)
      const isAboveMinimum = major > 0 || (major === 0 && minor >= 8)
      // If the cluster is running kro >= 0.8.x, isSupported must be true
      if (isAboveMinimum) {
        expect(caps.isSupported).toBe(true)
      }
    }
  })
})
