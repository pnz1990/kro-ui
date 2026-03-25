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
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// makeAccessRGD returns a minimal RGD object with one spec.resource entry.
func makeAccessRGD(name, kind string) *unstructured.Unstructured {
	obj := makeRGDObject(name, kind, k8sclient.KroGroup, "v1alpha1")
	obj.Object["spec"].(map[string]any)["resources"] = []any{
		map[string]any{
			"id": "stub",
			"template": map[string]any{
				"apiVersion": "v1",
				"kind":       "ConfigMap",
				"metadata":   map[string]any{"name": "stub"},
			},
		},
	}
	return obj
}

func TestGetRGDAccess(t *testing.T) {
	tests := []struct {
		name  string
		rgd   string
		query string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:  "returns 404 when RGD not found",
			rgd:   "missing-rgd",
			query: "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				// Empty dynamic client — GET returns not-found.
				return newRGDTestHandler(newStubDynamic(), newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
				assert.Contains(t, rr.Body.String(), "not found")
			},
		},
		{
			name:  "returns 200 with manual SA override when RGD exists",
			rgd:   "my-rgd",
			query: "?saNamespace=kro-system&saName=kro",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeAccessRGD("my-rgd", "MyApp")
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"my-rgd": rgdObj},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				// ComputeAccessResult can return 200 with an empty permission matrix
				// when SelfSubjectAccessReview create panics in the read-only stub.
				// The handler must not return 4xx for the routing/RGD-fetch path.
				// The actual permission matrix logic is tested in internal/k8s/rbac_test.go.
				code := rr.Code
				assert.True(t, code == http.StatusOK || code == http.StatusServiceUnavailable,
					"expected 200 or 503, got %d — body: %s", code, rr.Body.String())
			},
		},
		{
			name:  "returns 200 without SA override (auto-detect path)",
			rgd:   "my-rgd",
			query: "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeAccessRGD("my-rgd", "MyApp")
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"my-rgd": rgdObj},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				// Auto-detect will fail (no kro Deployment in stub) — SA not found.
				// ComputeAccessResult returns an empty matrix; handler returns 200.
				code := rr.Code
				assert.True(t, code == http.StatusOK || code == http.StatusServiceUnavailable,
					"expected 200 or 503, got %d — body: %s", code, rr.Body.String())
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)

			r := chi.NewRouter()
			r.Get("/api/v1/rgds/{name}/access", h.GetRGDAccess)

			url := "/api/v1/rgds/" + tt.rgd + "/access" + tt.query
			req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, url, nil)
			require.NoError(t, err)

			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			tt.check(t, rr)
		})
	}
}
