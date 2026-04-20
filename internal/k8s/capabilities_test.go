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
	"k8s.io/apimachinery/pkg/version"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/openapi"
	restclient "k8s.io/client-go/rest"

	openapi_v2 "github.com/google/gnostic-models/openapiv2"
)

// --- Test stubs for capabilities detection ---

// capStubDynamic routes Resource() calls to per-GVR stub resource instances.
type capStubDynamic struct {
	resources map[schema.GroupVersionResource]*capStubNamespaceableResource
}

func newCapStubDynamic() *capStubDynamic {
	return &capStubDynamic{resources: make(map[schema.GroupVersionResource]*capStubNamespaceableResource)}
}

func (s *capStubDynamic) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	if r, ok := s.resources[gvr]; ok {
		return r
	}
	return &capStubNamespaceableResource{getErr: fmt.Errorf("resource %v not found", gvr)}
}

// capStubNamespaceableResource implements dynamic.NamespaceableResourceInterface.
type capStubNamespaceableResource struct {
	getItems    map[string]*unstructured.Unstructured
	getErr      error
	nsResources map[string]*capStubResourceClient
	// listItems is returned by List() — used to simulate cluster-scoped
	// label-selector fallback for EKS add-on kro detection (GH #400).
	listItems []unstructured.Unstructured
}

func (s *capStubNamespaceableResource) Namespace(ns string) dynamic.ResourceInterface {
	if s.nsResources != nil {
		if r, ok := s.nsResources[ns]; ok {
			return r
		}
	}
	return &capStubResourceClient{getItems: s.getItems, getErr: s.getErr}
}

func (s *capStubNamespaceableResource) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
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

func (s *capStubNamespaceableResource) List(_ context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	// Return listItems when set (EKS cluster-scoped fallback test, GH #400).
	// Returns empty list by default — the fallback should produce no match
	// and fall through gracefully when no matching deployment is found.
	return &unstructured.UnstructuredList{Items: s.listItems}, nil
}
func (s *capStubNamespaceableResource) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubNamespaceableResource) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// capStubResourceClient implements dynamic.ResourceInterface for namespaced stubs.
type capStubResourceClient struct {
	getItems map[string]*unstructured.Unstructured
	getErr   error
}

func (s *capStubResourceClient) Get(_ context.Context, name string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
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

func (s *capStubResourceClient) List(context.Context, metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	panic("not used")
}
func (s *capStubResourceClient) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only stub")
}
func (s *capStubResourceClient) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only stub")
}
func (s *capStubResourceClient) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}
func (s *capStubResourceClient) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// capStubDiscovery implements discovery.DiscoveryInterface.
type capStubDiscovery struct {
	resources map[string]*metav1.APIResourceList
	err       error
}

func newCapStubDiscovery() *capStubDiscovery {
	return &capStubDiscovery{resources: make(map[string]*metav1.APIResourceList)}
}

func (s *capStubDiscovery) ServerResourcesForGroupVersion(gv string) (*metav1.APIResourceList, error) {
	if s.err != nil {
		return nil, s.err
	}
	if rl, ok := s.resources[gv]; ok {
		return rl, nil
	}
	return nil, fmt.Errorf("group version %q not found", gv)
}

func (s *capStubDiscovery) RESTClient() restclient.Interface { return nil }
func (s *capStubDiscovery) ServerGroups() (*metav1.APIGroupList, error) {
	return &metav1.APIGroupList{}, nil
}
func (s *capStubDiscovery) ServerGroupsAndResources() ([]*metav1.APIGroup, []*metav1.APIResourceList, error) {
	return nil, nil, nil
}
func (s *capStubDiscovery) ServerPreferredResources() ([]*metav1.APIResourceList, error) {
	return nil, nil
}
func (s *capStubDiscovery) ServerPreferredNamespacedResources() ([]*metav1.APIResourceList, error) {
	return nil, nil
}
func (s *capStubDiscovery) ServerVersion() (*version.Info, error) {
	return &version.Info{}, nil
}
func (s *capStubDiscovery) OpenAPISchema() (*openapi_v2.Document, error) { return nil, nil }
func (s *capStubDiscovery) OpenAPIV3() openapi.Client                    { return nil }
func (s *capStubDiscovery) WithLegacy() discovery.DiscoveryInterface     { return s }

