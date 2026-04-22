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
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types2 "k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"

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

// ── TestFleetSummaryEdgePaths covers summariseContext edge paths ──────────────

// TestFleetSummaryEdgePaths exercises the RGD-field defaulting logic and the
// degraded-cluster health path — all paths that TestFleetSummary doesn't reach.
func TestFleetSummaryEdgePaths(t *testing.T) {
	t.Run("RGD with empty kind is skipped — no GVR created for that RGD", func(t *testing.T) {
		// makeRGDObject with kind="" — kind is not set in the schema
		rgdNoKind := makeRGDObject("no-kind-rgd", "", "kro.run", "v1alpha1")
		rgdValid := makeRGDObject("valid-rgd", "WebApp", "kro.run", "v1alpha1")

		instanceGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "webapps"}
		instance := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "wa", "namespace": "default"},
		}}

		dyn := newStubDynamic()
		dyn.resources[rgdGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*rgdNoKind, *rgdValid},
		}
		dyn.resources[instanceGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*instance},
		}

		ctxStub := &stubClientFactory{
			contexts: []k8sclient.Context{{Name: "prod", Cluster: "prod", User: "u"}},
		}
		builder := &stubFleetClientBuilder{
			clients: map[string]*stubK8sClients{
				"prod": {dyn: dyn, disc: newStubDiscovery()},
			},
		}
		h := newFleetTestHandler(ctxStub, builder)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
		rr := httptest.NewRecorder()
		h.FleetSummary(rr, req)

		require.Equal(t, http.StatusOK, rr.Code)
		body := rr.Body.String()
		// The valid RGD produced 1 instance; the no-kind RGD was skipped
		assert.Contains(t, body, `"prod"`)
		assert.Contains(t, body, `"rgdCount":2`) // both RGDs counted in rgdCount
	})

	t.Run("RGD with empty group defaults to KroGroup", func(t *testing.T) {
		// makeRGDObject with group="" — group falls back to KroGroup
		rgdNoGroup := makeRGDObject("no-group-rgd", "MyApp", "", "v1alpha1")
		// Instance GVR uses KroGroup as fallback
		instanceGVR := schema.GroupVersionResource{Group: k8sclient.KroGroup, Version: "v1alpha1", Resource: "myapps"}

		dyn := newStubDynamic()
		dyn.resources[rgdGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*rgdNoGroup},
		}
		dyn.resources[instanceGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{},
		}

		ctxStub := &stubClientFactory{
			contexts: []k8sclient.Context{{Name: "prod", Cluster: "prod", User: "u"}},
		}
		builder := &stubFleetClientBuilder{
			clients: map[string]*stubK8sClients{
				"prod": {dyn: dyn, disc: newStubDiscovery()},
			},
		}
		h := newFleetTestHandler(ctxStub, builder)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
		rr := httptest.NewRecorder()
		h.FleetSummary(rr, req)

		require.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), `"prod"`)
	})

	t.Run("RGD with empty apiVersion defaults to v1alpha1", func(t *testing.T) {
		// makeRGDObject with apiVersion="" — apiVersion falls back to "v1alpha1"
		rgdNoVer := makeRGDObject("no-ver-rgd", "MyApp", "kro.run", "")
		instanceGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "myapps"}

		dyn := newStubDynamic()
		dyn.resources[rgdGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*rgdNoVer},
		}
		dyn.resources[instanceGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{},
		}

		ctxStub := &stubClientFactory{
			contexts: []k8sclient.Context{{Name: "prod", Cluster: "prod", User: "u"}},
		}
		builder := &stubFleetClientBuilder{
			clients: map[string]*stubK8sClients{
				"prod": {dyn: dyn, disc: newStubDiscovery()},
			},
		}
		h := newFleetTestHandler(ctxStub, builder)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
		rr := httptest.NewRecorder()
		h.FleetSummary(rr, req)

		require.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), `"prod"`)
	})

	t.Run("degraded instances → ClusterDegraded health", func(t *testing.T) {
		// Instance with Ready=False and no IN_PROGRESS state → degraded
		rgd := makeRGDObject("webapp", "WebApp", "kro.run", "v1alpha1")
		instanceGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "webapps"}

		// Degraded instance: Ready=False, not IN_PROGRESS
		degradedInstance := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "wa", "namespace": "default"},
			"status": map[string]any{
				"conditions": []any{
					map[string]any{"type": "Ready", "status": "False"},
				},
			},
		}}

		dyn := newStubDynamic()
		dyn.resources[rgdGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*rgd},
		}
		dyn.resources[instanceGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*degradedInstance},
		}

		ctxStub := &stubClientFactory{
			contexts: []k8sclient.Context{{Name: "prod", Cluster: "prod", User: "u"}},
		}
		builder := &stubFleetClientBuilder{
			clients: map[string]*stubK8sClients{
				"prod": {dyn: dyn, disc: newStubDiscovery()},
			},
		}
		h := newFleetTestHandler(ctxStub, builder)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
		rr := httptest.NewRecorder()
		h.FleetSummary(rr, req)

		require.Equal(t, http.StatusOK, rr.Code)
		body := rr.Body.String()
		assert.Contains(t, body, string(types.ClusterDegraded),
			"cluster with degraded instances must have ClusterDegraded health")
		assert.Contains(t, body, `"degradedInstances":1`)
	})

	t.Run("reconciling instances counted separately from degraded", func(t *testing.T) {
		rgd := makeRGDObject("webapp", "WebApp", "kro.run", "v1alpha1")
		instanceGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "webapps"}

		// IN_PROGRESS instance → reconciling (not degraded)
		reconcilingInstance := &unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{"name": "wa", "namespace": "default"},
			"status": map[string]any{
				"state": "IN_PROGRESS",
			},
		}}

		dyn := newStubDynamic()
		dyn.resources[rgdGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*rgd},
		}
		dyn.resources[instanceGVR] = &stubNamespaceableResource{
			items: []unstructured.Unstructured{*reconcilingInstance},
		}

		ctxStub := &stubClientFactory{
			contexts: []k8sclient.Context{{Name: "prod", Cluster: "prod", User: "u"}},
		}
		builder := &stubFleetClientBuilder{
			clients: map[string]*stubK8sClients{
				"prod": {dyn: dyn, disc: newStubDiscovery()},
			},
		}
		h := newFleetTestHandler(ctxStub, builder)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
		rr := httptest.NewRecorder()
		h.FleetSummary(rr, req)

		require.Equal(t, http.StatusOK, rr.Code)
		body := rr.Body.String()
		// IN_PROGRESS → not degraded, cluster stays healthy
		assert.NotContains(t, body, `"health":"degraded"`,
			"cluster with only reconciling instances must NOT have degraded health")
		assert.Contains(t, body, `"reconcilingInstances":1`)
	})
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

