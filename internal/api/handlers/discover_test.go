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
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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
			val, ok, err := unstructuredString(obj, path...)
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
			result := isListable(res)
			tt.check(t, result)
		})
	}
}

func TestDiscoverPlural(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (k8sClients, string, string, string)
		check func(t *testing.T, plural string, err error)
	}{
		{
			name: "discovers correct plural from discovery API",
			build: func(t *testing.T) (k8sClients, string, string, string) {
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
			build: func(t *testing.T) (k8sClients, string, string, string) {
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
			build: func(t *testing.T) (k8sClients, string, string, string) {
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
			build: func(t *testing.T) (k8sClients, string, string, string) {
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
			build: func(t *testing.T) (k8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				// For core API group, the group version is just "v1" (no slash prefix).
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
			build: func(t *testing.T) (k8sClients, string, string, string) {
				t.Helper()
				disc := newStubDiscovery()
				// No resources registered.
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
			factory, group, version, kind := tt.build(t)
			plural, err := discoverPlural(factory, group, version, kind)
			tt.check(t, plural, err)
		})
	}
}
