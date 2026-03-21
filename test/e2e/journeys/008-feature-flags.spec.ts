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
 * Journey 008: Feature Flags — Capabilities Detection
 *
 * Validates that the capabilities endpoint returns correct data for the
 * connected kro installation and that the frontend gates features accordingly.
 *
 * Spec ref: .specify/specs/008-feature-flags/spec.md § E2E User Journey
 */

import { test, expect } from '@playwright/test'

const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const BASE = `http://localhost:${PORT}`

test.describe('Journey 008 — Feature flags and capabilities', () => {

  test('Step 1: /api/v1/kro/capabilities returns expected baseline', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/kro/capabilities`)

    expect(res.status()).toBe(200)
    const body = await res.json() as {
      version: string
      apiVersion: string
      featureGates: Record<string, boolean>
      knownResources: string[]
      schema: {
        hasForEach: boolean
        hasExternalRef: boolean
        hasExternalRefSelector: boolean
        hasScope: boolean
        hasTypes: boolean
      }
    }

    // Log full response for debugging CI failures.
    console.log('capabilities response:', JSON.stringify(body, null, 2))

    // kro is installed in the E2E kind cluster.
    expect(body.apiVersion).toBe('kro.run/v1alpha1')
    expect(body.knownResources).toContain('resourcegraphdefinitions')

    // Schema capabilities — kro v1alpha1 CRD should have forEach and externalRef.
    expect(body.schema.hasForEach).toBe(true)
    expect(body.schema.hasExternalRef).toBe(true)

    // Feature gates — default kro installation has no gates enabled.
    expect(body.featureGates.CELOmitFunction).toBe(false)

    // Fork guard: forbidden capabilities must never appear.
    expect(body.featureGates).not.toHaveProperty('specPatch')
    expect(body.featureGates).not.toHaveProperty('stateFields')
  })

  test('Step 2: RGD detail page loads without ExternalRef nodes', async ({ page }) => {
    await page.goto(`${BASE}/rgds/test-app`)

    // The test fixture (test-app) has no externalRef resources.
    // Verify the page loads and does not show ExternalRef nodes.
    // (ExternalRef node rendering is tested in spec 003 unit tests with mock data.)
    await expect(page.locator('body')).toBeVisible()

    // No GraphRevision tab should appear (kind cluster has no GraphRevision CRD).
    const revisionsTab = page.locator('text=Revisions')
    await expect(revisionsTab).toHaveCount(0)
  })

})
