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

// TestListAllInstances covers the fan-out handler that powers GET /api/v1/instances.
// Constitution §VII: table-driven tests with build/check pattern.
// GH #388.

import (
	"encoding/json"
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

// webAppGVR is the GVR the stub discovery returns for the "WebApp" kind used
// across the test cases below.
var webAppGVR = schema.GroupVersionResource{
	Group:    k8sclient.KroGroup,
	Version:  "v1alpha1",
	Resource: "webapps",
}

// makeInstanceObject builds a minimal unstructured instance CR for testing.
func makeInstanceObject(name, ns, kind, state, ready, message string) *unstructured.Unstructured {
	conditions := []any{}
	if ready != "" {
		cond := map[string]any{
			"type":   "Ready",
			"status": ready,
		}
		if message != "" {
			cond["message"] = message
		}
		conditions = append(conditions, cond)
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "kro.run/v1alpha1",
		"kind":       kind,
		"metadata": map[string]any{
			"name":              name,
			"namespace":         ns,
			"creationTimestamp": time.Now().UTC().Format(time.RFC3339),
		},
		"status": map[string]any{
			"state":      state,
			"conditions": conditions,
		},
	}}
}

// stubDiscoveryForKind returns a stubDiscovery that maps the given kind to its
// plural resource name under kro.run/v1alpha1.
func stubDiscoveryForKind(kind, plural string) *stubDiscovery {
	disc := newStubDiscovery()
	disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
		GroupVersion: "kro.run/v1alpha1",
		APIResources: []metav1.APIResource{
			{Name: plural, Kind: kind, Verbs: metav1.Verbs{"get", "list"}},
		},
	}
	return disc
}

