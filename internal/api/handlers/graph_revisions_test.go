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
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// makeGraphRevision builds a minimal GraphRevision unstructured object for tests.
func makeGraphRevision(name, rgdName string, revision int64) unstructured.Unstructured {
	return unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "internal.kro.run/v1alpha1",
			"kind":       "GraphRevision",
			"metadata":   map[string]any{"name": name},
			"spec": map[string]any{
				"revision": revision,
				"snapshot": map[string]any{
					"name":       rgdName,
					"generation": int64(1),
				},
			},
			"status": map[string]any{},
		},
	}
}

// newGRTestHandler creates a Handler wired to the given stubs.
func newGRTestHandler(dyn *stubDynamic) *Handler {
	return &Handler{
		factory: &stubK8sClients{dyn: dyn, disc: newStubDiscovery()},
	}
}

// ── TestListGraphRevisions ────────────────────────────────────────────────────

func TestListGraphRevisions(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *Handler
		url   string
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "returns 400 when rgd param is missing",
			build: func(t *testing.T) *Handler {
				t.Helper()
				return newGRTestHandler(newStubDynamic())
			},
			url: "/api/v1/kro/graph-revisions",
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusBadRequest, rr.Code)
				assert.Contains(t, rr.Body.String(), "rgd parameter is required")
			},
		},
		{
			name: "returns empty list when GraphRevision CRD absent (pre-v0.9.0 cluster)",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				// Stub returns "no matches for kind" — simulates absent CRD.
				dyn.resources[k8sclient.GraphRevisionGVR] = &stubNamespaceableResource{
					listErr: fmt.Errorf("no matches for kind \"GraphRevision\" in group \"internal.kro.run\""),
				}
				return newGRTestHandler(dyn)
			},
			url: "/api/v1/kro/graph-revisions?rgd=my-app",
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.NotContains(t, body, `"error"`)
			},
		},
		{
			name: "returns items sorted descending by spec.revision",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[k8sclient.GraphRevisionGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{
						makeGraphRevision("my-app-1", "my-app", 1),
						makeGraphRevision("my-app-3", "my-app", 3),
						makeGraphRevision("my-app-2", "my-app", 2),
					},
				}
				return newGRTestHandler(dyn)
			},
			url: "/api/v1/kro/graph-revisions?rgd=my-app",
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				// Revision 3 must appear before revision 1 in the response.
				idx3 := indexOf(body, "my-app-3")
				idx1 := indexOf(body, "my-app-1")
				assert.Greater(t, idx1, idx3, "revision 3 must come before revision 1 (descending sort)")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			r := chi.NewRouter()
			r.Get("/api/v1/kro/graph-revisions", h.ListGraphRevisions)
			req := httptest.NewRequest(http.MethodGet, tt.url, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// ── TestGetGraphRevision ──────────────────────────────────────────────────────

func TestGetGraphRevision(t *testing.T) {
	tests := []struct {
		name   string
		build  func(t *testing.T) *Handler
		grName string
		check  func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:   "returns 404 when GraphRevision not found",
			grName: "my-app-99",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[k8sclient.GraphRevisionGVR] = &stubNamespaceableResource{
					getErr: fmt.Errorf("not found: my-app-99"),
				}
				return newGRTestHandler(dyn)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				assert.Contains(t, rr.Body.String(), "graph revision not found")
			},
		},
		{
			name:   "returns 404 when CRD absent",
			grName: "my-app-1",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[k8sclient.GraphRevisionGVR] = &stubNamespaceableResource{
					getErr: fmt.Errorf("no matches for kind \"GraphRevision\" in group \"internal.kro.run\""),
				}
				return newGRTestHandler(dyn)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				assert.Contains(t, rr.Body.String(), "graph revision not found")
			},
		},
		{
			name:   "returns 200 with object when found",
			grName: "my-app-1",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				gr := makeGraphRevision("my-app-1", "my-app", 1)
				dyn.resources[k8sclient.GraphRevisionGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{
						"my-app-1": &gr,
					},
				}
				return newGRTestHandler(dyn)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Body.String(), "my-app-1")
				assert.Contains(t, rr.Body.String(), "GraphRevision")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			r := chi.NewRouter()
			r.Get("/api/v1/kro/graph-revisions/{name}", h.GetGraphRevision)
			url := "/api/v1/kro/graph-revisions/" + tt.grName
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// indexOf returns the first index of substr in s, or -1 if not found.
// Used to verify ordering in sorted responses.
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
