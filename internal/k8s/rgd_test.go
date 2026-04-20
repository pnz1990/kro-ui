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

package k8s

import (
	"context"
	"fmt"
	"testing"

	openapi_v2 "github.com/google/gnostic-models/openapiv2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/openapi"
	restclient "k8s.io/client-go/rest"
)

// --- Stubs for testing ---

// stubK8sClients implements K8sClients for testing.
type stubK8sClients struct {
	dyn  *stubDynamic
	disc *stubDiscovery
}

func (s *stubK8sClients) Dynamic() dynamic.Interface              { return s.dyn }
func (s *stubK8sClients) Discovery() discovery.DiscoveryInterface { return s.disc }
func (s *stubK8sClients) CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error) {
	_, lists, err := s.disc.ServerGroupsAndResources()
	return lists, err
}

// stubDynamic implements dynamic.Interface.
type stubDynamic struct {
	resources map[schema.GroupVersionResource]*stubNamespaceableResource
}

func newStubDynamic() *stubDynamic {
	return &stubDynamic{resources: make(map[schema.GroupVersionResource]*stubNamespaceableResource)}
}

func (s *stubDynamic) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	if r, ok := s.resources[gvr]; ok {
		return r
	}
	return &stubNamespaceableResource{
		listErr: fmt.Errorf("resource %v not found", gvr),
		getErr:  fmt.Errorf("resource %v not found", gvr),
	}
}

// stubNamespaceableResource implements dynamic.NamespaceableResourceInterface.
type stubNamespaceableResource struct {
	items       []unstructured.Unstructured
	getItems    map[string]*unstructured.Unstructured
	listErr     error
	getErr      error
	nsResources map[string]*stubResourceClient
	// labelItems is used by cluster-scoped List() calls (no .Namespace() wrapper). Issue #202.
	labelItems map[string][]unstructured.Unstructured
}

func (s *stubNamespaceableResource) Namespace(ns string) dynamic.ResourceInterface {
	if s.nsResources != nil {
		if r, ok := s.nsResources[ns]; ok {
			return r
		}
	}
	return &stubResourceClient{
		items:    s.items,
		getItems: s.getItems,
		listErr:  s.listErr,
		getErr:   s.getErr,
	}
}

func (s *stubNamespaceableResource) List(_ context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	// Support label-selector filtering for cluster-scoped List() calls. Issue #202.
	if opts.LabelSelector != "" && s.labelItems != nil {
		if items, ok := s.labelItems[opts.LabelSelector]; ok {
			return &unstructured.UnstructuredList{Items: items}, nil
		}
		return &unstructured.UnstructuredList{}, nil
	}
	return &unstructured.UnstructuredList{Items: s.items}, nil
}

func (s *stubNamespaceableResource) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	if s.getItems != nil {
		if obj, ok := s.getItems[name]; ok {
			return obj, nil
		}
	}
	return nil, fmt.Errorf("not found: %s", name)
}

func (s *stubNamespaceableResource) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResource) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// stubResourceClient implements dynamic.ResourceInterface (namespaced).
type stubResourceClient struct {
	items      []unstructured.Unstructured
	getItems   map[string]*unstructured.Unstructured
	labelItems map[string][]unstructured.Unstructured
	listErr    error
	getErr     error
}

func (s *stubResourceClient) List(_ context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	if opts.LabelSelector != "" && s.labelItems != nil {
		if items, ok := s.labelItems[opts.LabelSelector]; ok {
			return &unstructured.UnstructuredList{Items: items}, nil
		}
		return &unstructured.UnstructuredList{Items: nil}, nil
	}
	return &unstructured.UnstructuredList{Items: s.items}, nil
}

func (s *stubResourceClient) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	if s.getItems != nil {
		if obj, ok := s.getItems[name]; ok {
			return obj, nil
		}
	}
	return nil, fmt.Errorf("not found: %s", name)
}

func (s *stubResourceClient) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only stub")
}
func (s *stubResourceClient) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only stub")
}
func (s *stubResourceClient) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubResourceClient) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// stubDiscovery implements discovery.DiscoveryInterface.
type stubDiscovery struct {
	resources map[string]*metav1.APIResourceList
	err       error
}