func TestListAllInstances(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		// ── T001: no RGDs → empty list ────────────────────────────────────────
		{
			name: "empty list when no RGDs exist",
			build: func(t *testing.T) *Handler {
				t.Helper()
				dyn := newStubDynamic()
				// rgdGVR returns an empty list (no error, no items).
				dyn.resources[rgdGVR] = &stubNamespaceableResource{items: nil}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)

				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				assert.Equal(t, 0, resp.Total)
				assert.NotNil(t, resp.Items)
				assert.Len(t, resp.Items, 0)
			},
		},

		// ── T002: RGD with no schema kind is skipped ──────────────────────────
		{
			name: "RGD with no schema kind is silently skipped",
			build: func(t *testing.T) *Handler {
				t.Helper()
				// makeRGDObject with empty kind ← no schema.kind set
				rgd := makeRGDObject("no-kind-rgd", "", "", "")
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				assert.Equal(t, 0, resp.Total)
			},
		},

		// ── T003: two instances from one RGD are aggregated ───────────────────
		{
			name: "instances from one RGD are returned",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd := makeRGDObject("webapp-rgd", "WebApp", "", "")
				inst1 := makeInstanceObject("app-1", "default", "WebApp", "Active", "True", "")
				inst2 := makeInstanceObject("app-2", "staging", "WebApp", "Active", "True", "")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst1, *inst2},
				}

				return newRGDTestHandler(dyn, stubDiscoveryForKind("WebApp", "webapps"))
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				assert.Equal(t, 2, resp.Total)
				assert.Len(t, resp.Items, 2)
				// Verify fields are populated on each summary.
				for _, item := range resp.Items {
					assert.Equal(t, "webapp-rgd", item.RGDName)
					assert.Equal(t, "Active", item.State)
					assert.Equal(t, "True", item.Ready)
					assert.NotEmpty(t, item.CreationTimestamp)
				}
			},
		},

		// ── T004: Ready=False message is surfaced ─────────────────────────────
		{
			name: "Ready=False message is included in summary",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd := makeRGDObject("webapp-rgd", "WebApp", "", "")
				inst := makeInstanceObject("broken-app", "default", "WebApp", "Error", "False", "ImagePullBackOff")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst},
				}
				return newRGDTestHandler(dyn, stubDiscoveryForKind("WebApp", "webapps"))
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				require.Len(t, resp.Items, 1)
				assert.Equal(t, "False", resp.Items[0].Ready)
				assert.Equal(t, "ImagePullBackOff", resp.Items[0].Message)
			},
		},

		// ── T005: Ready=True → message is omitted ────────────────────────────
		{
			name: "Ready=True message is omitted from summary",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd := makeRGDObject("webapp-rgd", "WebApp", "", "")
				// message is set but should be suppressed for Ready=True instances
				inst := makeInstanceObject("healthy-app", "default", "WebApp", "Active", "True", "All good")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst},
				}
				return newRGDTestHandler(dyn, stubDiscoveryForKind("WebApp", "webapps"))
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				require.Len(t, resp.Items, 1)
				assert.Equal(t, "True", resp.Items[0].Ready)
				assert.Empty(t, resp.Items[0].Message, "message must be omitted for Ready=True")
			},
		},

		// ── T006: discovery failure falls back to naive plural ────────────────
		{
			name: "discovery failure falls back to kind+s pluralisation",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd := makeRGDObject("webapp-rgd", "WebApp", "", "")
				inst := makeInstanceObject("app-1", "default", "WebApp", "Active", "True", "")

				// Fallback GVR = "webapps" (lowercase + s)
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst},
				}
				// Empty discovery — DiscoverPlural will fail → fallback to "webapps"
				return newRGDTestHandler(dyn, newStubDiscovery())
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				assert.Equal(t, 1, resp.Total)
			},
		},

		// ── T007: list failure for one RGD does not fail the whole response ───
		{
			name: "list failure for one RGD returns partial results",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd1 := makeRGDObject("webapp-rgd", "WebApp", "", "")
				rgd2 := makeRGDObject("broken-rgd", "BrokenApp", "", "")
				inst1 := makeInstanceObject("app-1", "default", "WebApp", "Active", "True", "")

				brokenGVR := schema.GroupVersionResource{
					Group: k8sclient.KroGroup, Version: "v1alpha1", Resource: "brokenapps",
				}

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd1, *rgd2},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst1},
				}
				// brokenGVR returns a list error — goroutine must skip, not crash.
				dyn.resources[brokenGVR] = &stubNamespaceableResource{
					listErr: errTest("simulated list failure"),
				}

				disc := stubDiscoveryForKind("WebApp", "webapps")
				disc.resources["kro.run/v1alpha1"].APIResources = append(
					disc.resources["kro.run/v1alpha1"].APIResources,
					metav1.APIResource{Name: "brokenapps", Kind: "BrokenApp", Verbs: metav1.Verbs{"get", "list"}},
				)
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				// webapp-rgd succeeded; broken-rgd was skipped.
				assert.Equal(t, 1, resp.Total)
				assert.Equal(t, "webapp-rgd", resp.Items[0].RGDName)
			},
		},

		// ── T008: instances from multiple RGDs are all aggregated ────────────
		{
			name: "instances from multiple RGDs are aggregated",
			build: func(t *testing.T) *Handler {
				t.Helper()
				rgd1 := makeRGDObject("webapp-rgd", "WebApp", "", "")
				rgd2 := makeRGDObject("api-rgd", "APIService", "", "")

				apiSvcGVR := schema.GroupVersionResource{
					Group: k8sclient.KroGroup, Version: "v1alpha1", Resource: "apiservices",
				}
				inst1 := makeInstanceObject("app-1", "default", "WebApp", "Active", "True", "")
				inst2 := makeInstanceObject("api-1", "prod", "APIService", "Active", "True", "")
				inst3 := makeInstanceObject("api-2", "staging", "APIService", "Active", "False", "deploying")

				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd1, *rgd2},
				}
				dyn.resources[webAppGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst1},
				}
				dyn.resources[apiSvcGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*inst2, *inst3},
				}
				disc := stubDiscoveryForKind("WebApp", "webapps")
				disc.resources["kro.run/v1alpha1"].APIResources = append(
					disc.resources["kro.run/v1alpha1"].APIResources,
					metav1.APIResource{Name: "apiservices", Kind: "APIService", Verbs: metav1.Verbs{"get", "list"}},
				)
				return newRGDTestHandler(dyn, disc)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var resp ListAllInstancesResponse
				require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
				assert.Equal(t, 3, resp.Total)
				assert.Len(t, resp.Items, 3)
				// Verify RGDName is populated correctly on each.
				rgdNames := map[string]bool{}
				for _, item := range resp.Items {
					rgdNames[item.RGDName] = true
				}
				assert.True(t, rgdNames["webapp-rgd"])
				assert.True(t, rgdNames["api-rgd"])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/instances", nil)
			rr := httptest.NewRecorder()
			h.ListAllInstances(rr, req)
			tt.check(t, rr)
		})
	}
}

