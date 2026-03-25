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

// Package handlers wires HTTP handlers for all API routes.
// All handlers are thin: they call the k8s package, marshal to JSON, and return.
package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// k8sClients provides access to the Kubernetes dynamic and discovery clients.
// Defined at the consumption site per constitution §VI.
type k8sClients interface {
	Dynamic() dynamic.Interface
	Discovery() discovery.DiscoveryInterface
	// CachedServerGroupsAndResources returns all API resource lists from a
	// ≥30-second cache. Required by k8s.K8sClients (Constitution §XI).
	CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error)
}

// metricsDiscoverer discovers the kro controller pod for a given kubeconfig context
// and proxies the /metrics scrape through the kube-apiserver pod proxy.
// Defined at the consumption site per constitution §VI.
// An empty contextName means "use the currently active context".
type metricsDiscoverer interface {
	ScrapeMetrics(ctx context.Context, contextName string) (*k8sclient.ControllerMetrics, error)
}

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	factory      k8sClients
	ctxMgr       contextManager
	fleetBuilder fleetClientBuilder
	metrics      metricsDiscoverer
}

// New creates a Handler with the given ClientFactory.
// The MetricsDiscoverer is constructed internally and uses pod-proxy discovery
// instead of a hardcoded URL (spec 040 — FR-002, FR-003).
func New(factory *k8sclient.ClientFactory) *Handler {
	return &Handler{
		factory: factory,
		ctxMgr:  factory,
		fleetBuilder: &realFleetClientBuilder{
			kubeconfigPath: factory.KubeconfigPath(),
		},
		metrics: k8sclient.NewMetricsDiscoverer(factory),
	}
}

// respond encodes v as JSON and writes it to w with the given status.
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// respondError writes a JSON error response.
func respondError(w http.ResponseWriter, status int, msg string) {
	respond(w, status, types.ErrorResponse{Error: msg})
}
