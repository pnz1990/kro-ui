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
 * global-teardown.ts — Playwright global teardown for kro-ui E2E tests.
 *
 * Executed once after all test suites. Performs:
 *   1. Kill the kro-ui server process
 *   2. Delete the kind cluster (unless SKIP_KIND_DELETE is set)
 */

import { execSync } from 'node:child_process'

export default async function globalTeardown() {
  console.log('\n[teardown] Starting kro-ui E2E global teardown…')

  // ── 1. Stop kro-ui server ─────────────────────────────────────────────────
  const pid = process.env.KRO_UI_SERVER_PID
  if (pid) {
    try {
      process.kill(parseInt(pid, 10), 'SIGTERM')
      console.log(`[teardown] kro-ui server (PID ${pid}) stopped`)
    } catch {
      // Process may have already exited — that is fine
      console.warn(`[teardown] Could not kill PID ${pid} (already gone?)`)
    }
  }

  // ── 2. Delete kind cluster ────────────────────────────────────────────────
  if (!process.env.SKIP_KIND_DELETE) {
    console.log('[teardown] Deleting kind cluster "kro-ui-e2e"…')
    try {
      execSync('kind delete cluster --name kro-ui-e2e', { stdio: 'inherit' })
      console.log('[teardown] Kind cluster deleted')
    } catch (err) {
      // Non-fatal — CI will discard the runner anyway
      console.warn('[teardown] Failed to delete kind cluster:', err)
    }
  } else {
    console.log('[teardown] SKIP_KIND_DELETE set — cluster preserved')
  }

  console.log('[teardown] Global teardown complete\n')
}
