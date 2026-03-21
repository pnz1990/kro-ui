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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

var rgdGVR = schema.GroupVersionResource{
	Group:    k8sclient.KroGroup,
	Version:  "v1alpha1",
	Resource: k8sclient.RGDResource,
}

// ListRGDs returns all ResourceGraphDefinitions in the cluster.
func (h *Handler) ListRGDs(w http.ResponseWriter, r *http.Request) {
	list, err := h.factory.Dynamic().Resource(rgdGVR).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
		return
	}
	respond(w, http.StatusOK, list)
}

// GetRGD returns a single RGD by name.
func (h *Handler) GetRGD(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	obj, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		respondError(w, http.StatusNotFound, "resourcegraphdefinition \""+name+"\" not found")
		return
	}
	respond(w, http.StatusOK, obj)
}

// ListInstances lists all live CR instances of an RGD.
// Resolves the generated CRD kind + group via the RGD spec, then queries dynamically.
// Optional ?namespace= query param to filter; omit for cluster-wide.
func (h *Handler) ListInstances(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	namespace := r.URL.Query().Get("namespace")

	// Fetch the RGD to resolve the generated CRD's kind and group.
	rgd, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	// Extract kind and group from spec.schema — flexible, works with any kro version.
	kind, _, _ := unstructuredString(rgd.Object, "spec", "schema", "kind")
	group, _, _ := unstructuredString(rgd.Object, "spec", "schema", "group")
	version, _, _ := unstructuredString(rgd.Object, "spec", "schema", "apiVersion")
	if kind == "" {
		respondError(w, http.StatusUnprocessableEntity, "RGD has no spec.schema.kind")
		return
	}
	if group == "" {
		group = k8sclient.KroGroup
	}
	if version == "" {
		version = "v1alpha1"
	}

	// Discover the plural resource name for this kind.
	plural, err := discoverPlural(h.factory, group, version, kind)
	if err != nil {
		// Fall back to naive lowercase+s pluralisation — good enough for most cases.
		plural = strings.ToLower(kind) + "s"
	}

	gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: plural}

	var list interface{}
	if namespace != "" {
		list, err = h.factory.Dynamic().Resource(gvr).Namespace(namespace).List(r.Context(), metav1.ListOptions{})
	} else {
		list, err = h.factory.Dynamic().Resource(gvr).List(r.Context(), metav1.ListOptions{})
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, list)
}
