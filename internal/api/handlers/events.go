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
	"sync"
	"time"

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var eventsGVR = schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}

// perRGDTimeout is the per-RGD deadline for the instance-list fan-out in
// buildRelevantUIDs. Constitution §XI: fan-out list operations must use a
// per-goroutine timeout of 5 seconds (same as ListAllInstances — see PR #352).
const perRGDTimeout = 5 * time.Second

// ListEvents returns Kubernetes Events filtered to kro-relevant objects.
//
// Query params:
//   - namespace: scope events to a single namespace (empty = all namespaces, if RBAC allows)
//   - rgd: filter to instances of a specific ResourceGraphDefinition
//
// kro-relevance is determined by building a set of UIDs for:
//  1. All ResourceGraphDefinition objects (cluster-scoped)
//  2. All kro instance CRs (namespace-scoped, optionally filtered by rgd label)
//
// Events whose involvedObject.uid appears in that set are included.
// This is O(events + instances) and makes no per-event round trips.
func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := r.URL.Query().Get("namespace")
	rgdFilter := r.URL.Query().Get("rgd")

	// Build the set of kro-relevant UIDs.
	relevant, err := h.buildRelevantUIDs(r, namespace, rgdFilter)
	if err != nil {
		log.Error().Err(err).Msg("failed to build relevant UID set")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// List all events in the target namespace (empty = all namespaces).
	var eventList *unstructured.UnstructuredList
	if namespace != "" {
		eventList, err = h.factory.Dynamic().Resource(eventsGVR).Namespace(namespace).List(
			r.Context(), metav1.ListOptions{},
		)
	} else {
		eventList, err = h.factory.Dynamic().Resource(eventsGVR).List(
			r.Context(), metav1.ListOptions{},
		)
	}
	if err != nil {
		log.Error().Err(err).Str("namespace", namespace).Msg("failed to list events")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Filter to kro-relevant events.
	filtered := filterByUID(eventList.Items, relevant)
	log.Debug().
		Int("total", len(eventList.Items)).
		Int("filtered", len(filtered)).
		Str("namespace", namespace).
		Str("rgd", rgdFilter).
		Msg("listed kro events")

	// Return as a standard unstructured list.
	out := &unstructured.UnstructuredList{}
	out.SetAPIVersion("v1")
	out.SetKind("EventList")
	out.Items = filtered
	respond(w, http.StatusOK, out)
}

// buildRelevantUIDs constructs a set of UIDs for all kro-relevant resources.
// It fetches RGDs (cluster-scoped) and all kro instance CRs in the namespace.
//
// Child resource UID discovery (via ServerGroupsAndResources + per-type List) is
// intentionally omitted: it requires O(n) serial API calls across all namespaced
// resource types, causing 75+ second response times on large clusters (e.g. EKS
// with 200+ controllers). RGD + instance CR UIDs capture the most operationally
// relevant events. See: https://github.com/pnz1990/kro-ui/issues/57
//
// The per-RGD instance-list fan-out is parallelized (issue #153): each RGD gets
// its own goroutine with a 5s deadline. Constitution §XI: no sequential API calls
// in a loop when concurrent fan-out is possible.
func (h *Handler) buildRelevantUIDs(r *http.Request, namespace, rgdFilter string) (map[string]bool, error) {
	relevant := make(map[string]bool)

	// 1. Include all RGD UIDs (cluster-scoped).
	rgdList, err := h.factory.Dynamic().Resource(rgdGVR).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	for i := range rgdList.Items {
		uid := string(rgdList.Items[i].GetUID())
		if uid != "" {
			relevant[uid] = true
		}
	}

	// 2. Collect the set of RGD names to query instances for.
	//    If rgdFilter is set, only fetch instances of that RGD.
	//    Otherwise, fetch instances for all RGDs.
	rgdsToQuery := make([]*unstructured.Unstructured, 0, len(rgdList.Items))
	for i := range rgdList.Items {
		name := rgdList.Items[i].GetName()
		if rgdFilter != "" && name != rgdFilter {
			continue
		}
		rgdsToQuery = append(rgdsToQuery, &rgdList.Items[i])
	}

	// 3. Fan out — one goroutine per RGD, each with a 5s deadline (perRGDTimeout).
	//    Constitution §XI: no sequential API calls in a loop.
	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)
	wg.Add(len(rgdsToQuery))

	for _, rgd := range rgdsToQuery {
		rgd := rgd // capture loop variable
		go func() {
			defer wg.Done()

			rctx, cancel := context.WithTimeout(r.Context(), perRGDTimeout)
			defer cancel()

			gvr, err := h.resolveInstanceGVR(rctx, rgd.GetName())
			if err != nil {
				// Skip RGDs whose instance GVR cannot be resolved — not a fatal error.
				zerolog.Ctx(r.Context()).Debug().
					Err(err).
					Str("rgd", rgd.GetName()).
					Msg("skipping RGD: cannot resolve instance GVR")
				return
			}

			var instanceList *unstructured.UnstructuredList
			if namespace != "" {
				instanceList, err = h.factory.Dynamic().Resource(gvr).Namespace(namespace).List(
					rctx, metav1.ListOptions{},
				)
			} else {
				instanceList, err = h.factory.Dynamic().Resource(gvr).List(
					rctx, metav1.ListOptions{},
				)
			}
			if err != nil {
				zerolog.Ctx(r.Context()).Debug().
					Err(err).
					Str("rgd", rgd.GetName()).
					Msg("skipping RGD instances: list failed")
				return
			}

			mu.Lock()
			for i := range instanceList.Items {
				uid := string(instanceList.Items[i].GetUID())
				if uid != "" {
					relevant[uid] = true
				}
			}
			mu.Unlock()
		}()
	}

	wg.Wait()
	return relevant, nil
}

// filterByUID returns only the events whose involvedObject.uid is in the relevant set.
func filterByUID(events []unstructured.Unstructured, relevant map[string]bool) []unstructured.Unstructured {
	out := make([]unstructured.Unstructured, 0, len(events))
	for i := range events {
		uid, _, _ := unstructured.NestedString(events[i].Object, "involvedObject", "uid")
		if relevant[uid] {
			out = append(out, events[i])
		}
	}
	return out
}