func newStubDiscovery() *stubDiscovery {
	return &stubDiscovery{resources: make(map[string]*metav1.APIResourceList)}
}

func (s *stubDiscovery) ServerResourcesForGroupVersion(gv string) (*metav1.APIResourceList, error) {
	if s.err != nil {
		return nil, s.err
	}
	if rl, ok := s.resources[gv]; ok {
		return rl, nil
	}
	return nil, fmt.Errorf("group version %q not found", gv)
}

func (s *stubDiscovery) RESTClient() restclient.Interface { return nil }
func (s *stubDiscovery) ServerGroups() (*metav1.APIGroupList, error) {
	return &metav1.APIGroupList{}, nil
}
func (s *stubDiscovery) ServerGroupsAndResources() ([]*metav1.APIGroup, []*metav1.APIResourceList, error) {
	if s.err != nil {
		return nil, nil, s.err
	}
	var lists []*metav1.APIResourceList
	for _, rl := range s.resources {
		lists = append(lists, rl)
	}
	return nil, lists, nil
}
func (s *stubDiscovery) ServerPreferredResources() ([]*metav1.APIResourceList, error) {
	return nil, nil
}
func (s *stubDiscovery) ServerPreferredNamespacedResources() ([]*metav1.APIResourceList, error) {
	return nil, nil
}
func (s *stubDiscovery) ServerVersion() (*version.Info, error) {
	return &version.Info{}, nil
}
func (s *stubDiscovery) OpenAPISchema() (*openapi_v2.Document, error) { return nil, nil }
func (s *stubDiscovery) OpenAPIV3() openapi.Client                    { return nil }
func (s *stubDiscovery) WithLegacy() discovery.DiscoveryInterface     { return s }

// --- Tests ---

func TestUnstructuredString(t *testing.T) {
	tests := []struct {
		name     string
		build    func(t *testing.T) (map[string]any, []string)
		checkVal string
		checkOK  bool
		checkErr bool
	}{
		{
			name: "extracts nested string value",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				obj := map[string]any{
					"spec": map[string]any{
						"schema": map[string]any{
							"kind": "WebService",
						},
					},
				}
				return obj, []string{"spec", "schema", "kind"}
			},
			checkVal: "WebService",
			checkOK:  true,
		},
		{
			name: "returns empty when key not found",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				obj := map[string]any{
					"spec": map[string]any{
						"schema": map[string]any{},
					},
				}
				return obj, []string{"spec", "schema", "kind"}
			},
			checkVal: "",
			checkOK:  false,
		},
		{
			name: "returns empty when intermediate key missing",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				obj := map[string]any{
					"spec": map[string]any{},
				}
				return obj, []string{"spec", "schema", "kind"}
			},
			checkVal: "",
			checkOK:  false,
		},
		{
			name: "returns false when value is not a string",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				obj := map[string]any{
					"spec": map[string]any{
						"schema": map[string]any{
							"kind": 42,
						},
					},
				}
				return obj, []string{"spec", "schema", "kind"}
			},
			checkVal: "",
			checkOK:  false,
		},
		{
			name: "handles single-level path",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				obj := map[string]any{
					"name": "test",
				}
				return obj, []string{"name"}
			},
			checkVal: "test",
			checkOK:  true,
		},
		{
			name: "handles empty object",
			build: func(t *testing.T) (map[string]any, []string) {
				t.Helper()
				return map[string]any{}, []string{"spec", "schema", "kind"}
			},
			checkVal: "",
			checkOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj, path := tt.build(t)
			val, ok, err := UnstructuredString(obj, path...)
			if tt.checkErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			assert.Equal(t, tt.checkVal, val)
			assert.Equal(t, tt.checkOK, ok)
		})
	}
}

