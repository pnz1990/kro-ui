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
	"net/http"

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var eventsGVR = schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}

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

	// 3. For each RGD, list its instances and add their UIDs.
	for _, rgd := range rgdsToQuery {
		gvr, err := h.resolveInstanceGVR(r.Context(), rgd.GetName())
		if err != nil {
			// Skip RGDs whose instance GVR cannot be resolved — not a fatal error.
			zerolog.Ctx(r.Context()).Debug().
				Err(err).
				Str("rgd", rgd.GetName()).
				Msg("skipping RGD: cannot resolve instance GVR")
			continue
		}

		var instanceList *unstructured.UnstructuredList
		if namespace != "" {
			instanceList, err = h.factory.Dynamic().Resource(gvr).Namespace(namespace).List(
				r.Context(), metav1.ListOptions{},
			)
		} else {
			instanceList, err = h.factory.Dynamic().Resource(gvr).List(
				r.Context(), metav1.ListOptions{},
			)
		}
		if err != nil {
			zerolog.Ctx(r.Context()).Debug().
				Err(err).
				Str("rgd", rgd.GetName()).
				Msg("skipping RGD instances: list failed")
			continue
		}

		for i := range instanceList.Items {
			uid := string(instanceList.Items[i].GetUID())
			if uid != "" {
				relevant[uid] = true
			}
			// Also include by instance name: label kro.run/instance-name covers
			// child resources whose events reference the child's UID, not the instance.
			// We additionally accept events where involvedObject.name has the
			// kro.run/instance-name label value. This is handled client-side in the
			// frontend by the instance attribution logic. Here we only do UID-based
			// filtering for direct matches.
		}
	}

	// 4. Include child resource UIDs via the kro.run/instance-name label.
	//    List all child resources in the namespace using label selector.
	if err := h.addChildUIDs(r, namespace, relevant); err != nil {
		// Non-fatal: log and continue.
		zerolog.Ctx(r.Context()).Debug().Err(err).Msg("could not add child UIDs; filtering may be incomplete")
	}

	return relevant, nil
}

// addChildUIDs adds the UIDs of all kro-managed child resources (labelled with
// kro.run/instance-name) to the relevant set. This ensures events on child
// resources appear in the stream, not just events directly on kro instances.
func (h *Handler) addChildUIDs(r *http.Request, namespace string, relevant map[string]bool) error {
	// "kro.run/instance-name" is the label kro applies to all child resources.
	// We use "!=" to match any resource that has this label set to any value.
	labelSelector := "kro.run/instance-name!="
	children, err := h.listChildResourcesByLabel(r, namespace, labelSelector)
	if err != nil {
		return err
	}
	for _, child := range children {
		uid := string(child.GetUID())
		if uid != "" {
			relevant[uid] = true
		}
	}
	return nil
}

// listChildResourcesByLabel lists resources across discoverable namespaced kinds
// that carry the given label selector. This is a best-effort discovery: it
// queries all API groups and skips resources that fail to list.
func (h *Handler) listChildResourcesByLabel(r *http.Request, namespace, labelSelector string) ([]unstructured.Unstructured, error) {
	var results []unstructured.Unstructured

	_, resourceLists, err := h.factory.Discovery().ServerGroupsAndResources()
	if err != nil {
		return nil, err
	}

	for _, rl := range resourceLists {
		gv, err := schema.ParseGroupVersion(rl.GroupVersion)
		if err != nil {
			continue
		}
		for _, res := range rl.APIResources {
			// Only list namespaced resources — cluster-scoped ones are handled via RGD UIDs.
			if !res.Namespaced {
				continue
			}
			// Skip sub-resources (contain "/").
			hasSlash := false
			for _, c := range res.Name {
				if c == '/' {
					hasSlash = true
					break
				}
			}
			if hasSlash {
				continue
			}
			// Skip well-known noisy resources to keep discovery fast.
			if isSkippedResource(res.Name) {
				continue
			}

			gvr := schema.GroupVersionResource{Group: gv.Group, Version: gv.Version, Resource: res.Name}
			var list *unstructured.UnstructuredList
			if namespace != "" {
				list, err = h.factory.Dynamic().Resource(gvr).Namespace(namespace).List(
					r.Context(), metav1.ListOptions{LabelSelector: labelSelector},
				)
			} else {
				list, err = h.factory.Dynamic().Resource(gvr).List(
					r.Context(), metav1.ListOptions{LabelSelector: labelSelector},
				)
			}
			if err != nil {
				// Many resources won't support listing with this label; skip silently.
				continue
			}
			results = append(results, list.Items...)
		}
	}
	return results, nil
}

// isSkippedResource returns true for resource kinds that are too noisy or
// system-level to usefully scan for kro child label presence.
func isSkippedResource(name string) bool {
	switch name {
	case "events", "pods", "nodes", "endpoints", "endpointslices",
		"leases", "bindings", "componentstatuses":
		return true
	}
	return false
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
