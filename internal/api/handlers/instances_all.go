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
// Fan-out: one goroutine per RGD, each with a 2s deadline (constitution §XI).
// Response: {"items": [...InstanceSummary...], "total": N}
//
// Used by the global instance search page (/instances) in the frontend.
// Spec: .specify/specs/058-global-instance-search/spec.md

import (
	"context"
	"net/http"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	// CreationTimestamp is RFC3339 — used by the frontend for age display.
	CreationTimestamp string `json:"creationTimestamp"`
}

// ListAllInstancesResponse is the response payload for GET /api/v1/instances.
type ListAllInstancesResponse struct {
	Items []InstanceSummary `json:"items"`
	Total int               `json:"total"`
}

// perRGDAllInstancesTimeout is the deadline for listing instances of each RGD
// in the fan-out. Kept short to honour the 5s total handler budget.
const perRGDAllInstancesTimeout = 2

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
		mu    sync.Mutex
		wg    sync.WaitGroup
		items = make([]InstanceSummary, 0, len(rgdList.Items)*2)
	)

	wg.Add(len(rgdList.Items))

	for i := range rgdList.Items {
		rgd := &rgdList.Items[i]
		go func() {
			defer wg.Done()

			rgdName := rgd.GetName()
			rctx, cancel := context.WithTimeout(r.Context(), perRGDAllInstancesTimeout*1_000_000_000)
			defer cancel()

			gvr, err := h.resolveInstanceGVR(rctx, rgdName)
			if err != nil {
				log.Debug().Err(err).Str("rgd", rgdName).Msg("ListAllInstances: skip RGD — cannot resolve GVR")
				return
			}

			list, err := h.factory.Dynamic().Resource(gvr).List(rctx, metav1.ListOptions{})
			if err != nil {
				log.Debug().Err(err).Str("rgd", rgdName).Msg("ListAllInstances: skip RGD — list failed")
				return
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
				kind := strings.TrimSpace(obj.GetKind())

				summaries = append(summaries, InstanceSummary{
					Name:              name,
					Namespace:         obj.GetNamespace(),
					Kind:              kind,
					RGDName:           rgdName,
					State:             stateStr,
					Ready:             ready,
					CreationTimestamp: createdAt,
				})
			}

			mu.Lock()
			items = append(items, summaries...)
			mu.Unlock()
		}()
	}

	wg.Wait()

	resp := ListAllInstancesResponse{
		Items: items,
		Total: len(items),
	}
	log.Debug().Int("total", resp.Total).Msg("ListAllInstances: done")
	respond(w, http.StatusOK, resp)
}