// --- Test fixture builders ---

// makeCRDObject creates a minimal RGD CRD with configurable schema fields.
func makeCRDObject(resourceFields, schemaFields map[string]any) *unstructured.Unstructured {
	resourceItemProps := make(map[string]any)
	for k, v := range resourceFields {
		resourceItemProps[k] = v
	}

	schemaSchemaProps := make(map[string]any)
	for k, v := range schemaFields {
		schemaSchemaProps[k] = v
	}

	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
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
												"properties": resourceItemProps,
											},
										},
										"schema": map[string]any{
											"properties": schemaSchemaProps,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}}
}

// makeDeployment creates a kro controller Deployment with the given container args and image.
func makeDeployment(args []string, image string) *unstructured.Unstructured {
	containerArgs := make([]any, len(args))
	for i, a := range args {
		containerArgs[i] = a
	}

	container := map[string]any{
		"name":  "manager",
		"image": image,
	}
	if len(containerArgs) > 0 {
		container["args"] = containerArgs
	}

	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apps/v1",
		"kind":       "Deployment",
		"metadata":   map[string]any{"name": kroDeploymentNames[0], "namespace": kroNamespace},
		"spec": map[string]any{
			"template": map[string]any{
				"spec": map[string]any{
					"containers": []any{container},
				},
			},
		},
	}}
}

// --- Tests ---

