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

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
)

// TestCheckPermissions validates the verb-level permission check against RBAC rules.
func TestCheckPermissions(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) ([]policyRule, string, string, []string)
		check func(t *testing.T, granted map[string]bool)
	}{
		{
			name: "exact match grants all listed verbs",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{"apps"},
						Resources: []string{"deployments"},
						Verbs:     []string{"get", "list", "watch", "create", "update", "patch", "delete"},
					},
				}
				return rules, "apps", "deployments", ManagedVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				for _, v := range ManagedVerbs {
					assert.True(t, granted[v], "expected verb %q to be granted", v)
				}
			},
		},
		{
			name: "wildcard apiGroup grants all groups",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{"*"},
						Resources: []string{"iamroles"},
						Verbs:     []string{"get", "list", "watch"},
					},
				}
				return rules, "iam.amazonaws.com", "iamroles", ReadOnlyVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				for _, v := range ReadOnlyVerbs {
					assert.True(t, granted[v], "expected verb %q to be granted via wildcard apiGroup", v)
				}
			},
		},
		{
			name: "wildcard verb grants all verbs",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{""},
						Resources: []string{"configmaps"},
						Verbs:     []string{"*"},
					},
				}
				return rules, "", "configmaps", ManagedVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				for _, v := range ManagedVerbs {
					assert.True(t, granted[v], "expected verb %q to be granted via wildcard verb", v)
				}
			},
		},
		{
			name: "wildcard resource grants matching verbs",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{"apps"},
						Resources: []string{"*"},
						Verbs:     []string{"get", "list"},
					},
				}
				return rules, "apps", "deployments", []string{"get", "list", "watch"}
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				assert.True(t, granted["get"])
				assert.True(t, granted["list"])
				assert.False(t, granted["watch"], "watch not in rule — should not be granted")
			},
		},
		{
			name: "no matching binding returns all false",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{"apps"},
						Resources: []string{"deployments"},
						Verbs:     []string{"get", "list"},
					},
				}
				// Querying for a completely different resource
				return rules, "networking.k8s.io", "ingresses", ManagedVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				for _, v := range ManagedVerbs {
					assert.False(t, granted[v], "expected verb %q to be denied — no matching rule", v)
				}
			},
		},
		{
			name: "partial verbs returns mixed granted map",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				rules := []policyRule{
					{
						APIGroups: []string{""},
						Resources: []string{"configmaps"},
						Verbs:     []string{"get", "list", "watch"},
					},
				}
				return rules, "", "configmaps", ManagedVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				assert.True(t, granted["get"])
				assert.True(t, granted["list"])
				assert.True(t, granted["watch"])
				assert.False(t, granted["create"])
				assert.False(t, granted["update"])
				assert.False(t, granted["patch"])
				assert.False(t, granted["delete"])
			},
		},
		{
			name: "empty rules returns all false",
			build: func(t *testing.T) ([]policyRule, string, string, []string) {
				t.Helper()
				return nil, "apps", "deployments", ManagedVerbs
			},
			check: func(t *testing.T, granted map[string]bool) {
				t.Helper()
				for _, v := range ManagedVerbs {
					assert.False(t, granted[v])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rules, group, resource, required := tt.build(t)
			granted := CheckPermissions(rules, group, resource, required)
			tt.check(t, granted)
		})
	}
}

