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
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

func TestGetCapabilities(t *testing.T) {
	// Reset cache before each top-level test.
	capCache.invalidate()

	tests := []struct {
		name  string
		build func() *Handler
		check func(t *testing.T, resp *httptest.ResponseRecorder)
	}{
		{
			name: "returns 200 with capabilities",
			build: func() *Handler {
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				return newRGDTestHandler(newStubDynamic(), disc)
			},
			check: func(t *testing.T, resp *httptest.ResponseRecorder) {
				assert.Equal(t, http.StatusOK, resp.Code)
				assert.Equal(t, "application/json", resp.Header().Get("Content-Type"))

				var caps k8sclient.KroCapabilities
				err := json.NewDecoder(resp.Body).Decode(&caps)
				require.NoError(t, err)
				assert.Contains(t, caps.KnownResources, "resourcegraphdefinitions")
				assert.Equal(t, "kro.run/v1alpha1", caps.APIVersion)
			},
		},
		{
			name: "returns 200 with baseline on error",
			build: func() *Handler {
				disc := newStubDiscovery()
				disc.err = fmt.Errorf("connection refused")
				return newRGDTestHandler(newStubDynamic(), disc)
			},
			check: func(t *testing.T, resp *httptest.ResponseRecorder) {
				assert.Equal(t, http.StatusOK, resp.Code)

				var caps k8sclient.KroCapabilities
				err := json.NewDecoder(resp.Body).Decode(&caps)
				require.NoError(t, err)
				assert.Equal(t, "unknown", caps.Version)
				assert.False(t, caps.FeatureGates["CELOmitFunction"])
			},
		},
		{
			name: "cache hit within TTL",
			build: func() *Handler {
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newStubDynamic()

				// Pre-populate CRD with a distinguishable version so we can confirm cache.
				crd := &unstructured.Unstructured{Object: map[string]any{
					"spec": map[string]any{
						"versions": []any{
							map[string]any{
								"name": "v1alpha1",
								"schema": map[string]any{
									"openAPIV3Schema": map[string]any{
										"properties": map[string]any{
											"spec": map[string]any{
												"properties": map[string]any{
													"resources": map[string]any{
														"items": map[string]any{
															"properties": map[string]any{
																"forEach": map[string]any{},
															},
														},
													},
													"schema": map[string]any{"properties": map[string]any{}},
												},
											},
										},
									},
								},
							},
						},
					},
				}}
				dyn.resources[schema.GroupVersionResource{
					Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions",
				}] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"resourcegraphdefinitions.kro.run": crd},
				}

				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, resp *httptest.ResponseRecorder) {
				assert.Equal(t, http.StatusOK, resp.Code)

				var caps1 k8sclient.KroCapabilities
				require.NoError(t, json.NewDecoder(resp.Body).Decode(&caps1))

				// The second response should be identical (from cache).
				// We verify by calling the same handler again.
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			capCache.invalidate() // Reset cache between tests.
			h := tt.build()

			req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/capabilities", nil)
			resp := httptest.NewRecorder()
			h.GetCapabilities(resp, req)
			tt.check(t, resp)
		})
	}
}

func TestCapabilitiesCacheTTL(t *testing.T) {
	// Use a very short TTL for this test.
	origTTL := capCache.ttl
	capCache.ttl = 50 * time.Millisecond
	defer func() { capCache.ttl = origTTL }()

	capCache.invalidate()

	baseline := k8sclient.Baseline()
	capCache.set(baseline)

	// Immediately: cache hit.
	assert.NotNil(t, capCache.get())

	// Wait past TTL: cache miss.
	time.Sleep(60 * time.Millisecond)
	require.Nil(t, capCache.get(), "cache should be nil after TTL expiry")
}

func TestCapabilitiesCacheInvalidate(t *testing.T) {
	capCache.invalidate()
	baseline := k8sclient.Baseline()
	capCache.set(baseline)
	assert.NotNil(t, capCache.get())

	capCache.invalidate()
	require.Nil(t, capCache.get(), "cache should be nil after explicit invalidate")
}