func TestIsListable(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) metav1.APIResource
		check func(t *testing.T, result bool)
	}{
		{
			name: "listable resource returns true",
			build: func(t *testing.T) metav1.APIResource {
				t.Helper()
				return metav1.APIResource{
					Name:  "pods",
					Verbs: metav1.Verbs{"get", "list", "watch"},
				}
			},
			check: func(t *testing.T, result bool) {
				t.Helper()
				assert.True(t, result)
			},
		},
		{
			name: "non-listable resource returns false",
			build: func(t *testing.T) metav1.APIResource {
				t.Helper()
				return metav1.APIResource{
					Name:  "pods",
					Verbs: metav1.Verbs{"get", "watch"},
				}
			},
			check: func(t *testing.T, result bool) {
				t.Helper()
				assert.False(t, result)
			},
		},
		{
			name: "subresource returns false even if listable",
			build: func(t *testing.T) metav1.APIResource {
				t.Helper()
				return metav1.APIResource{
					Name:  "pods/status",
					Verbs: metav1.Verbs{"get", "list"},
				}
			},
			check: func(t *testing.T, result bool) {
				t.Helper()
				assert.False(t, result)
			},
		},
		{
			name: "empty verbs returns false",
			build: func(t *testing.T) metav1.APIResource {
				t.Helper()
				return metav1.APIResource{
					Name:  "secrets",
					Verbs: metav1.Verbs{},
				}
			},
			check: func(t *testing.T, result bool) {
				t.Helper()
				assert.False(t, result)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := tt.build(t)
			result := IsListable(res)
			tt.check(t, result)
		})
	}
}

func TestDiscoverPlural(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string, string, string)
		check func(t *testing.T, plural string, err error)
	}{
		{
			name: "discovers correct plural from discovery API",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
						{Name: "databases", Kind: "Database", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "kro.run", "v1alpha1", "TestApp"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, "testapps", plural)
			},
		},
		{
			name: "case-insensitive kind matching",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "databases", Kind: "Database", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "kro.run", "v1alpha1", "database"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, "databases", plural)
			},
		},
		{
			name: "returns error when kind not found",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "testapps", Kind: "TestApp", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "kro.run", "v1alpha1", "NonExistent"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "NonExistent")
				assert.Contains(t, err.Error(), "not found")
			},
		},
		{
			name: "returns error when discovery fails",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.err = fmt.Errorf("discovery unavailable")
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "kro.run", "v1alpha1", "TestApp"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "discovery unavailable")
			},
		},
		{
			name: "handles empty group correctly",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "pods", Kind: "Pod", Verbs: metav1.Verbs{"get", "list"}},
					},
				}
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "", "v1", "Pod"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, "pods", plural)
			},
		},
		{
			name: "returns error when group version not registered",
			build: func(t *testing.T) (K8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "unknown.io", "v1beta1", "Foo"
			},
			check: func(t *testing.T, plural string, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "not found")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, group, version, kind := tt.build(t)
			plural, err := DiscoverPlural(clients, group, version, kind)
			tt.check(t, plural, err)
		})
	}
}