func TestDetectCapabilities(t *testing.T) {
	tests := []struct {
		name  string
		build func() (dynamic.Interface, discovery.DiscoveryInterface)
		check func(t *testing.T, caps *KroCapabilities)
	}{
		{
			name: "baseline when kro not installed",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.err = fmt.Errorf("connection refused")
				return newCapStubDynamic(), disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				baseline := Baseline()
				assert.Equal(t, baseline.Version, caps.Version)
				assert.Equal(t, baseline.KnownResources, caps.KnownResources)
				assert.Equal(t, baseline.FeatureGates["CELOmitFunction"], caps.FeatureGates["CELOmitFunction"])
			},
		},
		{
			name: "detects known resources",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{
						{Name: "resourcegraphdefinitions"},
						{Name: "resourcegraphdefinitions/status"},
					},
				}
				return newCapStubDynamic(), disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.Equal(t, []string{"resourcegraphdefinitions"}, caps.KnownResources)
			},
		},
		{
			name: "detects future resource (graphrevisions)",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{
						{Name: "resourcegraphdefinitions"},
						{Name: "graphrevisions"},
					},
				}
				return newCapStubDynamic(), disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.Contains(t, caps.KnownResources, "resourcegraphdefinitions")
				assert.Contains(t, caps.KnownResources, "graphrevisions")
			},
		},
		{
			name: "schema detection — forEach present",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				crd := makeCRDObject(
					map[string]any{"forEach": map[string]any{"type": "object"}, "externalRef": map[string]any{"type": "object"}},
					map[string]any{"scope": map[string]any{"type": "string"}},
				)
				dyn.resources[crdGVR] = &capStubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{rgdCRDName: crd},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.True(t, caps.Schema.HasForEach)
				assert.True(t, caps.Schema.HasExternalRef)
				assert.True(t, caps.Schema.HasScope)
				assert.False(t, caps.Schema.HasTypes)
			},
		},
		{
			name: "schema detection — scope absent",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				crd := makeCRDObject(
					map[string]any{"forEach": map[string]any{"type": "object"}},
					map[string]any{}, // no scope, no types
				)
				dyn.resources[crdGVR] = &capStubNamespaceableResource{
					getItems: map[string]*unstructured.Unstructured{rgdCRDName: crd},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.True(t, caps.Schema.HasForEach)
				assert.False(t, caps.Schema.HasScope)
				assert.False(t, caps.Schema.HasTypes)
			},
		},
		{
			name: "feature gate parsing — enabled",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				deploy := makeDeployment(
					[]string{"--feature-gates=CELOmitFunction=true,InstanceConditionEvents=false"},
					"ghcr.io/kro/controller:v0.9.1",
				)
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					nsResources: map[string]*capStubResourceClient{
						kroNamespace: {getItems: map[string]*unstructured.Unstructured{kroDeploymentNames[0]: deploy}},
					},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.True(t, caps.FeatureGates["CELOmitFunction"])
				assert.False(t, caps.FeatureGates["InstanceConditionEvents"])
				assert.Equal(t, "v0.9.1", caps.Version)
			},
		},
		{
			name: "feature gate parsing — disabled",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				deploy := makeDeployment(
					[]string{"--feature-gates=CELOmitFunction=false"},
					"ghcr.io/kro/controller:v0.9.0",
				)
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					nsResources: map[string]*capStubResourceClient{
						kroNamespace: {getItems: map[string]*unstructured.Unstructured{kroDeploymentNames[0]: deploy}},
					},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.False(t, caps.FeatureGates["CELOmitFunction"])
			},
		},
		{
			name: "feature gate parsing — no flag",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				deploy := makeDeployment(nil, "ghcr.io/kro/controller:latest")
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					nsResources: map[string]*capStubResourceClient{
						kroNamespace: {getItems: map[string]*unstructured.Unstructured{kroDeploymentNames[0]: deploy}},
					},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				// No --feature-gates flag → baseline gates preserved.
				assert.False(t, caps.FeatureGates["CELOmitFunction"])
				assert.False(t, caps.FeatureGates["InstanceConditionEvents"])
			},
		},
		{
			name: "feature gate parsing — Deployment not found",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				// No deployment registered — the stub will error.
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				assert.False(t, caps.FeatureGates["CELOmitFunction"])
				assert.False(t, caps.FeatureGates["InstanceConditionEvents"])
			},
		},
		{
			name: "fork guard — specPatch excluded",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				deploy := makeDeployment(
					[]string{"--feature-gates=specPatch=true,CELOmitFunction=true"},
					"ghcr.io/kro/controller:v0.9.1",
				)
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					nsResources: map[string]*capStubResourceClient{
						kroNamespace: {getItems: map[string]*unstructured.Unstructured{kroDeploymentNames[0]: deploy}},
					},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				_, hasSpecPatch := caps.FeatureGates["specPatch"]
				assert.False(t, hasSpecPatch, "specPatch must never appear in capabilities")
				assert.True(t, caps.FeatureGates["CELOmitFunction"], "legitimate gates should survive")
			},
		},
		{
			name: "fork guard — stateFields excluded",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				deploy := makeDeployment(
					[]string{"--feature-gates=stateFields=true"},
					"ghcr.io/kro/controller:v0.9.1",
				)
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					nsResources: map[string]*capStubResourceClient{
						kroNamespace: {getItems: map[string]*unstructured.Unstructured{kroDeploymentNames[0]: deploy}},
					},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				_, hasStateFields := caps.FeatureGates["stateFields"]
				assert.False(t, hasStateFields, "stateFields must never appear in capabilities")
			},
		},
		// GH #400: EKS add-on kro uses a different Deployment name/namespace.
		// All direct-name Get() calls fail; version is detected via cluster-scoped
		// label-selector List() fallback.
		{
			name: "detects version via cluster-scoped label fallback (EKS add-on)",
			build: func() (dynamic.Interface, discovery.DiscoveryInterface) {
				disc := newCapStubDiscovery()
				disc.resources[kroAPIVersion] = &metav1.APIResourceList{
					APIResources: []metav1.APIResource{{Name: "resourcegraphdefinitions"}},
				}
				dyn := newCapStubDynamic()
				// EKS add-on Deployment — different name, returned by List() not Get().
				eksAddonDeploy := makeDeployment(
					[]string{"--feature-gates=CELOmitFunction=true"},
					"ghcr.io/aws/kro-eks-addon:v0.9.0",
				)
				// deployGVR resource: Get() returns not-found (EKS name not in our list);
				// List() returns the EKS deployment via the label-selector fallback.
				dyn.resources[deployGVR] = &capStubNamespaceableResource{
					getErr:    fmt.Errorf("not found"),
					listItems: []unstructured.Unstructured{*eksAddonDeploy},
				}
				return dyn, disc
			},
			check: func(t *testing.T, caps *KroCapabilities) {
				// Version must be extracted from the EKS add-on image tag.
				assert.Equal(t, "v0.9.0", caps.Version,
					"version should be detected from EKS add-on deployment via cluster-scoped fallback")
				// IsSupported must be true since v0.9.0 >= MinSupportedKroVersion.
				assert.True(t, caps.IsSupported,
					"IsSupported must be true when version is successfully detected")
				// Feature gate from EKS add-on args should be parsed.
				assert.True(t, caps.FeatureGates["CELOmitFunction"],
					"feature gates should be parsed from EKS add-on deployment args")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dyn, disc := tt.build()
			caps := DetectCapabilities(context.Background(), dyn, disc)
			require.NotNil(t, caps)
			tt.check(t, caps)
		})
	}
}

