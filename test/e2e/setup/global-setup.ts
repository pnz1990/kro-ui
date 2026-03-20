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
 * global-setup.ts — Playwright global setup for kro-ui E2E tests.
 *
 * Executed once before all test suites. Performs:
 *   1. Create a kind cluster (kro-ui-e2e)
 *   2. Install kro via Helm
 *   3. Register additional kubeconfig contexts (alt + long-name) pointing at
 *      the same cluster endpoint — used by the context-switcher journey
 *   4. Create the kro-ui-e2e namespace
 *   5. Apply test fixture manifests (test-app RGD + test-instance CR)
 *   6. Wait for the RGD to be accepted and the instance to be reconciled
 *   7. Build the kro-ui binary (if not already built)
 *   8. Start the kro-ui server process in the background
 *   9. Wait for /healthz to respond
 *
 * Environment variables:
 *   KRO_CHART_VERSION  — kro Helm chart version to install (default: latest)
 *   KRO_UI_BINARY      — path to the kro-ui binary (default: ../../bin/kro-ui)
 *   KRO_UI_PORT        — port for kro-ui server (default: 10174)
 *   SKIP_KIND_CREATE   — if set, skip cluster creation (use existing context)
 */

import { execSync, spawn, ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CLUSTER_NAME = 'kro-ui-e2e'
const PRIMARY_CONTEXT = 'kind-kro-ui-e2e'
const ALT_CONTEXT = 'kro-ui-e2e-alt'
const LONG_CONTEXT = 'arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name'
const NAMESPACE = 'kro-ui-e2e'
const PORT = parseInt(process.env.KRO_UI_PORT ?? '10174', 10)
const FIXTURES_DIR = resolve(__dirname, '../fixtures')
const ROOT_DIR = resolve(__dirname, '../../..')

// Shared kubeconfig path written by setup, read by teardown and all tests.
const KUBECONFIG_PATH = join(tmpdir(), 'kro-ui-e2e-kubeconfig.yaml')

let serverProcess: ChildProcess | null = null

export default async function globalSetup() {
  console.log('\n[setup] Starting kro-ui E2E global setup…')

  // ── 1. Create kind cluster ───────────────────────────────────────────────
  if (!process.env.SKIP_KIND_CREATE) {
    console.log(`[setup] Creating kind cluster "${CLUSTER_NAME}"…`)
    exec(`kind create cluster --name ${CLUSTER_NAME} --kubeconfig ${KUBECONFIG_PATH} --wait 120s`)
    console.log('[setup] Kind cluster ready')
  } else {
    console.log('[setup] SKIP_KIND_CREATE set — reusing existing cluster')
    exec(`kind get kubeconfig --name ${CLUSTER_NAME} > ${KUBECONFIG_PATH}`)
  }

  const kubectl = `kubectl --kubeconfig ${KUBECONFIG_PATH}`

  // ── 2. Install kro via Helm ──────────────────────────────────────────────
  console.log('[setup] Installing kro via Helm…')
  const kroVersion = process.env.KRO_CHART_VERSION ?? ''
  const versionFlag = kroVersion ? `--version ${kroVersion}` : ''
  exec(
    `helm install kro oci://ghcr.io/kro-run/kro/kro ${versionFlag} ` +
    `--namespace kro-system --create-namespace ` +
    `--kubeconfig ${KUBECONFIG_PATH} ` +
    `--wait --timeout 120s`
  )
  console.log('[setup] kro installed')

  // ── 3. Register additional kubeconfig contexts ───────────────────────────
  // Both contexts point at the same cluster — used by journey 007.
  console.log('[setup] Registering alternate kubeconfig contexts…')
  registerAltContext(KUBECONFIG_PATH, PRIMARY_CONTEXT, ALT_CONTEXT)
  registerAltContext(KUBECONFIG_PATH, PRIMARY_CONTEXT, LONG_CONTEXT)
  console.log(`[setup] Contexts registered: ${ALT_CONTEXT}, ${LONG_CONTEXT}`)

  // ── 4. Create test namespace ──────────────────────────────────────────────
  console.log(`[setup] Creating namespace "${NAMESPACE}"…`)
  exec(`${kubectl} create namespace ${NAMESPACE} --dry-run=client -o yaml | ${kubectl} apply -f -`)

  // ── 5. Apply test fixtures ────────────────────────────────────────────────
  console.log('[setup] Applying test fixtures…')
  exec(`${kubectl} apply -f ${FIXTURES_DIR}/test-rgd.yaml`)

  // Wait for the RGD to be accepted by kro before applying the instance.
  console.log('[setup] Waiting for test-app RGD to be accepted…')
  exec(
    `${kubectl} wait rgd/test-app ` +
    `--for=condition=Ready --timeout=120s`,
    { retries: 3 }
  )

  exec(`${kubectl} apply -f ${FIXTURES_DIR}/test-instance.yaml`)

  // Wait for the instance's child Namespace to exist — indicates reconciliation
  // has at least started. We do not wait for full readiness to avoid flakiness.
  console.log('[setup] Waiting for test-instance to reconcile…')
  exec(
    `${kubectl} wait namespace/kro-ui-test ` +
    `--for=jsonpath='{.status.phase}'=Active --timeout=120s`,
    { retries: 5 }
  )
  console.log('[setup] test-instance reconciled')

  // ── 6. Build kro-ui binary if needed ─────────────────────────────────────
  const binaryPath = process.env.KRO_UI_BINARY ?? join(ROOT_DIR, 'bin', 'kro-ui')
  if (!existsSync(binaryPath)) {
    console.log('[setup] Building kro-ui binary…')
    exec('make build', { cwd: ROOT_DIR })
    console.log('[setup] Binary built')
  }

  // ── 7. Start kro-ui server ────────────────────────────────────────────────
  console.log(`[setup] Starting kro-ui server on port ${PORT}…`)
  serverProcess = spawn(
    binaryPath,
    ['serve', '--port', String(PORT), '--kubeconfig', KUBECONFIG_PATH, '--context', PRIMARY_CONTEXT],
    { detached: false, stdio: ['ignore', 'pipe', 'pipe'] }
  )

  serverProcess.stdout?.on('data', (d: Buffer) => {
    process.stdout.write(`[kro-ui] ${d.toString()}`)
  })
  serverProcess.stderr?.on('data', (d: Buffer) => {
    process.stderr.write(`[kro-ui] ${d.toString()}`)
  })

  // Store PID for teardown
  process.env.KRO_UI_SERVER_PID = String(serverProcess.pid)
  process.env.KRO_UI_KUBECONFIG = KUBECONFIG_PATH

  // ── 8. Wait for healthz ───────────────────────────────────────────────────
  console.log('[setup] Waiting for kro-ui to be ready…')
  await waitForHealthz(`http://localhost:${PORT}/api/v1/healthz`, 30_000)
  console.log(`[setup] kro-ui ready at http://localhost:${PORT}`)
  console.log('[setup] Global setup complete\n')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function exec(cmd: string, opts: { cwd?: string; retries?: number } = {}) {
  const { cwd = ROOT_DIR, retries = 0 } = opts
  for (let i = 0; i <= retries; i++) {
    try {
      execSync(cmd, { cwd, stdio: 'inherit', encoding: 'utf8' })
      return
    } catch (err) {
      if (i === retries) throw err
      console.warn(`[setup] Command failed (attempt ${i + 1}/${retries + 1}), retrying…`)
    }
  }
}

/**
 * registerAltContext copies an existing kubeconfig context under a new name.
 * Both contexts share the same cluster and credentials — used by journey 007
 * to test the context-switcher UI without needing a second real cluster.
 */
function registerAltContext(kubeconfigPath: string, sourceContext: string, newContextName: string) {
  const kubectl = `kubectl --kubeconfig ${kubeconfigPath}`
  // Get the cluster and user from the source context
  const cluster = execSync(
    `${kubectl} config view -o jsonpath='{.contexts[?(@.name=="${sourceContext}")].context.cluster}'`,
    { encoding: 'utf8' }
  ).trim()
  const user = execSync(
    `${kubectl} config view -o jsonpath='{.contexts[?(@.name=="${sourceContext}")].context.user}'`,
    { encoding: 'utf8' }
  ).trim()
  // Set new context pointing at the same cluster+user
  execSync(
    `${kubectl} config set-context "${newContextName}" --cluster="${cluster}" --user="${user}"`,
    { stdio: 'inherit', encoding: 'utf8' }
  )
}

async function waitForHealthz(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not yet ready
    }
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error(`kro-ui did not become ready within ${timeoutMs}ms (${url})`)
}