func TestListChildResources(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string)
		check func(t *testing.T, results []map[string]any, err error)
	}{
		{
			name: "returns matching resources from two GVRs — cluster-wide search",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "webapps", Kind: "WebApp", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				disc.resources["apps/v1"] = &metav1.APIResourceList{
					GroupVersion: "apps/v1",
					APIResources: []metav1.APIResource{
						{Name: "deployments", Kind: "Deployment", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}

				dyn := newStubDynamic()
				selector := "kro.run/instance-name=my-app"
				// webapp resource in the kro GVR — uses per-instance namespace (fix #146)
				webappGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "webapps"}
				dyn.resources[webappGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						// Empty string = cluster-wide (all-namespace) lookup
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								selector: {
									{Object: map[string]any{"kind": "WebApp", "metadata": map[string]any{"name": "my-app"}}},
								},
							},
						},
					},
				}
				// deployment resource in apps/v1
				deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
				dyn.resources[deployGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								selector: {
									{Object: map[string]any{"kind": "Deployment", "metadata": map[string]any{"name": "my-app-deploy"}}},
								},
							},
						},
					},
				}

				return &stubK8sClients{dyn: dyn, disc: disc}, "my-app"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Len(t, results, 2)
			},
		},
		{
			name: "returns empty slice when no resources match label",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["apps/v1"] = &metav1.APIResourceList{
					GroupVersion: "apps/v1",
					APIResources: []metav1.APIResource{
						{Name: "deployments", Kind: "Deployment", Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				dyn := newStubDynamic()
				// No label match set up — list returns empty
				return &stubK8sClients{dyn: dyn, disc: disc}, "no-match"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Empty(t, results)
			},
		},
		{
			name: "returns error when discovery fails",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.err = fmt.Errorf("discovery unavailable")
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "my-app"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "discovery")
			},
		},
		{
			name: "skips subresources",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["apps/v1"] = &metav1.APIResourceList{
					GroupVersion: "apps/v1",
					APIResources: []metav1.APIResource{
						{Name: "deployments", Kind: "Deployment", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
						{Name: "deployments/status", Kind: "Deployment", Namespaced: true, Verbs: metav1.Verbs{"get"}}, // subresource
					},
				}
				return &stubK8sClients{dyn: newStubDynamic(), disc: disc}, "my-app"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				// No panic, no error — subresource is skipped
				require.NoError(t, err)
			},
		},
		{
			name: "returns cluster-scoped resources via direct List() — not .Namespace().List()",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						// Namespaced: false = cluster-scoped (e.g. Namespace resource). Issue #202.
						{Name: "namespaces", Kind: "Namespace", Namespaced: false, Verbs: metav1.Verbs{"list", "get"}},
					},
				}

				dyn := newStubDynamic()
				selector := "kro.run/instance-name=my-app"
				nsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}
				// Cluster-scoped: items are on the top-level stub, not in nsResources[""].
				dyn.resources[nsGVR] = &stubNamespaceableResource{
					labelItems: map[string][]unstructured.Unstructured{
						selector: {
							{Object: map[string]any{"kind": "Namespace", "metadata": map[string]any{"name": "kro-ui-test"}}},
						},
					},
				}

				return &stubK8sClients{dyn: dyn, disc: disc}, "my-app"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Len(t, results, 1)
				assert.Equal(t, "Namespace", results[0]["kind"])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, instanceName := tt.build(t)
			results, err := ListChildResources(context.Background(), clients, instanceName)
			tt.check(t, results, err)
		})
	}
}

// makeRGDObject builds a minimal RGD unstructured object for testing.
func makeRGDObject(name string, resources []map[string]any) *unstructured.Unstructured {
	resList := make([]any, len(resources))
	for i, r := range resources {
		resList[i] = r
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "kro.run/v1alpha1",
		"kind":       "ResourceGraphDefinition",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"schema": map[string]any{
				"kind": "WebApp", "apiVersion": "v1alpha1", "group": "e2e.kro-ui.dev",
			},
			"resources": resList,
		},
	}}
}

