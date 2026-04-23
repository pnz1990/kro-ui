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
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8syaml "k8s.io/apimachinery/pkg/util/yaml"

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
// Returns 404 when the RGD does not exist, 503 for all other k8s errors (network
// partition, RBAC denial, API server restart) so the frontend can distinguish
// "not found — may have been deleted" from "temporarily unreachable — retry".
func (h *Handler) GetRGD(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	name := chi.URLParam(r, "name")

	obj, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			// RGD genuinely does not exist — tell the frontend it can show "not found".
			log.Debug().Str("rgd", name).Msg("RGD not found")
			respondError(w, http.StatusNotFound, "resourcegraphdefinition \""+name+"\" not found")
			return
		}
		// Any other error (RBAC, network, timeout) — return 503 so the frontend
		// shows a transient error instead of "RGD deleted".
		log.Error().Err(err).Str("rgd", name).Msg("failed to get RGD")
		respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
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
		if k8serrors.IsNotFound(err) {
			respondError(w, http.StatusNotFound, err.Error())
		} else {
			respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
		}
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
		// Partial-RBAC: when the operator only has access to a subset of namespaces,
		// listing across all namespaces returns Forbidden. Return 200 + empty list
		// with a warning field so the UI can show an indicator.
		// Spec: .specify/specs/issue-574/spec.md  O2
		if isForbiddenError(err) {
			log.Warn().Err(err).Str("rgd", name).Str("kind", kind).Msg("ListInstances: forbidden — returning empty list with RBAC warning")
			respond(w, http.StatusOK, map[string]interface{}{
				"items":   []interface{}{},
				"warning": "insufficient permissions",
			})
			return
		}
		// For other errors (network, etc.) still return 500.
		log.Error().Err(err).Str("rgd", name).Str("kind", kind).Msg("failed to list instances")
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	log.Debug().Str("rgd", name).Str("kind", kind).Msg("listed instances")
	respond(w, http.StatusOK, list)
}

// applyRGDFieldManager is the SSA field manager used when applying RGDs via the Designer.
// Using a distinct field manager ensures kro-ui's applied fields can be tracked separately
// from fields managed by kubectl or other tooling.
const applyRGDFieldManager = "kro-ui"

// ApplyRGDResponse is the response payload for POST /api/v1/rgds/apply.
type ApplyRGDResponse struct {
	// Name is the metadata.name of the RGD that was created or updated.
	Name string `json:"name"`
	// Created is true when a new RGD was created; false when an existing one was updated.
	Created bool `json:"created"`
	// Message is a human-readable summary (e.g. "Created RGD my-rgd" or "Updated RGD my-rgd").
	Message string `json:"message"`
}

// ApplyRGD applies a ResourceGraphDefinition YAML to the cluster via server-side apply.
//
// This is the only mutating endpoint in kro-ui. It is gated behind the canApplyRGDs
// capability flag (spec issue-713 O3), which defaults to false.
//
// POST /api/v1/rgds/apply
// Content-Type: text/plain  (raw YAML body)
//
// Response:
//   - 201: RGD created — ApplyRGDResponse{created:true}
//   - 200: RGD updated — ApplyRGDResponse{created:false}
//   - 400: invalid YAML, wrong kind, or empty body
//   - 403: canApplyRGDs capability is false
//   - 503: cluster unreachable
//
// Spec: .specify/specs/issue-713/spec.md O1–O7
func (h *Handler) ApplyRGD(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	// O3: capability gate — canApplyRGDs must be true to use this endpoint.
	// capCache is the module-level cache populated by GetCapabilities.
	if cached := capCache.get(); cached != nil {
		if !cached.FeatureGates["canApplyRGDs"] {
			respondError(w, http.StatusForbidden,
				"canApplyRGDs is disabled; enable it in kro-ui capabilities to use the apply-to-cluster feature")
			return
		}
	} else {
		// Capabilities not yet fetched — fail-safe: deny the apply.
		respondError(w, http.StatusForbidden,
			"kro capabilities not yet detected; retry after the capabilities endpoint has been called")
		return
	}

	// O7: parse request body as YAML.
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body: "+err.Error())
		return
	}
	if len(body) == 0 {
		respondError(w, http.StatusBadRequest, "empty body")
		return
	}

	// Decode YAML → unstructured object.
	obj := &unstructured.Unstructured{}
	decoder := k8syaml.NewYAMLOrJSONDecoder(strings.NewReader(string(body)), 4096)
	if err := decoder.Decode(&obj.Object); err != nil {
		respondError(w, http.StatusBadRequest, "invalid YAML: "+err.Error())
		return
	}

	// O7: validate kind and apiVersion.
	gvk := obj.GroupVersionKind()
	if gvk.Group != k8sclient.KroGroup || gvk.Kind != "ResourceGraphDefinition" {
		respondError(w, http.StatusBadRequest,
			"body must be a ResourceGraphDefinition (kro.run/v1alpha1), got: "+gvk.String())
		return
	}

	rgdName := obj.GetName()
	if rgdName == "" {
		respondError(w, http.StatusBadRequest, "metadata.name is required")
		return
	}

	// Check whether the RGD already exists so we can return the correct status code.
	_, getErr := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), rgdName, metav1.GetOptions{})
	wasCreated := k8serrors.IsNotFound(getErr)

	// O1: Apply via server-side apply with field manager kro-ui, force=false.
	applied, err := h.factory.Dynamic().Resource(rgdGVR).Apply(
		r.Context(),
		rgdName,
		obj,
		metav1.ApplyOptions{
			FieldManager: applyRGDFieldManager,
			Force:        false,
		},
	)
	if err != nil {
		if k8serrors.IsForbidden(err) || k8serrors.IsUnauthorized(err) {
			log.Warn().Err(err).Str("rgd", rgdName).Msg("ApplyRGD: RBAC denied")
			respondError(w, http.StatusForbidden, "cluster RBAC denied apply: "+err.Error())
			return
		}
		log.Error().Err(err).Str("rgd", rgdName).Msg("failed to apply RGD")
		respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
		return
	}

	appliedName := applied.GetName()
	if appliedName == "" {
		appliedName = rgdName
	}

	var action string
	var status int
	if wasCreated {
		action = "Created"
		status = http.StatusCreated
	} else {
		action = "Updated"
		status = http.StatusOK
	}

	log.Info().Str("rgd", appliedName).Bool("created", wasCreated).Msg("ApplyRGD: success")
	respond(w, status, ApplyRGDResponse{
		Name:    appliedName,
		Created: wasCreated,
		Message: action + " RGD " + appliedName,
	})
}
