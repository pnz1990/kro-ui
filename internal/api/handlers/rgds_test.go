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
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestListRGDs(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "returns 200 with items array when RGDs exist",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{
						*makeRGDObject("web-app", "WebApp", "", ""),
						*makeRGDObject("database", "Database", "", ""),
					},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"web-app"`)
				assert.Contains(t, body, `"database"`)
			},
		},
		{
			name: "returns 200 with empty items when no RGDs",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				// Must not be an error — empty list is a valid response.
				assert.NotContains(t, body, `"error"`)
			},
		},
		{
			name: "returns 503 when cluster unreachable",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					listErr: fmt.Errorf("connection refused"),
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusServiceUnavailable, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "cluster unreachable")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/rgds", nil)
			rr := httptest.NewRecorder()
			h.ListRGDs(rr, req)
			tt.check(t, rr)
		})
	}
}

func TestGetRGD(t *testing.T) {
	tests := []struct {
		name    string
		rgdName string
		build   func(t *testing.T) *Handler
		check   func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:    "returns 200 for existing RGD",
			rgdName: "web-service-graph",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("web-service-graph", "WebService", "", "")
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{
						"web-service-graph": rgdObj,
					},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"web-service-graph"`)
				assert.Contains(t, body, `"WebService"`)
			},
		},
		{
			name:    "returns 404 for unknown RGD",
			rgdName: "does-not-exist",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "does-not-exist")
				assert.Contains(t, body, "not found")
			},
		},
		{
			name:    "returns 503 on non-NotFound cluster error",
			rgdName: "web-service-graph",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getErr: fmt.Errorf("connection refused"),
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusServiceUnavailable, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "cluster unreachable")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)

			// Use chi router to inject URL params.
			r := chi.NewRouter()
			r.Get("/api/v1/rgds/{name}", h.GetRGD)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/rgds/"+tt.rgdName, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