func TestForbiddenCapabilitiesList(t *testing.T) {
	forbidden := ForbiddenCapabilities()
	assert.Contains(t, forbidden, "specPatch")
	assert.Contains(t, forbidden, "stateFields")
}

// TestDetectsGraphRevisions verifies that HasGraphRevisions is set to true when
// the internal.kro.run/v1alpha1 API group exposes a "graphrevisions" resource.
func TestDetectsGraphRevisions(t *testing.T) {
	disc := newCapStubDiscovery()
	// Simulate kro.run group so DetectCapabilities proceeds past Step 1.
	disc.resources[kroAPIVersion] = &metav1.APIResourceList{
		APIResources: []metav1.APIResource{
			{Name: "resourcegraphdefinitions"},
		},
	}
	// Simulate internal.kro.run/v1alpha1 with graphrevisions available.
	disc.resources[internalKroAPIVersion] = &metav1.APIResourceList{
		APIResources: []metav1.APIResource{
			{Name: "graphrevisions"},
		},
	}

	caps := DetectCapabilities(t.Context(), newCapStubDynamic(), disc)
	assert.True(t, caps.Schema.HasGraphRevisions, "HasGraphRevisions should be true when graphrevisions CRD is present")
}

// TestGraphRevisionsAbsentOnPreV090Cluster verifies that HasGraphRevisions is false
// when the internal.kro.run API group is not registered (pre-v0.9.0 cluster).
func TestGraphRevisionsAbsentOnPreV090Cluster(t *testing.T) {
	disc := newCapStubDiscovery()
	disc.resources[kroAPIVersion] = &metav1.APIResourceList{
		APIResources: []metav1.APIResource{
			{Name: "resourcegraphdefinitions"},
		},
	}
	// No entry for internalKroAPIVersion — simulates pre-v0.9.0.

	caps := DetectCapabilities(t.Context(), newCapStubDynamic(), disc)
	assert.False(t, caps.Schema.HasGraphRevisions, "HasGraphRevisions should be false when CRD is absent")
}

// TestBaselineHasExternalRefSelectorTrue asserts that the v0.9.0 baseline
// has HasExternalRefSelector set to true (changed from false in v0.8.x).
func TestBaselineHasExternalRefSelectorTrue(t *testing.T) {
	b := Baseline()
	assert.True(t, b.Schema.HasExternalRefSelector, "Baseline().Schema.HasExternalRefSelector must be true for kro v0.9.0+")
}

// TestBaselineHasGraphRevisionsFalse asserts that the baseline (conservative
// fallback) has HasGraphRevisions set to false — it requires live cluster detection.
func TestBaselineHasGraphRevisionsFalse(t *testing.T) {
	b := Baseline()
	assert.False(t, b.Schema.HasGraphRevisions, "Baseline().Schema.HasGraphRevisions must be false (requires detection)")
}

func TestParseFeatureGateString(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect map[string]bool
	}{
		{"single true", "CELOmitFunction=true", map[string]bool{"CELOmitFunction": true}},
		{"single false", "CELOmitFunction=false", map[string]bool{"CELOmitFunction": false}},
		{"multiple", "A=true,B=false,C=true", map[string]bool{"A": true, "B": false, "C": true}},
		{"empty string", "", map[string]bool{}},
		{"trailing comma", "A=true,", map[string]bool{"A": true}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseFeatureGateString(tt.input)
			assert.Equal(t, tt.expect, result)
		})
	}
}

// ── Version comparison tests (spec 053-multi-version-kro) ────────────────────

