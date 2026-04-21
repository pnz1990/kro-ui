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

// ListAllInstances returns a flat list of all live CR instances across all active RGDs.
// Fan-out: one goroutine per RGD, each with a 5s deadline (constitution §XI; was 2s, increased in PR #352).
// Uses errgroup so request cancellation (client disconnect) propagates to all goroutines.
// Response: {"items": [...InstanceSummary...], "total": N, "rbacHidden": N}
//
// Used by the global instance search page (/instances) in the frontend.
// Spec: .specify/specs/058-global-instance-search/spec.md
// Partial-RBAC spec: .specify/specs/issue-574/spec.md

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// InstanceSummary is a compact representation of one live instance.
// All fields are safe to send to the frontend without exposing secret data.
type InstanceSummary struct {
	// Name is the instance CR name.
	Name string `json:"name"`
	// Namespace is the instance CR namespace. Empty for cluster-scoped instances.
	Namespace string `json:"namespace"`
	// Kind is the generated CRD kind (e.g., "WebApp", "NeverReadyApp").
	Kind string `json:"kind"`
	// RGDName is the ResourceGraphDefinition name that generated this instance's CRD.
	RGDName string `json:"rgdName"`
	// State is the kro-managed state: Active, Inactive, Deleting, or the condition summary.
	State string `json:"state"`
	// Ready is the value of the Ready condition: "True", "False", or "Unknown".
	Ready string `json:"ready"`
	// Message is the Ready condition's message (empty for healthy instances).
	// Shown as a tooltip on the status indicator to explain why an instance is not ready.
	Message string `json:"message,omitempty"`
	// CreationTimestamp is RFC3339 — used by the frontend for age display.
	CreationTimestamp string `json:"creationTimestamp"`
}

// ListAllInstancesResponse is the response payload for GET /api/v1/instances.
type ListAllInstancesResponse struct {
	Items []InstanceSummary `json:"items"`
	Total int               `json:"total"`
	// RBACHidden is the number of RGDs whose instance list was skipped due to
	// Forbidden / RBAC errors. A non-zero value means partial results are returned.
	// Spec: .specify/specs/issue-574/spec.md  O1
	RBACHidden int `json:"rbacHidden"`
}

// perRGDAllInstancesTimeout is the deadline for listing instances of each RGD
// in the fan-out. All goroutines run in parallel so the total handler latency
// is approximately max(individual_request_latency).
//
// Increased to 5s (was 2s): on throttled clusters the DiscoverPlural call alone
// can take 1-2s, leaving insufficient time for the List call under the 2s limit.
// Since goroutines run in parallel the overall handler stays within the 5s budget.
// Typed as time.Duration to prevent accidental raw nanosecond arithmetic.
const perRGDAllInstancesTimeout = 5 * time.Second