// ── TestFleetSummaryHandler_ContextTimeout (T032, spec issue-646 O3) ──────────

// slowFleetClientBuilder returns clients whose List() call blocks until the
// context is cancelled (simulating a cluster that accepts the connection but
// never sends a response). This tests the per-cluster 5s inner deadline.
type slowFleetClientBuilder struct{}

// slowK8sClients wraps a slowDynamic so it implements k8sclient.K8sClients.
type slowK8sClients struct {
	dyn  *slowDynamic
	disc *stubDiscovery
}

func (s *slowK8sClients) Dynamic() dynamic.Interface              { return s.dyn }
func (s *slowK8sClients) Discovery() discovery.DiscoveryInterface { return s.disc }
func (s *slowK8sClients) CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error) {
	_, lists, err := s.disc.ServerGroupsAndResources()
	return lists, err
}

func (b *slowFleetClientBuilder) BuildClient(_, _ string) (k8sclient.K8sClients, error) {
	return &slowK8sClients{
		dyn:  &slowDynamic{},
		disc: newStubDiscovery(),
	}, nil
}

// slowDynamic returns a NamespaceableResourceInterface whose List() blocks until ctx is done.
type slowDynamic struct{}

func (s *slowDynamic) Resource(_ schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	return &slowNamespaceableResource{}
}

type slowNamespaceableResource struct{}

func (s *slowNamespaceableResource) List(ctx context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}
func (s *slowNamespaceableResource) Get(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Apply(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) ApplyStatus(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Create(_ context.Context, _ *unstructured.Unstructured, _ metav1.CreateOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Update(_ context.Context, _ *unstructured.Unstructured, _ metav1.UpdateOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) UpdateStatus(_ context.Context, _ *unstructured.Unstructured, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Delete(_ context.Context, _ string, _ metav1.DeleteOptions, _ ...string) error {
	return fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) DeleteCollection(_ context.Context, _ metav1.DeleteOptions, _ metav1.ListOptions) error {
	return fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Watch(_ context.Context, _ metav1.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Patch(_ context.Context, _ string, _ types2.PatchType, _ []byte, _ metav1.PatchOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}
func (s *slowNamespaceableResource) Namespace(_ string) dynamic.ResourceInterface {
	return s
}

// TestFleetSummaryHandler_ContextTimeout verifies that a single hung cluster
// does not hold the Fleet response beyond the 5s per-cluster inner deadline.
// Spec: .specify/specs/issue-646/spec.md O3
func TestFleetSummaryHandler_ContextTimeout(t *testing.T) {
	ctxStub := &stubClientFactory{
		contexts: []k8sclient.Context{
			{Name: "slow-cluster", Cluster: "slow-cluster"},
		},
	}

	// Builder returns clients whose List() blocks until context is cancelled.
	builder := &slowFleetClientBuilder{}
	h := &Handler{
		ctxMgr:       ctxStub,
		fleetBuilder: builder,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/summary", nil)
	rr := httptest.NewRecorder()

	start := time.Now()
	h.FleetSummary(rr, req)
	elapsed := time.Since(start)

	// The response must arrive within 6 seconds — the inner deadline fires at 5s.
	assert.Less(t, elapsed, 6*time.Second,
		"Fleet response must not hang beyond the 5s per-cluster inner deadline; got %v", elapsed)

	// The slow cluster must report an unhealthy status (unreachable or kro-not-installed).
	require.Equal(t, http.StatusOK, rr.Code)
	body := rr.Body.String()
	assert.Contains(t, body, "slow-cluster",
		"response must include the slow cluster entry")
	assert.True(t,
		strings.Contains(body, string(types.ClusterUnreachable)) ||
			strings.Contains(body, string(types.ClusterKroNotInstalled)),
		"slow cluster must be marked unreachable or kro-not-installed; body: %s", body)
}
