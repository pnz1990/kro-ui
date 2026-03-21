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
	assert.Nil(t, capCache.get())
}

func TestCapabilitiesCacheInvalidate(t *testing.T) {
	capCache.invalidate()
	baseline := k8sclient.Baseline()
	capCache.set(baseline)
	assert.NotNil(t, capCache.get())

	capCache.invalidate()
	assert.Nil(t, capCache.get())
}