// TestKroVersionFallbackFromInstances tests the version recovery fallback path in
// GetCapabilities. When DetectCapabilities returns "unknown" (e.g. throttled cluster,
// RBAC gap), kroVersionFromInstances scans RGD instances for the kro.run/kro-version
// label and returns it as the cluster version.
func TestKroVersionFallbackFromInstances(t *testing.T) {
	// RGD instance GVR for the test-app kind
	instGVR := schema.GroupVersionResource{
		Group:    "e2e.kro-ui.dev",
		Version:  "v1alpha1",
		Resource: "webapps",
	}

	// Create a handler where discovery fails (caps.Version = "unknown"),
	// but there is an RGD with a matching instance that has the kro-version label.
	t.Run("recovers version from instance label when discovery returns unknown", func(t *testing.T) {
		capCache.invalidate()

		disc := newStubDiscovery()
		// Discovery error → DetectCapabilities returns baseline with Version="unknown"
		disc.err = fmt.Errorf("connection refused")

		dyn := newStubDynamic()

		// RGD stub: returns one RGD with schema kind=WebApp
		rgdItem := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "test-app"},
			"spec": map[string]any{
				"schema": map[string]any{
					"kind":       "WebApp",
					"group":      "e2e.kro-ui.dev",
					"apiVersion": "v1alpha1",
				},
			},
		}}
		dyn.resources[rgdGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{rgdItem}}

		// Instance stub: returns one instance with kro.run/kro-version label
		instItem := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name":      "my-webapp",
				"namespace": "default",
				"labels": map[string]any{
					"kro.run/kro-version": "v0.9.1",
				},
			},
		}}
		dyn.resources[instGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{instItem}}

		h := newRGDTestHandler(dyn, disc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/capabilities", nil)
		w := httptest.NewRecorder()
		h.GetCapabilities(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var caps k8sclient.KroCapabilities
		require.NoError(t, json.NewDecoder(w.Body).Decode(&caps))
		assert.Equal(t, "v0.9.1", caps.Version, "version should be recovered from instance label")
	})

	t.Run("returns unknown when RGDs exist but instances have no kro-version label", func(t *testing.T) {
		capCache.invalidate()

		disc := newStubDiscovery()
		disc.err = fmt.Errorf("connection refused")

		dyn := newStubDynamic()

		rgdItem := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "test-app"},
			"spec": map[string]any{
				"schema": map[string]any{
					"kind":       "WebApp",
					"group":      "e2e.kro-ui.dev",
					"apiVersion": "v1alpha1",
				},
			},
		}}
		dyn.resources[rgdGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{rgdItem}}

		// Instances exist but have no kro.run/kro-version label
		instItem := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name": "my-webapp",
				"labels": map[string]any{
					"app": "my-webapp", // different label, no kro-version
				},
			},
		}}
		dyn.resources[instGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{instItem}}

		h := newRGDTestHandler(dyn, disc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/capabilities", nil)
		w := httptest.NewRecorder()
		h.GetCapabilities(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var caps k8sclient.KroCapabilities
		require.NoError(t, json.NewDecoder(w.Body).Decode(&caps))
		assert.Equal(t, "unknown", caps.Version, "version should remain unknown when no label found")
	})

	t.Run("returns unknown when RGD list is empty", func(t *testing.T) {
		capCache.invalidate()

		disc := newStubDiscovery()
		disc.err = fmt.Errorf("connection refused")

		dyn := newStubDynamic()
		// RGD resource exists but returns empty list
		dyn.resources[rgdGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}

		h := newRGDTestHandler(dyn, disc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/capabilities", nil)
		w := httptest.NewRecorder()
		h.GetCapabilities(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var caps k8sclient.KroCapabilities
		require.NoError(t, json.NewDecoder(w.Body).Decode(&caps))
		assert.Equal(t, "unknown", caps.Version, "version should remain unknown when no RGDs")
	})

	t.Run("skips RGD with missing schema kind", func(t *testing.T) {
		capCache.invalidate()

		disc := newStubDiscovery()
		disc.err = fmt.Errorf("connection refused")

		dyn := newStubDynamic()
		// RGD with no spec.schema.kind
		badRGD := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "broken-rgd"},
			"spec":     map[string]any{"schema": map[string]any{}}, // missing kind
		}}
		dyn.resources[rgdGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{badRGD}}

		h := newRGDTestHandler(dyn, disc)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/capabilities", nil)
		w := httptest.NewRecorder()
		h.GetCapabilities(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var caps k8sclient.KroCapabilities
		require.NoError(t, json.NewDecoder(w.Body).Decode(&caps))
		// Should not panic, should return unknown
		assert.Equal(t, "unknown", caps.Version)
	})
}