func (h *Handler) ListAllInstances(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	// Fetch all RGDs to drive the fan-out.
	rgdList, err := h.factory.Dynamic().Resource(rgdGVR).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		log.Error().Err(err).Msg("ListAllInstances: failed to list RGDs")
		respondError(w, http.StatusInternalServerError, "failed to list RGDs: "+err.Error())
		return
	}

	var (
		mu         sync.Mutex
		items      = make([]InstanceSummary, 0, len(rgdList.Items)*2)
		rbacHidden int32 // accessed via atomic to avoid holding mu across log calls
	)

	// errgroup propagates request cancellation to all goroutines — if the
	// HTTP client disconnects, in-flight k8s List calls are cancelled promptly.
	// We never return the group error (each RGD is best-effort), but the
	// group's derived context ensures goroutines stop early on cancellation.
	g, gctx := errgroup.WithContext(r.Context())

	for i := range rgdList.Items {
		rgd := &rgdList.Items[i]
		g.Go(func() error {
			rgdName := rgd.GetName()
			rctx, cancel := context.WithTimeout(gctx, perRGDAllInstancesTimeout)
			defer cancel()

			// Extract kind/group/version from the already-fetched RGD object —
			// avoids a second per-RGD API call that would re-fetch the RGD.
			// This halves the number of API calls compared to calling resolveInstanceGVR.
			kind, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "kind")
			group, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "group")
			version, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "apiVersion")
			if kind == "" {
				log.Debug().Str("rgd", rgdName).Msg("ListAllInstances: skip RGD — no schema kind")
				return nil
			}
			if group == "" {
				group = k8sclient.KroGroup
			}
			if version == "" {
				version = "v1alpha1"
			}

			plural, err := k8sclient.DiscoverPlural(h.factory, group, version, kind)
			if err != nil {
				plural = strings.ToLower(kind) + "s"
			}
			gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: plural}

			list, err := h.factory.Dynamic().Resource(gvr).List(rctx, metav1.ListOptions{})
			if err != nil {
				if isForbiddenError(err) {
					// RBAC / partial results: count hidden RGDs, degrade gracefully.
					// Spec: .specify/specs/issue-574/spec.md  O1
					atomic.AddInt32(&rbacHidden, 1)
					log.Warn().Err(err).Str("rgd", rgdName).Msg("ListAllInstances: skip RGD — forbidden (RBAC)")
				} else {
					// Other errors (network, CRD missing, etc.) — warn but still skip.
					log.Warn().Err(err).Str("rgd", rgdName).Msg("ListAllInstances: skip RGD — list failed (unavailable)")
				}
				return nil
			}

			summaries := make([]InstanceSummary, 0, len(list.Items))
			for j := range list.Items {
				obj := &list.Items[j]
				meta := obj.Object["metadata"]
				if meta == nil {
					continue
				}

				name := obj.GetName()
				if name == "" {
					continue
				}

				// Extract ready condition from status.conditions
				ready := "Unknown"
				readyMessage := ""
				stateStr := ""
				if statusObj, ok := obj.Object["status"].(map[string]any); ok {
					if s, ok := statusObj["state"].(string); ok {
						stateStr = s
					}
					if conds, ok := statusObj["conditions"].([]any); ok {
						for _, c := range conds {
							if cm, ok := c.(map[string]any); ok {
								if cm["type"] == "Ready" {
									if s, ok := cm["status"].(string); ok {
										ready = s
									}
									// Only surface the message when Ready≠True (failure/unknown)
									if ready != "True" {
										if msg, ok := cm["message"].(string); ok && msg != "" {
											readyMessage = msg
										}
									}
								}
							}
						}
					}
				}

				createdAt := ""
				if ts := obj.GetCreationTimestamp(); !ts.IsZero() {
					createdAt = ts.UTC().Format("2006-01-02T15:04:05Z")
				}

				// kind comes from the CRD kind embedded in the object itself
				objKind := strings.TrimSpace(obj.GetKind())

				summaries = append(summaries, InstanceSummary{
					Name:              name,
					Namespace:         obj.GetNamespace(),
					Kind:              objKind,
					RGDName:           rgdName,
					State:             stateStr,
					Ready:             ready,
					Message:           readyMessage,
					CreationTimestamp: createdAt,
				})
			}

			mu.Lock()
			items = append(items, summaries...)
			mu.Unlock()
			return nil
		})
	}

	// Wait for all goroutines. We ignore the error return because each goroutine
	// returns nil on RGD-level failures (best-effort) and only the group context
	// cancellation (client disconnect) would propagate non-nil errors — in that
	// case we still respond with whatever was collected.
	_ = g.Wait()

	hidden := int(atomic.LoadInt32(&rbacHidden))
	resp := ListAllInstancesResponse{
		Items:      items,
		Total:      len(items),
		RBACHidden: hidden,
	}
	if hidden > 0 {
		log.Warn().Int("rbacHidden", hidden).Msg("ListAllInstances: partial results — some RGDs hidden by RBAC")
	}
	log.Debug().Int("total", resp.Total).Msg("ListAllInstances: done")
	respond(w, http.StatusOK, resp)
}

// isForbiddenError returns true when err represents an RBAC access denial.
// Checks both the k8s API machinery status error type and the error string
// to cover edge cases where the error is wrapped or not a StatusError.
func isForbiddenError(err error) bool {
	if err == nil {
		return false
	}
	if k8serrors.IsForbidden(err) {
		return true
	}
	// Fallback: string check for proxied or wrapped errors
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "forbidden") || strings.Contains(msg, "unauthorized")
}
