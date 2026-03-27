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
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// GetInstance returns a single CR instance detail.
// The RGD name is passed as a query param so we can resolve the correct GVR.
func (h *Handler) GetInstance(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	rgdName := r.URL.Query().Get("rgd")

	gvr, err := h.resolveInstanceGVR(r.Context(), rgdName)
	if err != nil {
		log.Error().Err(err).Str("rgd", rgdName).Msg("failed to resolve instance GVR")
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	obj, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("namespace", namespace).Str("name", name).Msg("failed to get instance")
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	log.Debug().Str("namespace", namespace).Str("name", name).Msg("fetched instance")
	respond(w, http.StatusOK, obj)
}

// GetInstanceEvents returns Kubernetes events for a given instance.
func (h *Handler) GetInstanceEvents(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")

	eventsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}
	fieldSelector := "involvedObject.name=" + name + ",involvedObject.namespace=" + namespace
	list, err := h.factory.Dynamic().Resource(eventsGVR).Namespace(namespace).List(
		r.Context(), metav1.ListOptions{FieldSelector: fieldSelector},
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Debug().Int("count", len(list.Items)).Str("namespace", namespace).Str("name", name).Msg("listed instance events")
	respond(w, http.StatusOK, list)
}

// GetInstanceChildren returns child resources owned by the instance.
// Uses the kro.run/instance-name label to find all child resources across all
// namespaces — kro creates managed resources in per-instance namespaces which
// may differ from the instance's own namespace (issue #146).
// When the ?rgd= query param is provided the search is scoped to only the
// resource types declared in the RGD spec, avoiding full-cluster discovery
// fan-out that causes throttling on large clusters (EKS/GKE).
func (h *Handler) GetInstanceChildren(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	rgdName := r.URL.Query().Get("rgd")

	children, err := h.listChildResources(r.Context(), name, rgdName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Coerce nil to empty slice so the response is always {"items":[]} not {"items":null}.
	if children == nil {
		children = []map[string]any{}
	}
	log.Debug().Int("count", len(children)).Str("namespace", namespace).Str("name", name).Str("rgd", rgdName).Msg("listed instance children")
	respond(w, http.StatusOK, types.ChildrenResponse{Items: children})
}

// GetResource returns the raw unstructured YAML/JSON for any resource.
// This is used by the frontend for node YAML inspection — works for any k8s kind.
// Two sentinels are used for path segments that chi cannot route as empty strings:
//   - group "_"     → core API group (empty string)
//   - namespace "_" → cluster-scoped resource (no namespace)
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	namespace := chi.URLParam(r, "namespace")
	group := chi.URLParam(r, "group")
	version := chi.URLParam(r, "version")
	kind := chi.URLParam(r, "kind")
	name := chi.URLParam(r, "name")

	// Treat "_" as the core (empty) API group — chi cannot route empty segments.
	if group == "_" {
		group = ""
	}
	// Treat "_" namespace as cluster-scoped (no namespace).
	// Cluster-scoped resources (Namespace, ClusterRole, PV, etc.) have no
	// metadata.namespace; the frontend sends "_" to avoid a double-slash URL.
	if namespace == "_" {
		namespace = ""
	}

	plural, err := k8sclient.DiscoverPlural(h.factory, group, version, kind)
	if err != nil {
		plural = strings.ToLower(kind) + "s"
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: plural}

	var obj *unstructured.Unstructured
	if namespace == "" {
		// Cluster-scoped GET — do not include a namespace in the API path.
		obj, err = h.factory.Dynamic().Resource(gvr).Get(r.Context(), name, metav1.GetOptions{})
	} else {
		obj, err = h.factory.Dynamic().Resource(gvr).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
	}
	if err != nil {
		log.Error().Err(err).Str("gvr", gvr.String()).Str("name", name).Msg("resource not found")
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	log.Debug().Str("gvr", gvr.String()).Str("name", name).Msg("fetched resource")
	respond(w, http.StatusOK, obj)
}
