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
#   make demo                                            # create kind cluster + install kro + load fixtures
#   DEMO_SKIP_KIND_CREATE=true KUBECONFIG=~/.kube/config make demo  # use existing cluster
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
KUBECONFIG_PATH="${KUBECONFIG:-${ROOT_DIR}/.demo-kubeconfig.yaml}"
FALLBACK_KRO_VERSION="0.8.5"

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
if [[ -z "${DEMO_SKIP_KIND_CREATE:-}" ]]; then
  info "Creating kind cluster '${CLUSTER_NAME}'…"
  kind create cluster --name "${CLUSTER_NAME}" --kubeconfig "${KUBECONFIG_PATH}" --wait 120s
  ok "Kind cluster ready"
else
  info "DEMO_SKIP_KIND_CREATE set — using existing cluster"
  export KUBECONFIG="${KUBECONFIG_PATH}"
fi

KC=(kubectl --kubeconfig "${KUBECONFIG_PATH}")

# ── 2. Install kro via Helm ───────────────────────────────────────────────────
if [[ -z "${DEMO_SKIP_KIND_CREATE:-}" ]]; then
  info "Installing kro ${KRO_VERSION} via Helm…"
  helm install kro oci://registry.k8s.io/kro/charts/kro \
    --version "${KRO_VERSION}" \
    --namespace kro-system --create-namespace \
    --kubeconfig "${KUBECONFIG_PATH}" \
    --wait --timeout 120s
  ok "kro installed"
else
  info "Skipping kro installation (using existing cluster)"
fi

# ── 3. Create demo namespace ──────────────────────────────────────────────────
info "Creating namespace '${NAMESPACE}'…"
"${KC[@]}" create namespace "${NAMESPACE}" --dry-run=client -o yaml \
  | "${KC[@]}" apply -f -

# ── 4. Apply pre-requisite resources ─────────────────────────────────────────
info "Applying external-ref pre-requisite ConfigMap…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/external-ref-prereq.yaml"

# ── Helper: wait_rgd_ready <name> <timeout> ───────────────────────────────────
wait_rgd_ready() {
  local name="$1" timeout="${2:-120s}"
  info "Waiting for RGD '${name}' to be Ready (timeout: ${timeout})…"
  "${KC[@]}" wait "rgd/${name}" --for=condition=Ready "--timeout=${timeout}"
}

# ── 5. Apply all RGDs and instances ──────────────────────────────────────────

# test-app
info "Applying test-app RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-rgd.yaml"
wait_rgd_ready test-app 120s
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-instance.yaml"

# test-collection (forEach — needs longer timeout for CRD generation)
info "Applying test-collection RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-collection-rgd.yaml"
wait_rgd_ready test-collection 180s
"${KC[@]}" apply -f "${FIXTURES_DIR}/test-collection-instance.yaml"

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

# cel-functions
info "Applying cel-functions RGD + instance…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/cel-functions-rgd.yaml"
wait_rgd_ready cel-functions 120s
"${KC[@]}" apply -f "${FIXTURES_DIR}/cel-functions-instance.yaml"

# chain RGDs (no instances needed)
info "Applying chain RGDs…"
"${KC[@]}" apply -f "${FIXTURES_DIR}/chain-child.yaml"
"${KC[@]}" apply -f "${FIXTURES_DIR}/chain-parent.yaml"

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
