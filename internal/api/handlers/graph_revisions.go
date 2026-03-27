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
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// listTimeout is the per-handler deadline for GraphRevision list/get operations.
// Constitution §XI: every handler must respond within 5 seconds.
const listTimeout = 5 * time.Second

// ListGraphRevisions handles GET /api/v1/kro/graph-revisions?rgd=<name>.
//
// Returns all GraphRevision objects whose spec.snapshot.name matches the rgd query
// parameter, sorted descending by spec.revision (most recent first).
//
// On clusters that do not have the internal.kro.run/v1alpha1 API group (pre-v0.9.0),
// the dynamic client returns a "no matches for kind" error — this is silently
// converted to an empty list ({"items":[]}) so the response is always 200 OK.
func (h *Handler) ListGraphRevisions(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	rgdName := r.URL.Query().Get("rgd")
	if rgdName == "" {
		respondError(w, http.StatusBadRequest, "rgd parameter is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), listTimeout)
	defer cancel()

	fieldSelector := "spec.snapshot.name=" + rgdName
	list, err := h.factory.Dynamic().Resource(k8sclient.GraphRevisionGVR).
		List(ctx, metav1.ListOptions{FieldSelector: fieldSelector})
	if err != nil {
		if isCRDNotFound(err) {
			// Pre-v0.9.0 cluster: GraphRevision CRD absent — return empty list.
			log.Debug().Str("rgd", rgdName).Msg("GraphRevision CRD not found; returning empty list")
			respond(w, http.StatusOK, map[string]any{"items": []any{}})
			return
		}
		log.Error().Err(err).Str("rgd", rgdName).Msg("failed to list graph revisions")
		respondError(w, http.StatusInternalServerError, "failed to list graph revisions: "+err.Error())
		return
	}

	// Sort items by spec.revision descending (highest/most recent first).
	sort.Slice(list.Items, func(i, j int) bool {
		ri := revisionNum(list.Items[i].Object)
		rj := revisionNum(list.Items[j].Object)
		return ri > rj
	})

	log.Debug().Str("rgd", rgdName).Int("count", len(list.Items)).Msg("listed graph revisions")
	respond(w, http.StatusOK, list)
}

// GetGraphRevision handles GET /api/v1/kro/graph-revisions/{name}.
//
// Returns a single GraphRevision by its Kubernetes resource name.
// Returns 404 when the object does not exist or the CRD is absent (pre-v0.9.0).
func (h *Handler) GetGraphRevision(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	name := chi.URLParam(r, "name")

	ctx, cancel := context.WithTimeout(r.Context(), listTimeout)
	defer cancel()

	obj, err := h.factory.Dynamic().Resource(k8sclient.GraphRevisionGVR).
		Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if isCRDNotFound(err) || isNotFound(err) {
			respondError(w, http.StatusNotFound, "graph revision not found: "+name)
			return
		}
		log.Error().Err(err).Str("name", name).Msg("failed to get graph revision")
		respondError(w, http.StatusInternalServerError, "failed to get graph revision: "+err.Error())
		return
	}

	log.Debug().Str("name", name).Msg("fetched graph revision")
	respond(w, http.StatusOK, obj)
}

// revisionNum extracts spec.revision as an int64 from a GraphRevision object.
// Returns 0 if the field is absent or not a numeric value.
func revisionNum(obj map[string]any) int64 {
	spec, ok := obj["spec"].(map[string]any)
	if !ok {
		return 0
	}
	switch v := spec["revision"].(type) {
	case int64:
		return v
	case float64:
		return int64(v)
	case int:
		return int64(v)
	}
	return 0
}

// isCRDNotFound returns true when the error indicates the API group or resource
// type does not exist in the cluster (pre-v0.9.0 cluster without the CRD).
func isCRDNotFound(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "no matches for kind") ||
		strings.Contains(msg, "no kind") ||
		strings.Contains(msg, "the server could not find the requested resource") ||
		strings.Contains(msg, "not found in group")
}

// isNotFound returns true when the API server returned a 404 for the specific object.
func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "not found")
}