// TestFetchEffectiveRules validates that bindings for the given SA are resolved correctly.
func TestFetchEffectiveRules(t *testing.T) {
	ctx := context.Background()

	crbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterrolebindings"}
	crGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterroles"}
	rbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "rolebindings"}

	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string, string)
		check func(t *testing.T, rules []policyRule, err error)
	}{
		{
			name: "ClusterRoleBinding for SA grants ClusterRole rules",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()

				// ClusterRoleBinding that binds kro SA to kro-manager ClusterRole
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-manager-binding"},
					"subjects": []any{
						map[string]any{
							"kind":      "ServiceAccount",
							"name":      "kro",
							"namespace": "kro-system",
						},
					},
					"roleRef": map[string]any{
						"kind": "ClusterRole",
						"name": "kro-manager",
					},
				}}
				dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{crb}}

				// ClusterRole with rules
				cr := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-manager"},
					"rules": []any{
						map[string]any{
							"apiGroups": []any{"apps"},
							"resources": []any{"deployments"},
							"verbs":     []any{"get", "list", "watch", "create", "update", "patch", "delete"},
						},
					},
				}}
				dyn.resources[crGVR] = &stubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{"kro-manager": &cr},
				}
				// No RoleBindings
				dyn.resources[rbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}

				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, rules []policyRule, err error) {
				t.Helper()
				require.NoError(t, err)
				require.Len(t, rules, 1)
				assert.Equal(t, []string{"apps"}, rules[0].APIGroups)
				assert.Equal(t, []string{"deployments"}, rules[0].Resources)
				assert.Contains(t, rules[0].Verbs, "create")
			},
		},
		{
			name: "SA not in any binding returns empty rules",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()

				// CRB for a different SA
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "other-binding"},
					"subjects": []any{
						map[string]any{
							"kind":      "ServiceAccount",
							"name":      "other-sa",
							"namespace": "default",
						},
					},
					"roleRef": map[string]any{
						"kind": "ClusterRole",
						"name": "some-role",
					},
				}}
				dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{crb}}
				dyn.resources[rbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}

				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, rules []policyRule, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Empty(t, rules)
			},
		},
		{
			name: "aggregated ClusterRole includes aggregated rules",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()

				// CRB referencing an aggregated ClusterRole
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-aggregated-binding"},
					"subjects": []any{
						map[string]any{
							"kind":      "ServiceAccount",
							"name":      "kro",
							"namespace": "kro-system",
						},
					},
					"roleRef": map[string]any{
						"kind": "ClusterRole",
						"name": "kro-aggregate",
					},
				}}

				// Aggregated ClusterRole (no direct rules, uses aggregationRule)
				aggregatedCR := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-aggregate"},
					"rules":    []any{},
					"aggregationRule": map[string]any{
						"clusterRoleSelectors": []any{
							map[string]any{
								"matchLabels": map[string]any{
									"rbac.kro.run/aggregate-to-kro": "true",
								},
							},
						},
					},
				}}

				// The sub-role that matches the label selector
				subCR := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{
						"name": "kro-configmap-access",
						"labels": map[string]any{
							"rbac.kro.run/aggregate-to-kro": "true",
						},
					},
					"rules": []any{
						map[string]any{
							"apiGroups": []any{""},
							"resources": []any{"configmaps"},
							"verbs":     []any{"get", "list", "watch"},
						},
					},
				}}

				labelSel := "rbac.kro.run/aggregate-to-kro=true"

				// Use a dynamic stub that stores NamespaceableResourceInterface values
				dynIface := newStubDynamicIface()
				dynIface.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{crb}}
				dynIface.resources[crGVR] = &stubNamespaceableResourceWithLabelSel{
					getItems: map[string]*unstructured.Unstructured{
						"kro-aggregate": &aggregatedCR,
					},
					labelItems: map[string][]unstructured.Unstructured{
						labelSel: {subCR},
					},
				}
				dynIface.resources[rbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}

				return &stubK8sClientsIface{dyn: dynIface, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, rules []policyRule, err error) {
				t.Helper()
				require.NoError(t, err)
				require.NotEmpty(t, rules, "expected rules from aggregated ClusterRole")
				found := false
				for _, r := range rules {
					for _, res := range r.Resources {
						if res == "configmaps" {
							found = true
						}
					}
				}
				assert.True(t, found, "expected aggregated configmaps rule to be present")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, saNS, saName := tt.build(t)
			rules, err := FetchEffectiveRules(ctx, clients, saNS, saName)
			tt.check(t, rules, err)
		})
	}
}

// stubNamespaceableResourceWithLabelSel supports label-selector filtering for List
// and name-based Get, without namespace support.
type stubNamespaceableResourceWithLabelSel struct {
	getItems   map[string]*unstructured.Unstructured
	labelItems map[string][]unstructured.Unstructured
	allItems   []unstructured.Unstructured
}

func (s *stubNamespaceableResourceWithLabelSel) Namespace(_ string) dynamic.ResourceInterface {
	return &stubResourceClient{items: s.allItems}
}

func (s *stubNamespaceableResourceWithLabelSel) List(_ context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if opts.LabelSelector != "" && s.labelItems != nil {
		if items, ok := s.labelItems[opts.LabelSelector]; ok {
			return &unstructured.UnstructuredList{Items: items}, nil
		}
		return &unstructured.UnstructuredList{}, nil
	}
	return &unstructured.UnstructuredList{Items: s.allItems}, nil
}

func (s *stubNamespaceableResourceWithLabelSel) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	if obj, ok := s.getItems[name]; ok {
		return obj, nil
	}
	return nil, fmt.Errorf("not found: %s", name)
}

func (s *stubNamespaceableResourceWithLabelSel) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *stubNamespaceableResourceWithLabelSel) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// stubDynamicIface is a variant of stubDynamic that stores NamespaceableResourceInterface values
// (allowing different concrete types like stubNamespaceableResourceWithLabelSel).
type stubDynamicIface struct {
	resources map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface
}

func newStubDynamicIface() *stubDynamicIface {
	return &stubDynamicIface{resources: make(map[schema.GroupVersionResource]dynamic.NamespaceableResourceInterface)}
}

func (s *stubDynamicIface) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	if r, ok := s.resources[gvr]; ok {
		return r
	}
	return &stubNamespaceableResource{
		listErr: fmt.Errorf("resource %v not found", gvr),
		getErr:  fmt.Errorf("resource %v not found", gvr),
	}
}

// stubK8sClientsIface is a K8sClients implementation backed by stubDynamicIface.
type stubK8sClientsIface struct {
	dyn  *stubDynamicIface
	disc *stubDiscovery
}

func (s *stubK8sClientsIface) Dynamic() dynamic.Interface              { return s.dyn }
func (s *stubK8sClientsIface) Discovery() discovery.DiscoveryInterface { return s.disc }
func (s *stubK8sClientsIface) CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error) {
	_, lists, err := s.disc.ServerGroupsAndResources()
	return lists, err
}
