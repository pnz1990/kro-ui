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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

func TestGetInstance(t *testing.T) {
	// Common GVR for the TestApp kind resolved by discovery.
	testAppGVR := schema.GroupVersionResource{
		Group:    k8sclient.KroGroup,
		Version:  "v1alpha1",
		Resource: "testapps",
	}

	tests := []struct {
		name  string
		ns    string
		iname string
		query string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:  "returns 400 when rgd param missing",
			ns:    "default",
			iname: "test-instance",
			query: "",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusBadRequest, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "rgd query param required")
			},
		},
		{
			name:  "returns 404 for unknown instance",
			ns:    "default",
			iname: "does-not-exist",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				// TestApp GVR exists but has no instances.
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {
							getItems: map[string]*unstructured.Unstructured{},
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
				require.Equal(t, http.StatusNotFound, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "not found")
			},
		},
		{
			name:  "returns 200 for valid instance",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgdObj := makeRGDObject("test-app", "TestApp", "", "")

				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "TestApp",
					"metadata":   map[string]any{"name": "test-instance", "namespace": "kro-ui-e2e"},
					"spec":       map[string]any{"replicas": int64(3)},
					"status":     map[string]any{"ready": true},
				}}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"test-app": rgdObj},
				}
				dyn.resources[testAppGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							getItems: map[string]*unstructured.Unstructured{
								"test-instance": instance,
							},
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
				assert.Contains(t, body, `"test-instance"`)
				assert.Contains(t, body, `"kro-ui-e2e"`)
				assert.Contains(t, body, `"TestApp"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)

			r := chi.NewRouter()
			r.Get("/api/v1/instances/{namespace}/{name}", h.GetInstance)

			req := httptest.NewRequest(http.MethodGet,
				"/api/v1/instances/"+tt.ns+"/"+tt.iname+tt.query, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

func TestGetInstanceEvents(t *testing.T) {
	eventsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "events"}

	tests := []struct {
		name  string
		ns    string
		iname string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:  "returns 200 with events",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			build: func(t *testing.T) *Handler {
				t.Helper()
				event := unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "v1",
					"kind":       "Event",
					"metadata":   map[string]any{"name": "test-instance.17a2b3c", "namespace": "kro-ui-e2e"},
					"involvedObject": map[string]any{
						"name":      "test-instance",
						"namespace": "kro-ui-e2e",
					},
					"reason":  "Reconciled",
					"message": "Successfully reconciled",
				}}

				dyn := newStubDynamic()
				dyn.resources[eventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							items: []unstructured.Unstructured{event},
						},
					},
				}

				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"Reconciled"`)
				assert.Contains(t, body, `"test-instance"`)
			},
		},
		{
			name:  "returns 200 with empty items when no events",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[eventsGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							items: []unstructured.Unstructured{},
						},
					},
				}

				return newRGDTestHandler(dyn, newStubDiscovery())
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
			r.Get("/api/v1/instances/{namespace}/{name}/events", h.GetInstanceEvents)

			req := httptest.NewRequest(http.MethodGet,
				"/api/v1/instances/"+tt.ns+"/"+tt.iname+"/events", nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

func TestGetInstanceChildren(t *testing.T) {
	tests := []struct {
		name  string
		ns    string
		iname string
		query string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:  "returns 200 with children",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				configMap := unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "v1",
					"kind":       "ConfigMap",
					"metadata": map[string]any{
						"name":      "kro-ui-test-config",
						"namespace": "kro-ui-e2e",
						"labels": map[string]any{
							"kro.run/instance-name": "test-instance",
						},
					},
				}}

				configMapGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}
				dyn := newStubDynamic()
				dyn.resources[configMapGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						// Empty string = cluster-wide (all-namespace) lookup.
						// ListChildResources now searches all namespaces (fix #146).
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								"kro.run/instance-name=test-instance": {configMap},
							},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"get", "list", "watch"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				assert.Contains(t, body, `"kro-ui-test-config"`)
				assert.Contains(t, body, `"ConfigMap"`)
			},
		},
		{
			name:  "skips subresources",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				// Only register a subresource (pods/status) — should be skipped.
				dyn := newStubDynamic()

				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "pods/status", Kind: "Pod", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				// The items array should be empty or null since subresources are skipped.
				assert.NotContains(t, body, `"Pod"`)
			},
		},
		{
			name:  "skips non-listable resources",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()

				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						// Only supports "get" — not listable.
						{Name: "secrets", Kind: "Secret", Verbs: metav1.Verbs{"get"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"items"`)
				// No Secret should appear since it's not listable.
				assert.NotContains(t, body, `"Secret"`)
			},
		},
		{
			name:  "returns empty items when no matches",
			ns:    "kro-ui-e2e",
			iname: "test-instance",
			query: "?rgd=test-app",
			build: func(t *testing.T) *Handler {
				t.Helper()
				configMapGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}
				dyn := newStubDynamic()
				dyn.resources[configMapGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							labelItems: map[string][]unstructured.Unstructured{
								"kro.run/instance-name=test-instance": {},
							},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"get", "list"}},
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
			r.Get("/api/v1/instances/{namespace}/{name}/children", h.GetInstanceChildren)

			req := httptest.NewRequest(http.MethodGet,
				"/api/v1/instances/"+tt.ns+"/"+tt.iname+"/children"+tt.query, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

func TestGetResource(t *testing.T) {
	tests := []struct {
		name    string
		ns      string
		group   string
		version string
		kind    string
		rname   string
		build   func(t *testing.T) *Handler
		check   func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name:    "returns 200 for valid resource",
			ns:      "kro-ui-e2e",
			group:   "apps",
			version: "v1",
			kind:    "Deployment",
			rname:   "my-deploy",
			build: func(t *testing.T) *Handler {
				t.Helper()
				deploy := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "apps/v1",
					"kind":       "Deployment",
					"metadata":   map[string]any{"name": "my-deploy", "namespace": "kro-ui-e2e"},
				}}

				deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
				dyn := newStubDynamic()
				dyn.resources[deployGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							getItems: map[string]*unstructured.Unstructured{
								"my-deploy": deploy,
							},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["apps/v1"] = &metav1.APIResourceList{
					GroupVersion: "apps/v1",
					APIResources: []metav1.APIResource{
						{Name: "deployments", Kind: "Deployment", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"my-deploy"`)
				assert.Contains(t, body, `"Deployment"`)
			},
		},
		{
			name:    "treats _ group as core group",
			ns:      "kro-ui-e2e",
			group:   "_",
			version: "v1",
			kind:    "ConfigMap",
			rname:   "my-config",
			build: func(t *testing.T) *Handler {
				t.Helper()
				cm := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "v1",
					"kind":       "ConfigMap",
					"metadata":   map[string]any{"name": "my-config", "namespace": "kro-ui-e2e"},
				}}

				// Core group GVR has empty group string.
				coreGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}
				dyn := newStubDynamic()
				dyn.resources[coreGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-ui-e2e": {
							getItems: map[string]*unstructured.Unstructured{
								"my-config": cm,
							},
						},
					},
				}

				disc := newStubDiscovery()
				// Core group uses just "v1" as the group version string.
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"my-config"`)
				assert.Contains(t, body, `"ConfigMap"`)
			},
		},
		{
			name:    "returns 404 for missing resource",
			ns:      "default",
			group:   "apps",
			version: "v1",
			kind:    "Deployment",
			rname:   "nonexistent",
			build: func(t *testing.T) *Handler {
				t.Helper()
				deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
				dyn := newStubDynamic()
				dyn.resources[deployGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"default": {
							getItems: map[string]*unstructured.Unstructured{},
						},
					},
				}

				disc := newStubDiscovery()
				disc.resources["apps/v1"] = &metav1.APIResourceList{
					GroupVersion: "apps/v1",
					APIResources: []metav1.APIResource{
						{Name: "deployments", Kind: "Deployment", Verbs: metav1.Verbs{"get", "list"}},
					},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusNotFound, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"error"`)
				assert.Contains(t, body, "not found")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)

			r := chi.NewRouter()
			r.Get("/api/v1/resources/{namespace}/{group}/{version}/{kind}/{name}", h.GetResource)

			url := fmt.Sprintf("/api/v1/resources/%s/%s/%s/%s/%s",
				tt.ns, tt.group, tt.version, tt.kind, tt.rname)
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}
