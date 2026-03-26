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
 *   5. Apply pre-requisite resources (ConfigMap for external-ref fixture)
 *   6. Apply all fixture RGDs, wait for Ready, then apply instances:
 *        a. test-app RGD + test-instance (NodeTypeResource, includeWhen)
 *        b. test-collection RGD + test-collection-instance (NodeTypeCollection forEach)
 *        c. multi-resource RGD + multi-resource-instance (4-resource DAG with HPA)
 *        d. external-ref RGD + external-ref-instance (NodeTypeExternal)
 *        e. cel-functions RGD + cel-functions-instance (CEL extension functions)
 *        f. chain-parent + chain-child RGDs (chaining graph — no instances needed)
 *   7. Build the kro-ui binary (if not already built)
 *   8. Start the kro-ui server process in the background
 *   9. Wait for /healthz to respond
 *
 * Environment variables:
 *   KRO_CHART_VERSION  — kro Helm chart version to install (default: auto-detect latest from GitHub)
 *   KRO_UI_BINARY      — path to the kro-ui binary (default: ../../bin/kro-ui)
 *   KRO_UI_PORT        — port for kro-ui server (default: 40107)
 *   SKIP_KIND_CREATE   — if set, skip cluster creation (use existing context)
 */

import { execFileSync, execSync, spawn, ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to the fixture state file — written by globalSetup and read by journeys.
// Playwright workers do NOT inherit process.env mutations from globalSetup, so
// we persist fixture readiness flags to a JSON file instead.
export const FIXTURE_STATE_PATH = resolve(__dirname, '../fixture-state.json')

const CLUSTER_NAME = 'kro-ui-e2e'
const PRIMARY_CONTEXT = 'kind-kro-ui-e2e'
const ALT_CONTEXT = 'kro-ui-e2e-alt'
const LONG_CONTEXT = 'arn:aws:eks:us-west-2:000000000000:cluster/kro-ui-e2e-long-name'
const NAMESPACE = 'kro-ui-e2e'
const PORT = parseInt(process.env.KRO_UI_PORT ?? '40107', 10)
const FIXTURES_DIR = resolve(__dirname, '../fixtures')
const ROOT_DIR = resolve(__dirname, '../../..')

// Shared kubeconfig path written by setup, read by teardown and all tests.
// Uses a randomly-named temp directory to avoid predictable-path (TOCTOU) attacks.
const KUBECONFIG_PATH = join(mkdtempSync(join(tmpdir(), 'kro-ui-e2e-')), 'kubeconfig.yaml')

/** Semver pattern — only digits and dots. Used to validate KRO_CHART_VERSION. */
const SEMVER_RE = /^\d+\.\d+\.\d+$/

let serverProcess: ChildProcess | null = null

export default async function globalSetup() {
  console.log('\n[setup] Starting kro-ui E2E global setup…')

  // Fixture readiness flags — written to FIXTURE_STATE_PATH at the end of setup
  // so Playwright worker processes can read them (process.env mutations in
  // globalSetup are NOT visible to workers which run in a separate process).
  const fixtureState = {
    collectionReady: false,
    multiReady: false,
    externalRefReady: false,
    celFunctionsReady: false,
    // spec 043-upstream-fixture-generator
    cartesianReady: false,
    collectionChainReady: false,
    contagiousReady: false,
    clusterScopedReady: false,
    externalCollectionReady: false,
    celComprehensionsReady: false,
  }

  // ── 1. Create kind cluster ───────────────────────────────────────────────
  if (!process.env.SKIP_KIND_CREATE) {
    console.log(`[setup] Creating kind cluster "${CLUSTER_NAME}"…`)
    execFile('kind', ['create', 'cluster', '--name', CLUSTER_NAME, '--kubeconfig', KUBECONFIG_PATH, '--wait', '120s'])
    console.log('[setup] Kind cluster ready')
  } else {
    console.log('[setup] SKIP_KIND_CREATE set — reusing existing cluster')
    // Write kubeconfig to the shared path using execFileSync output capture
    const kubeconfig = execFileSync('kind', ['get', 'kubeconfig', '--name', CLUSTER_NAME], { encoding: 'utf8' })
    writeFileSync(KUBECONFIG_PATH, kubeconfig)
  }

  // ── 2. Install kro via Helm ──────────────────────────────────────────────
  console.log('[setup] Installing kro via Helm…')
  const kroVersion = sanitizeVersion(process.env.KRO_CHART_VERSION ?? detectLatestKroVersion())
  console.log(`[setup] Using kro version: ${kroVersion}`)
  execFile('helm', [
    'install', 'kro', 'oci://registry.k8s.io/kro/charts/kro',
    '--version', kroVersion,
    '--namespace', 'kro-system', '--create-namespace',
    '--kubeconfig', KUBECONFIG_PATH,
    '--wait', '--timeout', '120s',
  ])
  console.log('[setup] kro installed')

  // ── 3. Register additional kubeconfig contexts ───────────────────────────
  // Both contexts point at the same cluster — used by journey 007.
  console.log('[setup] Registering alternate kubeconfig contexts…')
  registerAltContext(KUBECONFIG_PATH, PRIMARY_CONTEXT, ALT_CONTEXT)
  registerAltContext(KUBECONFIG_PATH, PRIMARY_CONTEXT, LONG_CONTEXT)
  console.log(`[setup] Contexts registered: ${ALT_CONTEXT}, ${LONG_CONTEXT}`)

  // ── 4. Create test namespace ──────────────────────────────────────────────
  console.log(`[setup] Creating namespace "${NAMESPACE}"…`)
  // Use --dry-run=client | apply pattern via two steps to avoid shell pipe injection
  const nsManifest = execFileSync(
    'kubectl',
    ['--kubeconfig', KUBECONFIG_PATH, 'create', 'namespace', NAMESPACE, '--dry-run=client', '-o', 'yaml'],
    { encoding: 'utf8' }
  )
  execFileSync('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', '-'], {
    input: nsManifest,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  })

  // ── 5. Apply pre-requisite resources ─────────────────────────────────────
  // The external-ref RGD reads this ConfigMap via externalRef. It must exist
  // before the RGD or its instance is applied.
  console.log('[setup] Applying external-ref pre-requisite ConfigMap…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'external-ref-prereq.yaml')])

  // ── 6a. test-app RGD + instance ──────────────────────────────────────────
  console.log('[setup] Applying test-app RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'test-rgd.yaml')])
  console.log('[setup] Waiting for test-app RGD to be Ready…')
  execFile('kubectl', [
    '--kubeconfig', KUBECONFIG_PATH,
    'wait', 'rgd/test-app',
    '--for=condition=Ready', '--timeout=120s',
  ], { retries: 3 })
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'test-instance.yaml')])
  console.log('[setup] Waiting for test-instance to reconcile…')
  execFile('kubectl', [
    '--kubeconfig', KUBECONFIG_PATH,
    'wait', 'namespace/kro-ui-test',
    '--for=jsonpath={.status.phase}=Active', '--timeout=120s',
  ], { retries: 5 })
  console.log('[setup] test-instance reconciled')

  // ── 6b. test-collection RGD + instance ───────────────────────────────────
  // forEach RGD CRD generation is non-deterministic and can exceed 120s on
  // resource-constrained CI runners. We apply the RGD unconditionally (the
  // static DAG in journey 010 steps 1-2 only needs the RGD object to exist),
  // but treat the Ready wait as best-effort. If it times out we set
  // KRO_COLLECTION_READY=false so journey 010 steps 3-5 (live instance) skip
  // gracefully instead of crashing setup for all other journeys.
  console.log('[setup] Applying test-collection RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'test-collection-rgd.yaml')])
  console.log('[setup] Waiting for test-collection RGD to be Ready (best-effort, 120s)…')
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/test-collection',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'test-collection-instance.yaml')])
    console.log('[setup] Waiting for test-collection-instance ConfigMaps to appear…')
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'configmap/test-collection-instance-us-east-1-config',
      '--for=jsonpath={.metadata.name}=test-collection-instance-us-east-1-config',
      '--namespace', NAMESPACE,
      '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    fixtureState.collectionReady = true
    console.log('[setup] test-collection-instance reconciled')
  } catch {
    console.warn('[setup] test-collection RGD did not become Ready in time — journey 010 live-instance steps will be skipped')
  }

  // ── 6c. multi-resource RGD + instance ────────────────────────────────────
  console.log('[setup] Applying multi-resource RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'multi-resource-rgd.yaml')])
  console.log('[setup] Waiting for multi-resource RGD to be Ready…')
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/multi-resource',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'multi-resource-instance.yaml')])
    console.log('[setup] Waiting for multi-resource-instance Deployment to become Available…')
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'deployment/kro-ui-multi-deploy',
      '--for=condition=Available',
      '--namespace', NAMESPACE,
      '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    fixtureState.multiReady = true
    console.log('[setup] multi-resource-instance reconciled')
  } catch {
    console.warn('[setup] multi-resource RGD did not become Ready in time — related journey steps will be skipped')
  }

  // ── 6d. external-ref RGD + instance ──────────────────────────────────────
  console.log('[setup] Applying external-ref RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'external-ref-rgd.yaml')])
  console.log('[setup] Waiting for external-ref RGD to be Ready…')
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/external-ref',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'external-ref-instance.yaml')])
    console.log('[setup] Waiting for external-ref-instance owned ConfigMap to appear…')
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'configmap/kro-ui-echo-echo',
      '--for=jsonpath={.metadata.name}=kro-ui-echo-echo',
      '--namespace', NAMESPACE,
      '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    fixtureState.externalRefReady = true
    console.log('[setup] external-ref-instance reconciled')
  } catch {
    console.warn('[setup] external-ref RGD did not become Ready in time — related journey steps will be skipped')
  }

  // ── 6e. cel-functions RGD + instance ─────────────────────────────────────
  console.log('[setup] Applying cel-functions RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'cel-functions-rgd.yaml')])
  console.log('[setup] Waiting for cel-functions RGD to be Ready…')
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/cel-functions',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'cel-functions-instance.yaml')])
    console.log('[setup] Waiting for cel-functions-instance Deployment to become Available…')
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'deployment/kroui-cel',
      '--for=condition=Available',
      '--namespace', NAMESPACE,
      '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    fixtureState.celFunctionsReady = true
    console.log('[setup] cel-functions-instance reconciled')
  } catch {
    console.warn('[setup] cel-functions RGD did not become Ready in time — related journey steps will be skipped')
  }

  // ── 6f. Chain RGDs (no instances needed for chaining graph tests) ─────────
  console.log('[setup] Applying chain RGDs…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'chain-child.yaml')])
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'chain-parent.yaml')])
  // chain-cycle-a.yaml contains both chain-cycle-a and chain-cycle-b RGDs (multi-doc YAML).
  // These RGDs form a mutual cycle and will never reach Ready — no readiness wait.
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'chain-cycle-a.yaml')])
  console.log('[setup] Chain RGDs applied (including cycle fixtures)')

  // ── 6g. upstream-cartesian-foreach RGD + instance (2D forEach) ───────────
  console.log('[setup] Applying upstream-cartesian-foreach RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-cartesian-foreach-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-cartesian-foreach',
      '--for=condition=Ready', '--timeout=180s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-cartesian-foreach-instance.yaml')])
    fixtureState.cartesianReady = true
    console.log('[setup] upstream-cartesian-foreach ready')
  } catch {
    console.warn('[setup] upstream-cartesian-foreach RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6h. upstream-collection-chain RGD + instance (resource→collection) ───
  console.log('[setup] Applying upstream-collection-chain RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-collection-chain-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-collection-chain',
      '--for=condition=Ready', '--timeout=180s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-collection-chain-instance.yaml')])
    fixtureState.collectionChainReady = true
    console.log('[setup] upstream-collection-chain ready')
  } catch {
    console.warn('[setup] upstream-collection-chain RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6i. upstream-contagious-include-when RGD + instance ───────────────────
  console.log('[setup] Applying upstream-contagious-include-when RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-contagious-include-when-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-contagious-include-when',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-contagious-include-when-instance.yaml')])
    fixtureState.contagiousReady = true
    console.log('[setup] upstream-contagious-include-when ready')
  } catch {
    console.warn('[setup] upstream-contagious-include-when RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6j. upstream-cluster-scoped RGD (no instance — cluster-scoped) ────────
  console.log('[setup] Applying upstream-cluster-scoped RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-cluster-scoped-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-cluster-scoped',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    fixtureState.clusterScopedReady = true
    console.log('[setup] upstream-cluster-scoped ready')
  } catch {
    console.warn('[setup] upstream-cluster-scoped RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6k. upstream-external-collection prereq + RGD + instance ─────────────
  // The external collection RGD reads ConfigMaps by label selector — the prereq
  // ConfigMaps must exist before the instance is applied.
  console.log('[setup] Applying upstream-external-collection prereq ConfigMaps…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-external-collection-prereq.yaml')])
  console.log('[setup] Applying upstream-external-collection RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-external-collection-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-external-collection',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-external-collection-instance.yaml')])
    fixtureState.externalCollectionReady = true
    console.log('[setup] upstream-external-collection ready')
  } catch {
    console.warn('[setup] upstream-external-collection RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6l. upstream-cel-comprehensions RGD + instance ────────────────────────
  console.log('[setup] Applying upstream-cel-comprehensions RGD…')
  execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-cel-comprehensions-rgd.yaml')])
  try {
    execFileSync('kubectl', [
      '--kubeconfig', KUBECONFIG_PATH,
      'wait', 'rgd/upstream-cel-comprehensions',
      '--for=condition=Ready', '--timeout=120s',
    ], { stdio: 'inherit', encoding: 'utf8' })
    execFile('kubectl', ['--kubeconfig', KUBECONFIG_PATH, 'apply', '-f', join(FIXTURES_DIR, 'upstream-cel-comprehensions-instance.yaml')])
    fixtureState.celComprehensionsReady = true
    console.log('[setup] upstream-cel-comprehensions ready')
  } catch {
    console.warn('[setup] upstream-cel-comprehensions RGD did not become Ready — journey steps will be skipped')
  }

  // ── 6m. Write fixture state for worker processes ──────────────────────────
  // Playwright workers run in a separate process from globalSetup — env var
  // mutations here are not visible in tests. Write state to a JSON file instead.
  writeFileSync(FIXTURE_STATE_PATH, JSON.stringify(fixtureState, null, 2))
  console.log(`[setup] Fixture state written to ${FIXTURE_STATE_PATH}:`, fixtureState)

  // ── 7. Build kro-ui binary if needed ─────────────────────────────────────
  const binaryPath = process.env.KRO_UI_BINARY ?? join(ROOT_DIR, 'bin', 'kro-ui')
  if (!existsSync(binaryPath)) {
    console.log('[setup] Building kro-ui binary…')
    execSync('make build', { cwd: ROOT_DIR, stdio: 'inherit' })
    console.log('[setup] Binary built')
  }

  // ── 8. Start kro-ui server ────────────────────────────────────────────────
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

  // ── 9. Wait for healthz ───────────────────────────────────────────────────
  console.log('[setup] Waiting for kro-ui to be ready…')
  await waitForHealthz(`http://localhost:${PORT}/api/v1/healthz`, 30_000)
  console.log(`[setup] kro-ui ready at http://localhost:${PORT}`)
  console.log('[setup] Global setup complete\n')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * execFile wraps execFileSync with retry support. Uses an argument array (no
 * shell) so env-derived values cannot be interpreted as shell metacharacters.
 */
function execFile(
  binary: string,
  args: string[],
  opts: { cwd?: string; retries?: number } = {},
) {
  const { cwd = ROOT_DIR, retries = 0 } = opts
  for (let i = 0; i <= retries; i++) {
    try {
      execFileSync(binary, args, { cwd, stdio: 'inherit', encoding: 'utf8' })
      return
    } catch (err) {
      if (i === retries) throw err
      console.warn(`[setup] Command failed (attempt ${i + 1}/${retries + 1}), retrying…`)
    }
  }
}

/**
 * Validate that a version string is a plain semver (digits and dots only).
 * Throws if the value contains unexpected characters that could be used for
 * shell injection.
 */
function sanitizeVersion(version: string): string {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid version string "${version}" — expected semver like "0.8.5"`)
  }
  return version
}

/**
 * registerAltContext copies an existing kubeconfig context under a new name.
 * Both contexts share the same cluster and credentials — used by journey 007
 * to test the context-switcher UI without needing a second real cluster.
 */
function registerAltContext(kubeconfigPath: string, sourceContext: string, newContextName: string) {
  // Get the cluster and user from the source context
  const cluster = execFileSync(
    'kubectl',
    ['--kubeconfig', kubeconfigPath, 'config', 'view',
     '-o', `jsonpath={.contexts[?(@.name=="${sourceContext}")].context.cluster}`],
    { encoding: 'utf8' }
  ).trim()
  const user = execFileSync(
    'kubectl',
    ['--kubeconfig', kubeconfigPath, 'config', 'view',
     '-o', `jsonpath={.contexts[?(@.name=="${sourceContext}")].context.user}`],
    { encoding: 'utf8' }
  ).trim()
  // Set new context pointing at the same cluster+user
  execFileSync(
    'kubectl',
    ['--kubeconfig', kubeconfigPath, 'config', 'set-context', newContextName,
     `--cluster=${cluster}`, `--user=${user}`],
    { stdio: 'inherit', encoding: 'utf8' }
  )
}

/**
 * detectLatestKroVersion fetches the latest release tag from the kro GitHub repo.
 * Returns the version without the leading "v" (e.g., "0.8.5").
 * Falls back to a known-good version if the API call fails.
 */
function detectLatestKroVersion(): string {
  const FALLBACK_VERSION = '0.8.5'
  try {
    const output = execFileSync(
      'curl',
      ['-sL', 'https://api.github.com/repos/kubernetes-sigs/kro/releases/latest'],
      { encoding: 'utf8', timeout: 10_000 }
    )
    const release = JSON.parse(output)
    const tag = release?.tag_name ?? ''
    const version = tag.replace(/^v/, '')
    if (!version) {
      console.warn(`[setup] Could not parse kro version from tag "${tag}", using fallback ${FALLBACK_VERSION}`)
      return FALLBACK_VERSION
    }
    return version
  } catch (err) {
    console.warn(`[setup] Failed to detect latest kro version, using fallback ${FALLBACK_VERSION}`)
    return FALLBACK_VERSION
  }
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
