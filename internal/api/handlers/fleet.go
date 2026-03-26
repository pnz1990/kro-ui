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

package handlers

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// fleetClientBuilder builds ephemeral clients for a single kubeconfig context.
// Defined at the consumption site per constitution §VI.
type fleetClientBuilder interface {
	BuildClient(kubeconfigPath, context string) (k8sclient.K8sClients, error)
}

// realFleetClientBuilder delegates to k8sclient.BuildContextClient.
type realFleetClientBuilder struct {
	kubeconfigPath string
}

func (b *realFleetClientBuilder) BuildClient(kubeconfigPath, ctx string) (k8sclient.K8sClients, error) {
	return k8sclient.BuildContextClient(kubeconfigPath, ctx)
}

// FleetSummary returns per-context summaries for all kubeconfig contexts.
// It fans out in parallel, bounded by the route-level 30s timeout in server.go.
// One unreachable cluster never blocks others (FR-003).
func (h *Handler) FleetSummary(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	contexts, _, err := h.ctxMgr.ListContexts()
	if err != nil {
		log.Error().Err(err).Msg("failed to list contexts for fleet summary")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	summaries := make([]types.ClusterSummary, len(contexts))
	var wg sync.WaitGroup
	for i, c := range contexts {
		wg.Add(1)
		go func(idx int, ctx k8sclient.Context) {
			defer wg.Done()
			summaries[idx] = h.summariseContext(r.Context(), ctx)
		}(i, c)
	}
	wg.Wait()

	respond(w, http.StatusOK, types.FleetSummaryResponse{Clusters: summaries})
}

// summariseContext builds a ClusterSummary for a single context.
// All errors are captured in the summary — never propagated up.
func (h *Handler) summariseContext(parent context.Context, ctx k8sclient.Context) types.ClusterSummary {
	summary := types.ClusterSummary{
		Context: ctx.Name,
		Cluster: ctx.Cluster,
	}

	// parent is already bounded by the route-level 30s timeout (server.go).
	// No additional per-cluster deadline is added here — the per-RGD goroutines
	// each apply their own 2s deadline via rctx (Constitution §XI).

	// Build ephemeral clients — does NOT affect the shared ClientFactory.
	var kubeconfigPath string
	if kpf, ok := h.ctxMgr.(interface{ KubeconfigPath() string }); ok {
		kubeconfigPath = kpf.KubeconfigPath()
	}

	clients, err := h.fleetBuilder.BuildClient(kubeconfigPath, ctx.Name)
	if err != nil {
		summary.Health = types.ClusterUnreachable
		summary.Error = err.Error()
		return summary
	}

	// List RGDs to determine kro presence and count.
	list, err := clients.Dynamic().Resource(rgdGVR).List(parent, metav1.ListOptions{})
	if err != nil {
		// Distinguish kro-not-installed from generic unreachability.
		errStr := err.Error()
		if isKroNotInstalled(errStr) {
			summary.Health = types.ClusterKroNotInstalled
		} else if isAuthError(errStr) {
			summary.Health = types.ClusterAuthFailed
		} else {
			summary.Health = types.ClusterKroNotInstalled // CRD absent or API unreachable
		}
		summary.Error = errStr
		return summary
	}

	summary.RGDCount = len(list.Items)

	// For each RGD, build the GVR and fan out instance list calls concurrently.
	// DiscoverPlural now reads from the TTL cache (issue #192/Bug A) so calling
	// it once per RGD no longer incurs N sequential API server discovery requests.
	// The errgroup with a 2s per-resource timeout prevents any single slow resource
	// from holding up the rest. Constitution §XI.
	type rgdEntry struct {
		kind       string
		group      string
		apiVersion string
	}
	entries := make([]rgdEntry, 0, len(list.Items))
	kinds := make([]string, 0, len(list.Items))
	for _, rgd := range list.Items {
		kind, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "kind")
		group, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "group")
		apiVersion, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "apiVersion")
		if kind == "" {
			continue
		}
		if group == "" {
			group = k8sclient.KroGroup
		}
		if apiVersion == "" {
			apiVersion = "v1alpha1"
		}
		entries = append(entries, rgdEntry{kind, group, apiVersion})
		kinds = append(kinds, kind)
	}

	type instanceResult struct {
		count    int
		degraded int
	}
	results := make([]instanceResult, len(entries))
	var mu sync.Mutex
	// Use the derived context from errgroup so any early cancellation propagates
	// to all goroutines (Constitution §XI; fixes issue #226).
	g, gctx := errgroup.WithContext(parent)
	for i, entry := range entries {
		i, entry := i, entry // capture
		g.Go(func() error {
			rctx, rcancel := context.WithTimeout(gctx, 2*time.Second)
			defer rcancel()

			plural, err := k8sclient.DiscoverPlural(clients, entry.group, entry.apiVersion, entry.kind)
			if err != nil {
				plural = strings.ToLower(entry.kind) + "s"
			}

			instanceGVR := rgdGVR
			instanceGVR.Group = entry.group
			instanceGVR.Version = entry.apiVersion
			instanceGVR.Resource = plural

			instances, err := clients.Dynamic().Resource(instanceGVR).List(rctx, metav1.ListOptions{})
			if err != nil || instances == nil {
				return nil // non-fatal: count stays 0 for this RGD
			}

			deg := 0
			for _, inst := range instances.Items {
				if isInstanceDegraded(inst.Object) {
					deg++
				}
			}
			mu.Lock()
			results[i] = instanceResult{len(instances.Items), deg}
			mu.Unlock()
			return nil
		})
	}
	_ = g.Wait() // errors are non-fatal; partial results are acceptable

	totalInstances := 0
	degraded := 0
	for _, r := range results {
		totalInstances += r.count
		degraded += r.degraded
	}

	summary.InstanceCount = totalInstances
	summary.DegradedInstances = degraded
	summary.RGDKinds = kinds
	if degraded > 0 {
		summary.Health = types.ClusterDegraded
	} else {
		summary.Health = types.ClusterHealthy
	}
	return summary
}

// isInstanceDegraded returns true if the instance has a Ready=False condition.
func isInstanceDegraded(obj map[string]any) bool {
	status, ok := obj["status"].(map[string]any)
	if !ok {
		return false
	}
	conditions, ok := status["conditions"].([]any)
	if !ok {
		return false
	}
	for _, c := range conditions {
		cond, ok := c.(map[string]any)
		if !ok {
			continue
		}
		condType, _ := cond["type"].(string)
		condStatus, _ := cond["status"].(string)
		if condType == "Ready" && condStatus == "False" {
			return true
		}
	}
	return false
}

// isKroNotInstalled returns true when the error indicates the RGD CRD is absent.
func isKroNotInstalled(errStr string) bool {
	return strings.Contains(errStr, "no matches for kind") ||
		strings.Contains(errStr, "resource not found") ||
		strings.Contains(errStr, "not found in") ||
		strings.Contains(errStr, "the server could not find the requested resource")
}

// isAuthError returns true for 401/403 errors.
func isAuthError(errStr string) bool {
	return strings.Contains(errStr, "Unauthorized") ||
		strings.Contains(errStr, "Forbidden") ||
		strings.Contains(errStr, "401") ||
		strings.Contains(errStr, "403")
}