func TestCompareKroVersions(t *testing.T) {
	tests := []struct {
		name   string
		a, b   string
		expect int
	}{
		{"equal versions", "v0.8.5", "v0.8.5", 0},
		{"equal without v prefix", "0.8.5", "0.8.5", 0},
		{"v0.9.0 > v0.8.5", "v0.9.0", "v0.8.5", 1},
		{"v0.8.5 < v0.9.0", "v0.8.5", "v0.9.0", -1},
		{"v1.0.0 > v0.9.9", "v1.0.0", "v0.9.9", 1},
		{"pre-release stripped", "v0.9.0-rc.1", "v0.9.0", 0},
		{"empty is v0.0.0", "", "v0.8.0", -1},
		{"patch difference", "v0.8.6", "v0.8.5", 1},
		{"minor difference", "v0.9.0", "v0.8.99", 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CompareKroVersions(tt.a, tt.b)
			assert.Equal(t, tt.expect, got)
		})
	}
}

func TestIsKroVersionSupported(t *testing.T) {
	tests := []struct {
		version string
		want    bool
	}{
		{"v0.8.0", true},   // exactly the minimum
		{"v0.8.5", true},   // above minimum
		{"v0.9.0", true},   // well above minimum
		{"v1.0.0", true},   // major version bump
		{"v0.7.9", false},  // just below minimum
		{"v0.7.0", false},  // below minimum
		{"v0.1.0", false},  // very old
		{"", false},        // empty
		{"unknown", false}, // literal "unknown" string
	}
	for _, tt := range tests {
		t.Run(tt.version, func(t *testing.T) {
			assert.Equal(t, tt.want, IsKroVersionSupported(tt.version))
		})
	}
}

func TestBaselineIsSupported(t *testing.T) {
	// Baseline sets IsSupported=true by default (assumes a recent kro)
	assert.True(t, Baseline().IsSupported)
}

func TestMinSupportedVersion(t *testing.T) {
	// Validate the constant itself is a valid version string
	assert.True(t, IsKroVersionSupported(MinSupportedKroVersion), "MinSupportedKroVersion must be >= itself")
}

// ── KroCapabilities.String() ──────────────────────────────────────────────────

func TestKroCapabilitiesString(t *testing.T) {
	caps := &KroCapabilities{
		Version:        "v0.9.1",
		APIVersion:     "kro.run/v1alpha1",
		KnownResources: []string{"resourcegraphdefinitions"},
		FeatureGates:   map[string]bool{"CELOmitFunction": true},
		IsSupported:    true,
	}
	s := caps.String()
	assert.Contains(t, s, "v0.9.1")
	assert.Contains(t, s, "kro.run/v1alpha1")
	assert.Contains(t, s, "resourcegraphdefinitions")
	assert.Contains(t, s, "supported=true")
}

func TestKroCapabilitiesStringUnsupported(t *testing.T) {
	caps := &KroCapabilities{
		Version:        "v0.7.0",
		APIVersion:     "kro.run/v1alpha1",
		KnownResources: []string{},
		FeatureGates:   map[string]bool{},
		IsSupported:    false,
	}
	s := caps.String()
	assert.Contains(t, s, "v0.7.0")
	assert.Contains(t, s, "supported=false")
}

// ── nestedSlice edge cases ────────────────────────────────────────────────────

func TestNestedSliceEmptyKeys(t *testing.T) {
	obj := map[string]any{"foo": []any{"bar"}}
	result, ok := nestedSlice(obj)
	assert.False(t, ok, "nestedSlice with no keys should return false")
	assert.Nil(t, result)
}

func TestNestedSliceMissingIntermediateKey(t *testing.T) {
	obj := map[string]any{"spec": map[string]any{}}
	result, ok := nestedSlice(obj, "spec", "versions")
	assert.False(t, ok)
	assert.Nil(t, result)
}

func TestNestedSliceIntermediateNotMap(t *testing.T) {
	obj := map[string]any{"spec": "not-a-map"}
	result, ok := nestedSlice(obj, "spec", "versions")
	assert.False(t, ok)
	assert.Nil(t, result)
}

func TestNestedSliceFinalKeyNotSlice(t *testing.T) {
	obj := map[string]any{"spec": map[string]any{"versions": "not-a-slice"}}
	result, ok := nestedSlice(obj, "spec", "versions")
	assert.False(t, ok)
	assert.Nil(t, result)
}

