#!/usr/bin/env bash
# Copyright 2026 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# demo.sh — spin up a local kro-ui demo environment.
#
# Usage:
#   make demo                 # idempotent — creates the kind cluster if needed, reuses it if it exists
#                             # re-running on an existing cluster is safe: cluster, kro, and fixtures
#                             # are all applied idempotently (create-or-reuse / apply)
#
# The demo ALWAYS uses .demo-kubeconfig.yaml in the repo root — it never
# touches ~/.kube/config or any production cluster.
#
# Prerequisites (not installed automatically):
#   - kind   https://kind.sigs.k8s.io/docs/user/quick-start/#installation
#   - helm   https://helm.sh/docs/intro/install/
#   - kubectl https://kubernetes.io/docs/tasks/tools/
#
# The kro-ui binary must already be built (make build runs it first via the
# Makefile dependency). The server is started at the end and runs until Ctrl+C.
# The kind cluster is left running so you can keep exploring after the server stops.

set -euo pipefail

CLUSTER_NAME="${DEMO_CLUSTER_NAME:-kro-ui-demo}"
NAMESPACE="kro-ui-demo"
PORT="${KRO_UI_PORT:-40107}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURES_DIR="${ROOT_DIR}/test/e2e/fixtures"
BINARY="${ROOT_DIR}/bin/kro-ui"
KUBECONFIG_PATH="${ROOT_DIR}/.demo-kubeconfig.yaml"
FALLBACK_KRO_VERSION="0.9.0"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

info()  { printf "${BLUE}[demo]${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}[demo]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[demo]${RESET} %s\n" "$*" >&2; }

# ── Pre-flight: check required tools ─────────────────────────────────────────
missing=()
for tool in kind helm kubectl; do
  if ! command -v "${tool}" &>/dev/null; then
    missing+=("${tool}")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  warn "Missing required tools: ${missing[*]}"
  warn ""
  warn "Install them and re-run:"
  warn "  kind    → https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  warn "  helm    → https://helm.sh/docs/intro/install/"
  warn "  kubectl → https://kubernetes.io/docs/tasks/tools/"
  exit 1
fi

if [[ ! -f "${BINARY}" ]]; then
  warn "Binary not found at ${BINARY} — run 'make build' first"
  exit 1
fi