func TestListInstances(t *testing.T) {
	// Common GVR for the TestApp kind resolved by discovery.
	testAppGVR := schema.GroupVersionResource{
		Group:    k8sclient.KroGroup,
		Version:  "v1alpha1",
		Resource: "testapps",
	}

	tests := []struct {
		name    string
		rgdName string
		query   string
		build   func(t *testing.T) *Handler
		check   func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:    "returns instances across all namespaces",
			rgdName: "test-app",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "test-instance", "namespace": "default"},
				}}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*instance},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"test-instance"`)
			},
		},
		{
			name:    "filters by namespace when provided",
			rgdName: "test-app",
			query:   "?namespace=kro-ui-e2e",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				nsInstance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "ns-instance", "namespace": "kro-ui-e2e"},
				}}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							items: []unstructured.Unstructured{*nsInstance},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"ns-instance"`)
			},
		},
		{
			name:    "returns 422 when spec.schema.kind absent",
			rgdName: "broken-rgd",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				// RGD exists but has no kind in spec.schema.
				rgdObj := makeRGDObject("broken-rgd", "", "", "")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"broken-rgd": rgdObj},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusUnprocessableEntity, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "RGD has no schema kind defined")
			},
		},
		{
			name:    "falls back to naive plural on discovery failure",
			rgdName: "test-app",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				// The naive plural of "TestApp" is "testapps" — same GVR.
				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "fallback-instance", "namespace": "default"},
				}}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*instance},
				}

				// Discovery fails — forces fallback to naive pluralization.
				disc := newStubDiscovery()
				disc.err = fmt.Errorf("discovery unavailable")

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"fallback-instance"`)
			},
		},
		{
			name:    "defaults group to kro.run when absent",
			rgdName: "no-group-rgd",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				// RGD has kind but no group — should default to kro.run.
				rgdObj := makeRGDObject("no-group-rgd", "MyKind", "", "")

				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "MyKind",
					"metadata":   map[string]any{"name": "default-group-instance"},
				}}

				// The expected GVR uses kro.run group (default).
				defaultGVR := schema.GroupVersionResource{
					Group:    k8sclient.KroGroup,
					Version:  "v1alpha1",
					Resource: "mykinds",
				}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"no-group-rgd": rgdObj},
				}
				dyn.resources[defaultGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*instance},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "mykinds", Kind: "MyKind", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"default-group-instance"`)
			},
		},
		{
			name:    "returns 404 when RGD not found",
			rgdName: "nonexistent",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
			},
		},
		{
			name:    "returns 503 when RGD Get returns non-NotFound error",
			rgdName: "failing-rgd",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getErr: fmt.Errorf("connection refused"),
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusServiceUnavailable, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "cluster unreachable")
			},
		},
		{
			name:    "returns empty list when CRD not found (inactive RGD)",
			rgdName: "inactive-rgd",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("inactive-rgd", "InactiveApp", "", "")
				inactiveGVR := schema.GroupVersionResource{
					Group:    k8sclient.KroGroup,
					Version:  "v1alpha1",
					Resource: "inactiveapps",
				}
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"inactive-rgd": rgdObj},
				}
				// Instance list returns NotFound — CRD not registered (RGD is Inactive)
				dyn.resources[inactiveGVR] = &stubNamespaceableResource{
					listErr: k8serrors.NewNotFound(schema.GroupResource{Resource: "inactiveapps"}, ""),
				}
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "inactiveapps", Kind: "InactiveApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.NotContains(t, body, `"error"`)
			},
		},
		{
			name:    "returns 500 on unexpected instance list error",
			rgdName: "test-app",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				// Instance list returns a generic (non-NotFound) error
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					listErr: fmt.Errorf("etcd unavailable"),
				}
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusInternalServerError, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
			},
		},
		{
			name:    "returns empty items when no instances exist",
			rgdName: "test-app",
			query:   "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{},
				}

				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.NotContains(t, body, `"error"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)

			r := chi.NewRouter()
			r.Get("/api/v1/rgds/{name}/instances", h.ListInstances)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/rgds/"+tt.rgdName+"/instances"+tt.query, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// TestListInstances_ForbiddenReturns200WithWarning verifies that when the k8s API
// returns Forbidden (RBAC restricted namespace), ListInstances returns 200 + empty
// items + warning instead of 500 (spec issue-574 O2, O4).
func TestListInstances_ForbiddenReturns200WithWarning(t *testing.T) {
	t.Parallel()

	testAppGVR := schema.GroupVersionResource{
		Group:    k8sclient.KroGroup,
		Version:  "v1alpha1",
		Resource: "testapps",
	}

	rgdObj := makeRGDObject("test-app", "TestApp", "", "")
	disc := newStubDiscovery()
	disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
		GroupVersion: "kro.run/v1alpha1",
		APIResources: []metav1.APIResource{
			{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
		},
	}

	dyn := newStubDynamic()
	dyn.resources[rgdGVR] = &stubNamespaceableResource{
		getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
	}
	// Forbidden error from the instance list call — restricted RBAC
	dyn.resources[testAppGVR] = &stubNamespaceableResource{
		listErr: k8serrors.NewForbidden(
			schema.GroupResource{Group: k8sclient.KroGroup, Resource: "testapps"},
			"", fmt.Errorf("User cannot list testapps"),
		),
	}

	h := newRGDTestHandler(dyn, disc)
	r := chi.NewRouter()
	r.Get("/api/v1/rgds/{name}/instances", h.ListInstances)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/rgds/test-app/instances", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Must be 200, not 500 (O2)
	require.Equal(t, http.StatusOK, rr.Code, "ListInstances must return 200 on Forbidden (O2)")

	var body struct {
		Items   []any  `json:"items"`
		Warning string `json:"warning"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&body))
	assert.Empty(t, body.Items, "items must be empty when Forbidden (O2)")
	assert.Equal(t, "insufficient permissions", body.Warning, "warning must be set (O2)")
}