// ── hasKey edge cases ─────────────────────────────────────────────────────────

func TestHasKeyNilMap(t *testing.T) {
	assert.False(t, hasKey(nil, "anything"), "hasKey on nil map should return false")
}

func TestHasKeyPresentAndAbsent(t *testing.T) {
	m := map[string]any{"foo": 1}
	assert.True(t, hasKey(m, "foo"))
	assert.False(t, hasKey(m, "bar"))
}

// ── detectSchemaCapabilities branch coverage ──────────────────────────────────

// makeCRDObjectWithCustomVersions builds a CRD where spec.versions contains
// a non-map item (e.g. a string), triggering the versions[0] type assertion failure.
func makeCRDWithNonMapVersion() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
		"spec": map[string]any{
			"versions": []any{"not-a-map"},
		},
	}}
}

// makeCRDWithEmptyVersions builds a CRD with an empty spec.versions array.
func makeCRDWithEmptyVersions() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
		"spec": map[string]any{
			"versions": []any{},
		},
	}}
}

// makeCRDWithNoOpenAPISchema builds a CRD version with no openAPIV3Schema.
func makeCRDWithNoOpenAPISchema() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
		"spec": map[string]any{
			"versions": []any{
				map[string]any{
					"name":   "v1alpha1",
					"schema": map[string]any{
						// no openAPIV3Schema key
					},
				},
			},
		},
	}}
}

// makeCRDWithNoSpecProperties builds a CRD with openAPIV3Schema but no spec.properties.
func makeCRDWithNoSpecProperties() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
		"spec": map[string]any{
			"versions": []any{
				map[string]any{
					"name": "v1alpha1",
					"schema": map[string]any{
						"openAPIV3Schema": map[string]any{
							"properties": map[string]any{
								// no "spec" key
							},
						},
					},
				},
			},
		},
	}}
}

