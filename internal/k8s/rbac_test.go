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

// TestResolveKroServiceAccount validates that kro's service account is resolved
// from the cluster's Deployments, and returns empty strings when none is found.
func TestResolveKroServiceAccount(t *testing.T) {
	deployGVR := schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
	ctx := context.Background()

	tests := []struct {
		name  string
		build func(t *testing.T) K8sClients
		check func(t *testing.T, ns, name string, found bool)
	}{
		{
			name: "no deployments found returns empty strings and found=false",
			build: func(t *testing.T) K8sClients {
				t.Helper()
				// No deployments registered — stub returns list error for unregistered GVRs.
				dyn := newStubDynamic()
				_ = deployGVR // acknowledged but not registered
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}
			},
			check: func(t *testing.T, ns, name string, found bool) {
				t.Helper()
				assert.Equal(t, "", ns, "namespace must be empty when no deployment found")
				assert.Equal(t, "", name, "SA name must be empty when no deployment found")
				assert.False(t, found, "found must be false when no deployment found")
			},
		},
		{
			name: "deployment with serviceAccountName in kro-system is resolved",
			build: func(t *testing.T) K8sClients {
				t.Helper()
				dyn := newStubDynamic()
				deploy := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-controller-manager"},
					"spec": map[string]any{
						"template": map[string]any{
							"spec": map[string]any{
								"serviceAccountName": "kro-controller",
							},
						},
					},
				}}
				dyn.resources[deployGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-system": {items: []unstructured.Unstructured{deploy}},
						"kro":        {items: []unstructured.Unstructured{}},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}
			},
			check: func(t *testing.T, ns, name string, found bool) {
				t.Helper()
				assert.Equal(t, "kro-system", ns)
				assert.Equal(t, "kro-controller", name)
				assert.True(t, found)
			},
		},
		{
			name: "deployment with empty serviceAccountName is skipped",
			build: func(t *testing.T) K8sClients {
				t.Helper()
				dyn := newStubDynamic()
				// Deployment named "kro" but with no serviceAccountName set
				deploy := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro"},
					"spec": map[string]any{
						"template": map[string]any{
							"spec": map[string]any{
								"serviceAccountName": "",
							},
						},
					},
				}}
				dyn.resources[deployGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-system": {items: []unstructured.Unstructured{deploy}},
						"kro":        {items: []unstructured.Unstructured{}},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}
			},
			check: func(t *testing.T, ns, name string, found bool) {
				t.Helper()
				assert.Equal(t, "", ns, "namespace must be empty when SA name is empty")
				assert.Equal(t, "", name, "SA name must be empty when serviceAccountName field is empty")
				assert.False(t, found)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients := tt.build(t)
			ns, name, found := ResolveKroServiceAccount(ctx, clients)
			tt.check(t, ns, name, found)
		})
	}
}

// ── Tests for previously uncovered functions ─────────────────────────────────
// These cover functions that had 0% statement coverage in internal/k8s/rbac.go.

// TestResolveKroClusterRole verifies that the first ClusterRole bound to a given
// service account via ClusterRoleBinding is returned, or "" if none is found.
func TestResolveKroClusterRole(t *testing.T) {
	ctx := context.Background()
	crbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterrolebindings"}

	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string, string)
		check func(t *testing.T, clusterRole string)
	}{
		{
			name: "CRB matches SA returns ClusterRole name",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-binding"},
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
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, clusterRole string) {
				t.Helper()
				assert.Equal(t, "kro-manager", clusterRole)
			},
		},
		{
			name: "no CRB returns empty string",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, clusterRole string) {
				t.Helper()
				assert.Equal(t, "", clusterRole)
			},
		},
		{
			name: "CRB with non-ClusterRole roleRef is skipped",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-binding"},
					"subjects": []any{
						map[string]any{
							"kind":      "ServiceAccount",
							"name":      "kro",
							"namespace": "kro-system",
						},
					},
					"roleRef": map[string]any{
						"kind": "Role",
						"name": "kro-role",
					},
				}}
				dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{crb}}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, clusterRole string) {
				t.Helper()
				assert.Equal(t, "", clusterRole, "Role (not ClusterRole) roleRef must be skipped")
			},
		},
		{
			name: "SA namespace mismatch returns empty string",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				crb := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-binding"},
					"subjects": []any{
						map[string]any{
							"kind":      "ServiceAccount",
							"name":      "kro",
							"namespace": "other-namespace",
						},
					},
					"roleRef": map[string]any{
						"kind": "ClusterRole",
						"name": "kro-manager",
					},
				}}
				dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{crb}}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, clusterRole string) {
				t.Helper()
				assert.Equal(t, "", clusterRole, "SA with different namespace must not match")
			},
		},
		{
			name: "list error returns empty string gracefully",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro"
			},
			check: func(t *testing.T, clusterRole string) {
				t.Helper()
				assert.Equal(t, "", clusterRole, "list error must return empty string not panic")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, saNS, saName := tt.build(t)
			role := ResolveKroClusterRole(ctx, clients, saNS, saName)
			tt.check(t, role)
		})
	}
}