// errTest is a small helper to create a simple error value in test stubs.
type testErr struct{ msg string }

func (e testErr) Error() string { return e.msg }

func errTest(msg string) error { return testErr{msg} }

// ── ListAllInstances edge-path coverage ──────────────────────────────────────

// TestListAllInstances_RGDListError covers the error path when listing RGDs fails.
func TestListAllInstances_RGDListError(t *testing.T) {
	// Make the RGD list call fail by not registering the rgdGVR in the stub.
	dyn := newStubDynamic()
	// rgdGVR not registered → stub returns "resource not found" error on List.
	h := newRGDTestHandler(dyn, newStubDiscovery())

	req := httptest.NewRequest(http.MethodGet, "/api/v1/instances", nil)
	rr := httptest.NewRecorder()
	h.ListAllInstances(rr, req)

	require.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.Contains(t, rr.Body.String(), "failed to list RGDs")
}

// TestListAllInstances_SkipNilMetadata verifies that instance objects with nil
// metadata are silently skipped (defensive guard at line 142).
func TestListAllInstances_SkipNilMetadata(t *testing.T) {
	// Build an RGD + an instance with nil metadata.
	rgd := makeRGDObject("webapp-rgd", "WebApp", "kro.run", "v1alpha1")
	disc := stubDiscoveryForKind("WebApp", "webapps")

	// Instance with nil metadata (unusual but the guard must handle it).
	nilMetaInst := unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "kro.run/v1alpha1",
		"kind":       "WebApp",
		// "metadata" key absent — obj.Object["metadata"] == nil
		"status": map[string]any{"state": "ACTIVE"},
	}}

	// A normal instance that should be included.
	normalInst := *makeInstanceObject("my-app", "default", "WebApp", "ACTIVE", "True", "")

	dyn := newStubDynamic()
	dyn.resources[rgdGVR] = &stubNamespaceableResource{
		items: []unstructured.Unstructured{*rgd},
	}
	dyn.resources[webAppGVR] = &stubNamespaceableResource{
		items: []unstructured.Unstructured{nilMetaInst, normalInst},
	}

	h := newRGDTestHandler(dyn, disc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/instances", nil)
	rr := httptest.NewRecorder()
	h.ListAllInstances(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp struct {
		Items []InstanceSummary `json:"items"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	// The nil-metadata instance should be skipped; only the normal one included.
	require.Len(t, resp.Items, 1, "nil-metadata instance must be skipped")
	assert.Equal(t, "my-app", resp.Items[0].Name)
}

// TestListAllInstances_SkipEmptyName verifies that instance objects with an
// empty name are silently skipped (defensive guard at line 147).
func TestListAllInstances_SkipEmptyName(t *testing.T) {
	rgd := makeRGDObject("webapp-rgd", "WebApp", "kro.run", "v1alpha1")
	disc := stubDiscoveryForKind("WebApp", "webapps")

	// Instance with empty name.
	emptyNameInst := unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "kro.run/v1alpha1",
		"kind":       "WebApp",
		"metadata": map[string]any{
			"name":      "",
			"namespace": "default",
		},
		"status": map[string]any{"state": "ACTIVE"},
	}}

	// A normal instance that should be included.
	normalInst := *makeInstanceObject("good-app", "default", "WebApp", "ACTIVE", "True", "")

	dyn := newStubDynamic()
	dyn.resources[rgdGVR] = &stubNamespaceableResource{
		items: []unstructured.Unstructured{*rgd},
	}
	dyn.resources[webAppGVR] = &stubNamespaceableResource{
		items: []unstructured.Unstructured{emptyNameInst, normalInst},
	}

	h := newRGDTestHandler(dyn, disc)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/instances", nil)
	rr := httptest.NewRecorder()
	h.ListAllInstances(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp struct {
		Items []InstanceSummary `json:"items"`
	}
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	require.Len(t, resp.Items, 1, "empty-name instance must be skipped")
	assert.Equal(t, "good-app", resp.Items[0].Name)
}