func TestRGDResourceGVRs(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, map[string]any)
		check func(t *testing.T, entries []gvrEntry)
	}{
		{
			name: "extracts GVR for a single namespaced resource",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{
								"id":       "cfg",
								"template": map[string]any{"apiVersion": "v1", "kind": "ConfigMap"},
							},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				require.Len(t, entries, 1)
				assert.Equal(t, "configmaps", entries[0].gvr.Resource)
				assert.Equal(t, "v1", entries[0].gvr.Version)
				assert.Equal(t, "", entries[0].gvr.Group)
				assert.True(t, entries[0].namespaced)
			},
		},
		{
			name: "deduplicates same GVR when two resources share the same kind",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{"id": "cfg1", "template": map[string]any{"apiVersion": "v1", "kind": "ConfigMap"}},
							map[string]any{"id": "cfg2", "template": map[string]any{"apiVersion": "v1", "kind": "ConfigMap"}},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				assert.Len(t, entries, 1)
			},
		},
		{
			name: "marks cluster-scoped resource as namespaced=false",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "namespaces", Kind: "Namespace", Namespaced: false, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{"id": "ns", "template": map[string]any{"apiVersion": "v1", "kind": "Namespace"}},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				require.Len(t, entries, 1)
				assert.False(t, entries[0].namespaced)
			},
		},
		{
			name: "skips resources with empty apiVersion or kind",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: newStubDiscovery()}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{"id": "bad1", "template": map[string]any{"apiVersion": "", "kind": "ConfigMap"}},
							map[string]any{"id": "bad2", "template": map[string]any{"apiVersion": "v1", "kind": ""}},
							map[string]any{"id": "bad3", "template": map[string]any{}},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				assert.Empty(t, entries)
			},
		},
		{
			// ParseGroupVersion returns an error for malformed apiVersions like
			// "invalid///version". This path is hit when an RGD template has a
			// syntactically bad apiVersion field; the resource must be skipped.
			name: "skips resource with invalid apiVersion format",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: newStubDiscovery()}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{
								"id": "bad",
								"template": map[string]any{
									"apiVersion": "not/a/valid/gv", // three slashes — ParseGroupVersion errors
									"kind":       "Foo",
								},
							},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				assert.Empty(t, entries)
			},
		},
		{
			// When DiscoverPlural fails (CRD not yet registered or unknown kind),
			// rgdResourceGVRs must fall back to naive plural ("<kind>s") and still
			// return an entry so the fan-out can attempt the List call.
			name: "falls back to naive plural when DiscoverPlural fails",
			build: func(t *testing.T) (K8sClients, map[string]any) {
				t.Helper()
				// Empty discovery — DiscoverPlural will find nothing and error.
				clients := &stubK8sClients{dyn: newStubDynamic(), disc: newStubDiscovery()}
				rgd := map[string]any{
					"spec": map[string]any{
						"resources": []any{
							map[string]any{
								"id": "game",
								"template": map[string]any{
									"apiVersion": "game.k8s.example/v1alpha1",
									"kind":       "Monster",
								},
							},
						},
					},
				}
				return clients, rgd
			},
			check: func(t *testing.T, entries []gvrEntry) {
				t.Helper()
				// Entry present with naive plural "monsters", namespaced=true (safe default).
				require.Len(t, entries, 1)
				assert.Equal(t, "monsters", entries[0].gvr.Resource)
				assert.Equal(t, "game.k8s.example", entries[0].gvr.Group)
				assert.Equal(t, "v1alpha1", entries[0].gvr.Version)
				assert.True(t, entries[0].namespaced, "unknown resources default to namespaced=true")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, rgd := tt.build(t)
			entries := rgdResourceGVRs(context.Background(), clients, rgd)
			tt.check(t, entries)
		})
	}
}

func TestListChildResourcesForRGD(t *testing.T) {
	rgdGVR := schema.GroupVersionResource{Group: "kro.run", Version: "v1alpha1", Resource: "resourcegraphdefinitions"}
	cmGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}
	nsGVR := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}
	selector := "kro.run/instance-name=my-inst"

	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string, string)
		check func(t *testing.T, results []map[string]any, err error)
	}{
		{
			name: "RGD-scoped: only fans out to resource types declared in the RGD",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
						{Name: "namespaces", Kind: "Namespace", Namespaced: false, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{
						"test-rgd": makeRGDObject("test-rgd", []map[string]any{
							{"id": "cfg", "template": map[string]any{"apiVersion": "v1", "kind": "ConfigMap"}},
						}),
					},
				}
				dyn.resources[cmGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								selector: {
									{Object: map[string]any{"kind": "ConfigMap", "metadata": map[string]any{"name": "my-cfg"}}},
								},
							},
						},
					},
				}
				// Namespace stub — should NOT be queried (not in RGD spec)
				dyn.resources[nsGVR] = &stubNamespaceableResource{
					labelItems: map[string][]unstructured.Unstructured{
						selector: {
							{Object: map[string]any{"kind": "Namespace", "metadata": map[string]any{"name": "should-not-appear"}}},
						},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "my-inst", "test-rgd"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				require.Len(t, results, 1)
				assert.Equal(t, "ConfigMap", results[0]["kind"])
			},
		},
		{
			name: "falls back to full discovery when RGD fetch fails",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{getErr: fmt.Errorf("not found")}
				dyn.resources[cmGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								selector: {
									{Object: map[string]any{"kind": "ConfigMap", "metadata": map[string]any{"name": "fallback-cm"}}},
								},
							},
						},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "my-inst", "missing-rgd"
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				require.Len(t, results, 1)
				assert.Equal(t, "ConfigMap", results[0]["kind"])
			},
		},
		{
			name: "falls back to full discovery when rgdName is empty",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				disc.resources["v1"] = &metav1.APIResourceList{
					GroupVersion: "v1",
					APIResources: []metav1.APIResource{
						{Name: "configmaps", Kind: "ConfigMap", Namespaced: true, Verbs: metav1.Verbs{"list", "get"}},
					},
				}
				dyn := newStubDynamic()
				dyn.resources[cmGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"": {
							labelItems: map[string][]unstructured.Unstructured{
								selector: {
									{Object: map[string]any{"kind": "ConfigMap", "metadata": map[string]any{"name": "empty-rgd-cm"}}},
								},
							},
						},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "my-inst", ""
			},
			check: func(t *testing.T, results []map[string]any, err error) {
				t.Helper()
				require.NoError(t, err)
				require.Len(t, results, 1)
				assert.Equal(t, "ConfigMap", results[0]["kind"])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, instanceName, rgdName := tt.build(t)
			results, err := ListChildResourcesForRGD(context.Background(), clients, instanceName, rgdName)
			tt.check(t, results, err)
		})
	}
}