// TestSplitAPIVersion verifies that splitAPIVersion correctly splits group/version
// strings and handles core resources (version without group prefix).
func TestSplitAPIVersion(t *testing.T) {
	tests := []struct {
		name       string
		apiVersion string
		wantGroup  string
		wantVer    string
	}{
		{name: "group/version splits correctly", apiVersion: "apps/v1", wantGroup: "apps", wantVer: "v1"},
		{name: "core resource has empty group", apiVersion: "v1", wantGroup: "", wantVer: "v1"},
		{name: "custom group/version", apiVersion: "networking.k8s.io/v1", wantGroup: "networking.k8s.io", wantVer: "v1"},
		{name: "empty string", apiVersion: "", wantGroup: "", wantVer: ""},
		{name: "kro API group", apiVersion: "kro.run/v1alpha1", wantGroup: "kro.run", wantVer: "v1alpha1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			group, version := splitAPIVersion(tt.apiVersion)
			assert.Equal(t, tt.wantGroup, group, "group mismatch for %q", tt.apiVersion)
			assert.Equal(t, tt.wantVer, version, "version mismatch for %q", tt.apiVersion)
		})
	}
}

// TestComputeAccessResult_EmptySA verifies that ComputeAccessResult short-circuits
// when saNS is empty, returning an empty result without making cluster calls.
func TestComputeAccessResult_EmptySA(t *testing.T) {
	ctx := context.Background()
	clients := &stubK8sClients{dyn: newStubDynamic(), disc: newStubDiscovery()}
	rgdObj := map[string]any{
		"spec": map[string]any{
			"resources": []any{},
		},
	}

	result, err := ComputeAccessResult(ctx, clients, rgdObj, "", "kro", false)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "", result.ServiceAccount)
	assert.False(t, result.ServiceAccountFound)
	assert.False(t, result.HasGaps)
	assert.Empty(t, result.Permissions)
}

// TestComputeAccessResult_WithPermissions verifies the full permission matrix
// is computed when SA is resolved and the RGD has known resources.
func TestComputeAccessResult_WithPermissions(t *testing.T) {
	ctx := context.Background()

	crbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterrolebindings"}
	crGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "clusterroles"}
	rbGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "rolebindings"}

	dyn := newStubDynamic()
	dyn.resources[crbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}
	dyn.resources[rbGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}
	dyn.resources[crGVR] = &stubNamespaceableResource{items: []unstructured.Unstructured{}}

	disc := newStubDiscovery()
	disc.resources["apps/v1"] = &metav1.APIResourceList{
		GroupVersion: "apps/v1",
		APIResources: []metav1.APIResource{
			{Name: "deployments", Kind: "Deployment", Namespaced: true},
		},
	}

	clients := &stubK8sClients{dyn: dyn, disc: disc}

	rgdObj := map[string]any{
		"spec": map[string]any{
			"resources": []any{
				map[string]any{
					"id": "my-deployment",
					"template": map[string]any{
						"apiVersion": "apps/v1",
						"kind":       "Deployment",
					},
				},
			},
		},
	}

	result, err := ComputeAccessResult(ctx, clients, rgdObj, "kro-system", "kro", true)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "kro-system/kro", result.ServiceAccount)
	assert.True(t, result.ServiceAccountFound)
	assert.True(t, result.HasGaps, "no RBAC rules means permission gaps exist")
	assert.Len(t, result.Permissions, 1)
	assert.Equal(t, "deployments", result.Permissions[0].Resource)
}

// TestFetchRoleRules verifies that namespace-scoped Role rules are fetched correctly.
func TestFetchRoleRules(t *testing.T) {
	ctx := context.Background()
	roleGVR := schema.GroupVersionResource{Group: rbacGroup, Version: "v1", Resource: "roles"}

	tests := []struct {
		name  string
		build func(t *testing.T) (K8sClients, string, string)
		check func(t *testing.T, rules []policyRule, err error)
	}{
		{
			name: "Role in namespace returns its rules",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				role := unstructured.Unstructured{Object: map[string]any{
					"metadata": map[string]any{"name": "kro-role", "namespace": "kro-system"},
					"rules": []any{
						map[string]any{
							"apiGroups": []any{""},
							"resources": []any{"configmaps"},
							"verbs":     []any{"get", "list"},
						},
					},
				}}
				dyn.resources[roleGVR] = &stubNamespaceableResource{
					nsResources: map[string]*stubResourceClient{
						"kro-system": {getItems: map[string]*unstructured.Unstructured{"kro-role": &role}},
					},
				}
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "kro-role"
			},
			check: func(t *testing.T, rules []policyRule, err error) {
				t.Helper()
				require.NoError(t, err)
				require.Len(t, rules, 1)
				assert.Equal(t, []string{""}, rules[0].APIGroups)
				assert.Equal(t, []string{"configmaps"}, rules[0].Resources)
				assert.Equal(t, []string{"get", "list"}, rules[0].Verbs)
			},
		},
		{
			name: "Role not found returns error",
			build: func(t *testing.T) (K8sClients, string, string) {
				t.Helper()
				dyn := newStubDynamic()
				return &stubK8sClients{dyn: dyn, disc: newStubDiscovery()}, "kro-system", "nonexistent"
			},
			check: func(t *testing.T, rules []policyRule, err error) {
				t.Helper()
				require.Error(t, err, "missing Role must return error")
				assert.Nil(t, rules)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clients, ns, name := tt.build(t)
			rules, err := fetchRoleRules(ctx, clients, ns, name)
			tt.check(t, rules, err)
		})
	}
}
