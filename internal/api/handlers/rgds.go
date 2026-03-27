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
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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
	log := zerolog.Ctx(r.Context())

	list, err := h.factory.Dynamic().Resource(rgdGVR).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		log.Error().Err(err).Msg("failed to list RGDs")
		respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
		return
	}
	log.Debug().Int("count", len(list.Items)).Msg("listed RGDs")
	respond(w, http.StatusOK, list)
}

// GetRGD returns a single RGD by name.
func (h *Handler) GetRGD(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	name := chi.URLParam(r, "name")

	obj, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("rgd", name).Msg("failed to get RGD")
		respondError(w, http.StatusNotFound, "resourcegraphdefinition \""+name+"\" not found")
		return
	}
	log.Debug().Str("rgd", name).Msg("fetched RGD")
	respond(w, http.StatusOK, obj)
}

// ListInstances lists all live CR instances of an RGD.
// Resolves the generated CRD kind + group via the RGD spec, then queries dynamically.
// Optional ?namespace= query param to filter; omit for cluster-wide.
func (h *Handler) ListInstances(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	name := chi.URLParam(r, "name")
	namespace := r.URL.Query().Get("namespace")

	// Fetch the RGD to resolve the generated CRD's kind and group.
	rgd, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("rgd", name).Msg("failed to get RGD for instance listing")
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	// Extract kind and group from spec.schema — flexible, works with any kro version.
	kind, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "kind")
	group, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "group")
	version, _, _ := k8sclient.UnstructuredString(rgd.Object, "spec", "schema", "apiVersion")
	if kind == "" {
		log.Error().Str("rgd", name).Msg("RGD has no schema kind defined")
		respondError(w, http.StatusUnprocessableEntity, "RGD has no schema kind defined")
		return
	}
	if group == "" {
		group = k8sclient.KroGroup
	}
	if version == "" {
		version = "v1alpha1"
	}

	// Discover the plural resource name for this kind.
	plural, err := k8sclient.DiscoverPlural(h.factory, group, version, kind)
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
		// Graceful degradation: when the CRD does not exist (RGD Inactive — KindReady=False),
		// the Kubernetes API returns a "no kind ... is registered for version" or a 404 error.
		// Return an empty list instead of 500 so the UI shows "no instances" not a broken chip.
		// Constitution §XII: graceful degradation — absent data renders as safe empty state.
		if k8serrors.IsNotFound(err) || k8serrors.IsMethodNotSupported(err) {
			log.Debug().Str("rgd", name).Str("kind", kind).Msg("CRD not registered — returning empty instance list")
			respond(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
			return
		}
		// For other errors (auth failure, network, etc.) still return 500.
		log.Error().Err(err).Str("rgd", name).Str("kind", kind).Msg("failed to list instances")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Debug().Str("rgd", name).Str("kind", kind).Msg("listed instances")
	respond(w, http.StatusOK, list)
}
