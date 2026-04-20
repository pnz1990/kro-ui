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
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// stubFleetClientBuilder is a hand-written stub for fleetClientBuilder.
// Each context name maps to either a stubK8sClients or an error.
type stubFleetClientBuilder struct {
	clients map[string]*stubK8sClients
	errs    map[string]error
}

func (s *stubFleetClientBuilder) BuildClient(_, ctx string) (k8sclient.K8sClients, error) {
	if err, ok := s.errs[ctx]; ok {
		return nil, err
	}
	if c, ok := s.clients[ctx]; ok {
		return c, nil
	}
	return nil, nil
}

// newFleetTestHandler creates a Handler wired with fleet-testing stubs.
func newFleetTestHandler(ctxStub *stubClientFactory, builder *stubFleetClientBuilder) *Handler {
	return &Handler{
		ctxMgr:       ctxStub,
		fleetBuilder: builder,
	}
}

func TestFleetSummary(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *Handler
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "all clusters reachable returns summaries for all",
			build: func(t *testing.T) *Handler {
				t.Helper()
				ctxStub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "prod", Cluster: "prod-cluster", User: "prod-user"},
						{Name: "dev", Cluster: "dev-cluster", User: "dev-user"},
					},
				}

				rgd := makeRGDObject("webapp", "WebApp", "kro.run", "v1alpha1")
				prodDyn := newStubDynamic()
				prodDyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}

				devDyn := newStubDynamic()
				devDyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{},
				}

				builder := &stubFleetClientBuilder{
					clients: map[string]*stubK8sClients{
						"prod": {dyn: prodDyn, disc: newStubDiscovery()},
						"dev":  {dyn: devDyn, disc: newStubDiscovery()},
					},
				}
				return newFleetTestHandler(ctxStub, builder)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"clusters"`)
				assert.Contains(t, body, `"prod"`)
				assert.Contains(t, body, `"dev"`)
			},
		},
		{
			name: "one cluster unreachable does not block others",
			build: func(t *testing.T) *Handler {
				t.Helper()
				ctxStub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "prod", Cluster: "prod-cluster", User: "prod-user"},
						{Name: "bad", Cluster: "bad-cluster", User: "bad-user"},
					},
				}

				prodDyn := newStubDynamic()
				prodDyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{},
				}

				builder := &stubFleetClientBuilder{
					clients: map[string]*stubK8sClients{
						"prod": {dyn: prodDyn, disc: newStubDiscovery()},
					},
					errs: map[string]error{
						"bad": assert.AnError,
					},
				}
				return newFleetTestHandler(ctxStub, builder)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"prod"`)
				assert.Contains(t, body, `"bad"`)
				assert.Contains(t, body, string(types.ClusterUnreachable))
			},
		},
		{
			name: "no contexts configured returns empty clusters array",
			build: func(t *testing.T) *Handler {
				t.Helper()
				ctxStub := &stubClientFactory{contexts: []k8sclient.Context{}}
				builder := &stubFleetClientBuilder{}
				return newFleetTestHandler(ctxStub, builder)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Body.String(), `"clusters":[]`)
			},
		},
		{
			name: "kro not installed shown as kro-not-installed health",
			build: func(t *testing.T) *Handler {
				t.Helper()
				ctxStub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "bare", Cluster: "bare-cluster", User: "bare-user"},
					},
				}
				// RGD list returns error (CRD not found)
				bareDyn := newStubDynamic()
				bareDyn.resources[rgdGVR] = &stubNamespaceableResource{
					listErr: assert.AnError,
				}

				builder := &stubFleetClientBuilder{
					clients: map[string]*stubK8sClients{
						"bare": {dyn: bareDyn, disc: newStubDiscovery()},
					},
				}
				return newFleetTestHandler(ctxStub, builder)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"bare"`)
				assert.Contains(t, body, string(types.ClusterKroNotInstalled))
			},
		},
		{
			name: "kro version read from instance label (kro stamps kro.run/kro-version on CRs, not RGDs)",
			build: func(t *testing.T) *Handler {
				t.Helper()
				ctxStub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "prod", Cluster: "prod-cluster", User: "prod-user"},
					},
				}

				rgd := makeRGDObject("webapp", "WebApp", "kro.run", "v1alpha1")
				// Instance GVR: DiscoverPlural falls back to naive "webapps"
				instanceGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "webapps"}
				instance := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "kro.run/v1alpha1",
					"kind":       "WebApp",
					"metadata": map[string]any{
						"name":      "my-webapp",
						"namespace": "default",
						"labels": map[string]any{
							"kro.run/kro-version": "v0.9.1",
						},
					},
				}}

				prodDyn := newStubDynamic()
				prodDyn.resources[rgdGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*rgd},
				}
				prodDyn.resources[instanceGVR] = &stubNamespaceableResource{
					items: []unstructured.Unstructured{*instance},
				}

				builder := &stubFleetClientBuilder{
					clients: map[string]*stubK8sClients{
						"prod": {dyn: prodDyn, disc: newStubDiscovery()},
					},
				}
				return newFleetTestHandler(ctxStub, builder)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Body.String(), `"v0.9.1"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := tt.build(t)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
			rr := httptest.NewRecorder()
			h.FleetSummary(rr, req)
			tt.check(t, rr)
		})
	}
}

// ── isInstanceDegraded unit tests ─────────────────────────────────────────────