// ── ResolveInstanceGVR tests ──────────────────────────────────────────────────

func TestResolveInstanceGVR(t *testing.T) {
	ctx := context.Background()

	rgdGVR := schema.GroupVersionResource{Group: KroGroup, Version: "v1alpha1", Resource: RGDResource}

	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string)
		check func(t *testing.T, gvr schema.GroupVersionResource, err error)
	}{
		{
			name: "empty rgdName returns error",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				return &stubK8sClients{dyn: newStubDynamic(), disc: newStubDiscovery()}, ""
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "rgd query param required")
			},
		},
		{
			name: "RGD not found returns error",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getErr: fmt.Errorf("not found"),
				}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "my-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "my-rgd")
			},
		},
		{
			name: "RGD with no schema.kind returns error",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				rgd := &unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "my-rgd"},
					"spec": map[string]any{
						"schema": map[string]any{
							// no "kind" field
							"apiVersion": "v1alpha1",
						},
					},
				}}
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"my-rgd": rgd},
				}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "my-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "schema kind")
			},
		},
		{
			name: "RGD with kind discovered via CachedServerGroupsAndResources",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				rgd := &unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "webapp-rgd"},
					"spec": map[string]any{
						"schema": map[string]any{
							"kind":       "WebApp",
							"group":      "kro.run",
							"apiVersion": "v1alpha1",
						},
					},
				}}
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"webapp-rgd": rgd},
				}
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "webapps", Kind: "WebApp"},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "webapp-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, "kro.run", gvr.Group)
				assert.Equal(t, "v1alpha1", gvr.Version)
				assert.Equal(t, "webapps", gvr.Resource)
			},
		},
		{
			name: "RGD with default group (KroGroup) when group is empty",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				rgd := &unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "my-rgd"},
					"spec": map[string]any{
						"schema": map[string]any{
							"kind": "MyKind",
							// group is empty — defaults to KroGroup
						},
					},
				}}
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"my-rgd": rgd},
				}
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "mykinds", Kind: "MyKind"},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "my-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, KroGroup, gvr.Group, "empty group should default to KroGroup")
				assert.Equal(t, "mykinds", gvr.Resource)
			},
		},
		{
			name: "RGD with default version (v1alpha1) when apiVersion is empty",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				rgd := &unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "my-rgd"},
					"spec": map[string]any{
						"schema": map[string]any{
							"kind":  "MyKind",
							"group": "kro.run",
							// apiVersion is empty — defaults to v1alpha1
						},
					},
				}}
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"my-rgd": rgd},
				}
				disc := newStubDiscovery()
				disc.resources["kro.run/v1alpha1"] = &metav1.APIResourceList{
					GroupVersion: "kro.run/v1alpha1",
					APIResources: []metav1.APIResource{
						{Name: "mykinds", Kind: "MyKind"},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: disc}, "my-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Equal(t, "v1alpha1", gvr.Version, "empty apiVersion should default to v1alpha1")
			},
		},
		{
			name: "DiscoverPlural failure falls back to naive plural",
			build: func(t *testing.T) (K8sClients, string) {
				t.Helper()
				dyn := newStubDynamic()
				rgd := &unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "widget-rgd"},
					"spec": map[string]any{
						"schema": map[string]any{
							"kind":  "Widget",
							"group": "widgets.example.com",
						},
					},
				}}
				dyn.resources[rgdGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"widget-rgd": rgd},
				}
				// No discovery resources registered — DiscoverPlural will fail
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "widget-rgd"
			},
			check: func(t *testing.T, gvr schema.GroupVersionResource, err error) {
				t.Helper()
				require.NoError(t, err, "DiscoverPlural failure must not propagate — naive plural used")
				assert.Equal(t, "widgets", gvr.Resource, "naive plural fallback: Widget → widgets")
				assert.Equal(t, "widgets.example.com", gvr.Group)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, rgdName := tt.build(t)
			gvr, err := ResolveInstanceGVR(ctx, clients, rgdName)
			tt.check(t, gvr, err)
		})
	}
}