// makeCRDWithNoResourcesKey builds a CRD where spec.properties has no "resources" key.
func makeCRDWithNoResourcesKey() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
		"spec": map[string]any{
			"versions": []any{
				map[string]any{
					"name": "v1alpha1",
					"schema": map[string]any{
						"openAPIV3Schema": map[string]any{
							"properties": map[string]any{
								"spec": map[string]any{
									"properties": map[string]any{
										// no "resources" key — only "schema"
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
}

// makeCRDWithResourcesNoItems builds a CRD where resources exists but has no "items".
func makeCRDWithResourcesNoItems() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   map[string]any{"name": rgdCRDName},
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
											// no "items" key
											"type": "array",
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}}
}

func TestDetectSchemaCapabilitiesEdgeCases(t *testing.T) {
	tests := []struct {
		name  string
		crd   *unstructured.Unstructured
		check func(t *testing.T, sc SchemaCapabilities)
	}{
		{
			name: "empty versions falls back to baseline",
			crd:  makeCRDWithEmptyVersions(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
				assert.Equal(t, baseline.HasExternalRef, sc.HasExternalRef)
			},
		},
		{
			name: "versions[0] not a map falls back to baseline",
			crd:  makeCRDWithNonMapVersion(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
			},
		},
		{
			name: "no openAPIV3Schema falls back to baseline",
			crd:  makeCRDWithNoOpenAPISchema(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
			},
		},
		{
			name: "no spec.properties falls back to baseline",
			crd:  makeCRDWithNoSpecProperties(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
			},
		},
		{
			name: "no resources key falls back to baseline",
			crd:  makeCRDWithNoResourcesKey(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				// resourceItemProps is nil → returns baseline not all-false
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
			},
		},
		{
			name: "resources with no items falls back to baseline",
			crd:  makeCRDWithResourcesNoItems(),
			check: func(t *testing.T, sc SchemaCapabilities) {
				baseline := Baseline().Schema
				assert.Equal(t, baseline.HasForEach, sc.HasForEach)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dyn := newCapStubDynamic()
			dyn.resources[crdGVR] = &capStubNamespaceableResource{
				getItems: map[string]*unstructured.Unstructured{rgdCRDName: tt.crd},
			}
			sc := detectSchemaCapabilities(context.Background(), dyn)
			tt.check(t, sc)
		})
	}
}

// ── getResourceItemProperties branch coverage ─────────────────────────────────

func TestGetResourceItemPropertiesNoResourcesKey(t *testing.T) {
	specProps := map[string]any{
		"schema": map[string]any{"properties": map[string]any{}},
		// no "resources" key
	}
	result := getResourceItemProperties(context.Background(), specProps)
	assert.Nil(t, result, "should return nil when 'resources' key is absent")
}

func TestGetResourceItemPropertiesNoItems(t *testing.T) {
	specProps := map[string]any{
		"resources": map[string]any{
			"type": "array",
			// no "items" key
		},
	}
	result := getResourceItemProperties(context.Background(), specProps)
	assert.Nil(t, result, "should return nil when resources.items is absent")
}

// ── parseFeatureGatesFromArgs branch coverage ────────────────────────────────

// TestParseFeatureGatesFromArgs exercises all branches in parseFeatureGatesFromArgs.
func TestParseFeatureGatesFromArgs(t *testing.T) {
	tests := []struct {
		name      string
		container map[string]any
		wantNil   bool
		wantGates map[string]bool
	}{
		{
			name:    "args key absent → nil",
			container: map[string]any{
				"image": "ghcr.io/kro-run/kro:v0.9.1",
			},
			wantNil: true,
		},
		{
			name:    "args not a []any (e.g. string) → nil",
			container: map[string]any{
				"args": "not-a-slice",
			},
			wantNil: true,
		},
		{
			name:    "args present but no --feature-gates flag → nil",
			container: map[string]any{
				"args": []any{"--log-level=debug", "--port=8080"},
			},
			wantNil: true,
		},
		{
			name:    "feature-gates flag present → parsed map",
			container: map[string]any{
				"args": []any{
					"--log-level=debug",
					"--feature-gates=CELOmitFunction=true,ExternalRefSelector=false",
				},
			},
			wantGates: map[string]bool{
				"CELOmitFunction":    true,
				"ExternalRefSelector": false,
			},
		},
		{
			name:    "non-string element in args slice → skipped, no panic",
			container: map[string]any{
				"args": []any{
					42, // non-string: skipped
					"--feature-gates=CELOmitFunction=true",
				},
			},
			wantGates: map[string]bool{"CELOmitFunction": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseFeatureGatesFromArgs(tt.container)
			if tt.wantNil {
				assert.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			for k, v := range tt.wantGates {
				assert.Equal(t, v, got[k], "gate %q", k)
			}
		})
	}
}

// ── hasExternalRefSelector branch coverage ────────────────────────────────────

// TestHasExternalRefSelector exercises all branches in hasExternalRefSelector.
func TestHasExternalRefSelector(t *testing.T) {
	t.Run("nil map → false", func(t *testing.T) {
		assert.False(t, hasExternalRefSelector(nil))
	})

	t.Run("empty map → false", func(t *testing.T) {
		assert.False(t, hasExternalRefSelector(map[string]any{}))
	})

	t.Run("externalRef present but no selector → false", func(t *testing.T) {
		props := map[string]any{
			"externalRef": map[string]any{
				"properties": map[string]any{
					"metadata": map[string]any{
						"properties": map[string]any{
							"name": map[string]any{},
							// no "selector" key
						},
					},
				},
			},
		}
		assert.False(t, hasExternalRefSelector(props))
	})

	t.Run("externalRef with selector present → true", func(t *testing.T) {
		props := map[string]any{
			"externalRef": map[string]any{
				"properties": map[string]any{
					"metadata": map[string]any{
						"properties": map[string]any{
							"selector": map[string]any{
								"type": "object",
							},
						},
					},
				},
			},
		}
		assert.True(t, hasExternalRefSelector(props))
	})
}

// ── CompareKroVersions patch less-than branch coverage ───────────────────────

// TestCompareKroVersions_PatchLessThan exercises the one branch in CompareKroVersions
// that was not covered: aPatch < bPatch returns -1.
func TestCompareKroVersions_PatchLessThan(t *testing.T) {
	// aMaj=bMaj, aMin=bMin, aPatch(4) < bPatch(5) → must return -1
	got := CompareKroVersions("v0.8.4", "v0.8.5")
	assert.Equal(t, -1, got, "v0.8.4 < v0.8.5 must return -1")
}