func TestIsInstanceDegraded(t *testing.T) {
	tests := []struct {
		name string
		obj  map[string]any
		want bool
	}{
		{
			name: "Ready=True → not degraded",
			obj: map[string]any{
				"status": map[string]any{
					"conditions": []any{
						map[string]any{"type": "Ready", "status": "True"},
					},
				},
			},
			want: false,
		},
		{
			name: "Ready=False → degraded",
			obj: map[string]any{
				"status": map[string]any{
					"conditions": []any{
						map[string]any{"type": "Ready", "status": "False"},
					},
				},
			},
			want: true,
		},
		{
			name: "state=IN_PROGRESS + Ready=False → NOT degraded (reconciling)",
			obj: map[string]any{
				"status": map[string]any{
					"state": "IN_PROGRESS",
					"conditions": []any{
						map[string]any{"type": "Ready", "status": "False"},
					},
				},
			},
			want: false,
		},
		{
			name: "state=ACTIVE + Ready=False → degraded",
			obj: map[string]any{
				"status": map[string]any{
					"state": "ACTIVE",
					"conditions": []any{
						map[string]any{"type": "Ready", "status": "False"},
					},
				},
			},
			want: true,
		},
		{
			name: "no conditions → not degraded",
			obj:  map[string]any{"status": map[string]any{}},
			want: false,
		},
		{
			name: "no status → not degraded",
			obj:  map[string]any{},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isInstanceDegraded(tt.obj)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestIsInstanceReconciling(t *testing.T) {
	tests := []struct {
		name string
		obj  map[string]any
		want bool
	}{
		{
			name: "state=IN_PROGRESS → reconciling",
			obj: map[string]any{
				"status": map[string]any{"state": "IN_PROGRESS"},
			},
			want: true,
		},
		{
			name: "state=ACTIVE → not reconciling",
			obj: map[string]any{
				"status": map[string]any{"state": "ACTIVE"},
			},
			want: false,
		},
		{
			name: "no status → not reconciling",
			obj:  map[string]any{},
			want: false,
		},
		{
			name: "never-ready scenario: IN_PROGRESS → reconciling (not degraded)",
			obj: map[string]any{
				"status": map[string]any{
					"state": "IN_PROGRESS",
					"conditions": []any{
						map[string]any{"type": "Ready", "status": "False"},
					},
				},
			},
			want: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isInstanceReconciling(tt.obj)
			assert.Equal(t, tt.want, got)
		})
	}
}

// ── FleetSummary branch coverage ──────────────────────────────────────────────

// TestFleetSummary_ListContextsError verifies that a ListContexts error
// returns 500.
func TestFleetSummary_ListContextsError(t *testing.T) {
	ctxStub := &stubClientFactory{listErr: fmt.Errorf("kubeconfig unreachable")}
	builder := &stubFleetClientBuilder{}
	h := newFleetTestHandler(ctxStub, builder)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet", nil)
	rr := httptest.NewRecorder()
	h.FleetSummary(rr, req)

	require.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.Contains(t, rr.Body.String(), `"error"`)
}

// TestFleetSummary_AuthErrorShownAsAuthFailed verifies that an auth error
// (RBAC forbidden) on RGD List is shown as ClusterAuthFailed health state.
func TestFleetSummary_AuthErrorShownAsAuthFailed(t *testing.T) {
	ctxStub := &stubClientFactory{
		contexts: []k8sclient.Context{
			{Name: "restricted", Cluster: "restricted-cluster", User: "restricted-user"},
		},
	}

	authDyn := newStubDynamic()
	authDyn.resources[rgdGVR] = &stubNamespaceableResource{
		listErr: fmt.Errorf("Forbidden: User cannot list resource \"resourcegraphdefinitions\""),
	}

	builder := &stubFleetClientBuilder{
		clients: map[string]*stubK8sClients{
			"restricted": {dyn: authDyn, disc: newStubDiscovery()},
		},
	}
	h := newFleetTestHandler(ctxStub, builder)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet", nil)
	rr := httptest.NewRecorder()
	h.FleetSummary(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	body := rr.Body.String()
	assert.Contains(t, body, `"restricted"`)
	assert.Contains(t, body, string(types.ClusterAuthFailed))
}

// ── TestRealFleetClientBuilder_BuildClient (T031) ──────────────────────────────

// TestRealFleetClientBuilder_BuildClient covers realFleetClientBuilder.BuildClient,
// which is a thin adapter over k8sclient.BuildContextClient. Tests error and success paths.
func TestRealFleetClientBuilder_BuildClient(t *testing.T) {
	t.Run("returns error on missing kubeconfig", func(t *testing.T) {
		b := &realFleetClientBuilder{kubeconfigPath: "/nonexistent/kubeconfig"}
		_, err := b.BuildClient("/nonexistent/kubeconfig", "any-context")
		require.Error(t, err, "must propagate BuildContextClient error")
		assert.Contains(t, err.Error(), "build rest config")
	})

	t.Run("succeeds with a valid kubeconfig", func(t *testing.T) {
		dir := t.TempDir()
		path := dir + "/kubeconfig"
		require.NoError(t, os.WriteFile(path, []byte(testKubeconfigForHandlerNew), 0600))

		b := &realFleetClientBuilder{kubeconfigPath: path}
		clients, err := b.BuildClient(path, "test")
		require.NoError(t, err)
		assert.NotNil(t, clients.Dynamic())
		assert.NotNil(t, clients.Discovery())
	})
}