// ── DiscoverPlural edge cases ─────────────────────────────────────────────────

// TestDiscoverPlural_CacheHit verifies that DiscoverPlural uses cached results
// when the GroupVersion is present in the cache.
func TestDiscoverPlural_CacheHit(t *testing.T) {
	disc := newStubDiscovery()
	disc.resources["apps/v1"] = &metav1.APIResourceList{
		GroupVersion: "apps/v1",
		APIResources: []metav1.APIResource{
			{Name: "deployments", Kind: "Deployment"},
		},
	}
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
	plural, err := DiscoverPlural(clients, "apps", "v1", "Deployment")
	require.NoError(t, err)
	assert.Equal(t, "deployments", plural)
}

// TestDiscoverPlural_CacheMissFallsBackToDirectLookup verifies that when the
// GroupVersion is absent from the cache, a targeted ServerResourcesForGroupVersion
// call is made and succeeds.
func TestDiscoverPlural_CacheMissFallsBackToDirectLookup(t *testing.T) {
	disc := newStubDiscovery()
	// Cache has no "widgets.example.com/v1" entry, but direct lookup will succeed.
	disc.resources["widgets.example.com/v1"] = &metav1.APIResourceList{
		GroupVersion: "widgets.example.com/v1",
		APIResources: []metav1.APIResource{
			{Name: "widgets", Kind: "Widget"},
		},
	}
	// CachedServerGroupsAndResources returns empty (cache miss simulation)
	// by having no matching GV in the cache but the direct call succeeds.
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
	plural, err := DiscoverPlural(clients, "widgets.example.com", "v1", "Widget")
	require.NoError(t, err)
	assert.Equal(t, "widgets", plural)
}

// TestDiscoverPlural_DirectLookupFails verifies that when both cache and direct
// lookup fail, an error is returned.
func TestDiscoverPlural_DirectLookupFails(t *testing.T) {
	disc := newStubDiscovery()
	// No resources registered — both cache and direct lookup fail.
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
	_, err := DiscoverPlural(clients, "unknown.group", "v1", "Unknown")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "discovery for")
}

// TestDiscoverPlural_KindNotFoundInGroupVersion verifies that when the GV is
// discoverable but the kind is absent, an error is returned.
func TestDiscoverPlural_KindNotFoundInGroupVersion(t *testing.T) {
	disc := newStubDiscovery()
	disc.resources["apps/v1"] = &metav1.APIResourceList{
		GroupVersion: "apps/v1",
		APIResources: []metav1.APIResource{
			{Name: "deployments", Kind: "Deployment"},
		},
	}
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
	_, err := DiscoverPlural(clients, "apps", "v1", "StatefulSet")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// TestDiscoverPlural_CoreGroup verifies that core group (empty group string)
// is handled correctly — the gv string should be just the version ("v1").
func TestDiscoverPlural_CoreGroup(t *testing.T) {
	disc := newStubDiscovery()
	disc.resources["v1"] = &metav1.APIResourceList{
		GroupVersion: "v1",
		APIResources: []metav1.APIResource{
			{Name: "configmaps", Kind: "ConfigMap"},
		},
	}
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: disc}
	plural, err := DiscoverPlural(clients, "", "v1", "ConfigMap")
	require.NoError(t, err)
	assert.Equal(t, "configmaps", plural)
}
