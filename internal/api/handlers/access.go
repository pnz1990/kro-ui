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
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// GetRGDAccess computes the permission matrix for kro's service account
// vs all resources managed by the named RGD.
//
// GET /api/v1/rgds/{name}/access[?saNamespace=<ns>&saName=<name>]
//
// Optional query parameters allow the caller to override the auto-detected
// service account. When both saNamespace and saName are non-empty, auto-detection
// is skipped and the provided values are used directly.
func (h *Handler) GetRGDAccess(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())
	name := chi.URLParam(r, "name")

	// Fetch the RGD.
	rgdGVR := schema.GroupVersionResource{
		Group:    k8sclient.KroGroup,
		Version:  "v1alpha1",
		Resource: k8sclient.RGDResource,
	}
	rgd, err := h.factory.Dynamic().Resource(rgdGVR).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		log.Error().Err(err).Str("rgd", name).Msg("failed to get RGD for access check")
		respondError(w, http.StatusNotFound, "resourcegraphdefinition \""+name+"\" not found")
		return
	}

	// Resolve kro's service account — either from caller-supplied query params
	// (manual override) or by auto-detecting from the cluster.
	saNamespace := strings.TrimSpace(r.URL.Query().Get("saNamespace"))
	saName := strings.TrimSpace(r.URL.Query().Get("saName"))

	var saNS, saNameVal string
	var saFound bool

	if saNamespace != "" && saName != "" {
		// Manual override: trust what the caller provided.
		saNS, saNameVal, saFound = saNamespace, saName, true
		log.Debug().
			Str("saNamespace", saNamespace).
			Str("saName", saName).
			Msg("using manual SA override for access check")
	} else {
		// Auto-detect: inspect the cluster's kro Deployment.
		saNS, saNameVal, saFound = k8sclient.ResolveKroServiceAccount(r.Context(), h.factory)
	}

	// Compute the full permission matrix.
	result, err := k8sclient.ComputeAccessResult(r.Context(), h.factory, rgd.Object, saNS, saNameVal, saFound)
	if err != nil {
		log.Error().Err(err).Str("rgd", name).Msg("failed to compute access result")
		respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+err.Error())
		return
	}

	// Map internal result to response type.
	perms := make([]types.GVRPermission, 0, len(result.Permissions))
	for _, p := range result.Permissions {
		perms = append(perms, types.GVRPermission{
			Group:    p.Group,
			Version:  p.Version,
			Resource: p.Resource,
			Kind:     p.Kind,
			Required: p.Required,
			Granted:  p.Granted,
		})
	}

	log.Debug().
		Str("rgd", name).
		Str("sa", result.ServiceAccount).
		Bool("hasGaps", result.HasGaps).
		Int("resources", len(perms)).
		Msg("computed access result")

	respond(w, http.StatusOK, types.AccessResponse{
		ServiceAccount:      result.ServiceAccount,
		ServiceAccountFound: result.ServiceAccountFound,
		ClusterRole:         result.ClusterRole,
		HasGaps:             result.HasGaps,
		Permissions:         perms,
	})
}