# ── Detect latest kro version ─────────────────────────────────────────────────
detect_kro_version() {
  local version
  if version=$(curl -sL --max-time 10 \
      'https://api.github.com/repos/kubernetes-sigs/kro/releases/latest' \
      2>/dev/null | grep '"tag_name"' | head -1 | sed 's/.*"v\([^"]*\)".*/\1/'); then
    if [[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "${version}"
      return
    fi
  fi
  warn "Could not detect latest kro version — using fallback ${FALLBACK_KRO_VERSION}"
  echo "${FALLBACK_KRO_VERSION}"
}

KRO_VERSION="${KRO_CHART_VERSION:-$(detect_kro_version)}"

# ── 1. Create kind cluster ────────────────────────────────────────────────────
if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  info "Kind cluster '${CLUSTER_NAME}' already exists — reusing"
  # Ensure the kubeconfig is up to date (no-op if already written)
  kind export kubeconfig --name "${CLUSTER_NAME}" --kubeconfig "${KUBECONFIG_PATH}" 2>/dev/null || true
else
  info "Creating kind cluster '${CLUSTER_NAME}'…"
  kind create cluster --name "${CLUSTER_NAME}" --kubeconfig "${KUBECONFIG_PATH}" --wait 120s
  ok "Kind cluster ready"
fi

KC=(kubectl --kubeconfig "${KUBECONFIG_PATH}")

# ── 2. Install/upgrade kro via Helm ──────────────────────────────────────────
# Use `helm upgrade --install` so re-running on an existing cluster upgrades kro.
info "Installing/upgrading kro ${KRO_VERSION} via Helm…"
helm upgrade --install kro oci://registry.k8s.io/kro/charts/kro \
  --version "${KRO_VERSION}" \
  --namespace kro-system --create-namespace \
  --kubeconfig "${KUBECONFIG_PATH}" \
  --wait --timeout 120s
ok "kro ${KRO_VERSION} ready"

# kro v0.9.0+: apply the GraphRevision CRD which lives in helm/crds/ (not
# helm/templates/) and is therefore NOT installed by `helm upgrade`.
# Without it kro logs "CRD should be installed before calling Start" and
# lastIssuedRevision never appears in RGD status.
info "Applying GraphRevision CRD (kro v0.9.0+)…"
curl -sL "https://raw.githubusercontent.com/kubernetes-sigs/kro/v${KRO_VERSION}/helm/crds/internal.kro.run_graphrevisions.yaml" \
  | kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f - 2>/dev/null \
  || warn "GraphRevision CRD not available for kro v${KRO_VERSION} — skipping (pre-v0.9.0 cluster)"

# ── 3. Create demo namespace ──────────────────────────────────────────────────
info "Creating namespace '${NAMESPACE}'…"
"${KC[@]}" create namespace "${NAMESPACE}" --dry-run=client -o yaml \
  | "${KC[@]}" apply -f -

# ── 4. Apply pre-requisite resources ─────────────────────────────────────────
# The external-ref prereq fixture lives in namespace kro-ui-e2e (shared with E2E tests).
info "Creating namespace 'kro-ui-e2e' for external-ref prereq…"
"${KC[@]}" create namespace kro-ui-e2e --dry-run=client -o yaml \
  | "${KC[@]}" apply -f -

info "Applying external-ref pre-requisite ConfigMap…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/external-ref-prereq.yaml"

# ── Helper: wait_rgd_ready <name> <timeout> [optional] ───────────────────────
# Pass a third argument (any value) to make the wait non-fatal.
wait_rgd_ready() {
  local name="$1" timeout="${2:-120s}" optional="${3:-}"
  info "Waiting for RGD '${name}' to be Ready (timeout: ${timeout})…"
  if "${KC[@]}" wait "rgd/${name}" --for=condition=Ready "--timeout=${timeout}"; then
    return 0
  fi
  if [[ -n "${optional}" ]]; then
    warn "RGD '${name}' did not become Ready within ${timeout} — continuing anyway (optional fixture)"
    return 0
  fi
  return 1
}

# ── 5. Apply all RGDs and instances ──────────────────────────────────────────

# test-app
info "Applying test-app RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-rgd.yaml"
wait_rgd_ready test-app 120s
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-instance.yaml"

# test-collection (forEach — uses array type; may not be supported by all kro builds)
info "Applying test-collection RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-collection-rgd.yaml"
wait_rgd_ready test-collection 180s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-collection-instance.yaml" 2>/dev/null || true

# multi-resource
info "Applying multi-resource RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/multi-resource-rgd.yaml"
wait_rgd_ready multi-resource 120s
"${KC[@]}" apply -f "${FIXTURES_DIR}/multi-resource-instance.yaml"

# external-ref
info "Applying external-ref RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/external-ref-rgd.yaml"
wait_rgd_ready external-ref 120s
"${KC[@]}" apply -f "${FIXTURES_DIR}/external-ref-instance.yaml"

# cel-functions (uses quantity() CEL function — requires kro v0.3.0+; optional)
info "Applying cel-functions RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/cel-functions-rgd.yaml"
wait_rgd_ready cel-functions 120s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/cel-functions-instance.yaml" 2>/dev/null || true

# chain RGDs (no instances needed)
info "Applying chain RGDs…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/chain-child.yaml"
"${KC[@]}" apply -f "${FIXTURES_DIR}/chain-parent.yaml"
# chain-cycle-a.yaml: mutual cycle RGDs — never reach Ready; apply non-fatally
info "Applying chain-cycle RGDs (cycle detection demo)…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/chain-cycle-a.yaml" 2>/dev/null || true

# upstream fixture families (spec 043-upstream-fixture-generator)
info "Applying upstream-cartesian-foreach RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-cartesian-foreach-rgd.yaml"
wait_rgd_ready upstream-cartesian-foreach 180s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-cartesian-foreach-instance.yaml" 2>/dev/null || true

info "Applying upstream-collection-chain RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-collection-chain-rgd.yaml"
wait_rgd_ready upstream-collection-chain 180s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-collection-chain-instance.yaml" 2>/dev/null || true

info "Applying upstream-contagious-include-when RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-contagious-include-when-rgd.yaml"
wait_rgd_ready upstream-contagious-include-when 120s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-contagious-include-when-instance.yaml" 2>/dev/null || true

info "Applying upstream-cluster-scoped RGD (no instance — requires kro v0.9.0+)…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-cluster-scoped-rgd.yaml" 2>/dev/null || \
  { warn "upstream-cluster-scoped skipped (kro < v0.9.0 does not support scope field)"; true; }
wait_rgd_ready upstream-cluster-scoped 120s optional

info "Applying upstream-external-collection prereq + RGD + instance (requires kro v0.9.0+)…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-external-collection-prereq.yaml" 2>/dev/null || true
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-external-collection-rgd.yaml" 2>/dev/null || \
  { warn "upstream-external-collection skipped (kro < v0.9.0 does not support externalRef.metadata.selector)"; true; }
wait_rgd_ready upstream-external-collection 120s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-external-collection-instance.yaml" 2>/dev/null || true

info "Applying upstream-cel-comprehensions RGD + instance (requires kro v0.9.0+)…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-cel-comprehensions-rgd.yaml" 2>/dev/null || \
  { warn "upstream-cel-comprehensions skipped (kro < v0.9.0 does not support transformMap/transformList)"; true; }
wait_rgd_ready upstream-cel-comprehensions 120s optional
"${KC[@]}" apply -f "${FIXTURES_DIR}/upstream-cel-comprehensions-instance.yaml" 2>/dev/null || true

ok "All fixtures applied"

# ── 6. Start kro-ui server ────────────────────────────────────────────────────
PRIMARY_CONTEXT="kind-${CLUSTER_NAME}"
if [[ -n "${DEMO_SKIP_KIND_CREATE:-}" ]]; then
  PRIMARY_CONTEXT="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" config current-context 2>/dev/null || echo "")"
fi

printf "\n"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "  kro-ui demo ready!"
ok "  URL: http://localhost:${PORT}"
ok "  Press Ctrl+C to stop the server."
ok "  Cluster '${CLUSTER_NAME}' will keep running."
ok "  To delete it: make demo-clean"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "\n"

# Trap Ctrl+C to print a friendly goodbye
trap 'printf "\n"; ok "Server stopped. Cluster is still running: kind get clusters"; exit 0' INT

"${BINARY}" serve \
  --port "${PORT}" \
  --kubeconfig "${KUBECONFIG_PATH}" \
  ${PRIMARY_CONTEXT:+--context "${PRIMARY_CONTEXT}"}
