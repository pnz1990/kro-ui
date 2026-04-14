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

	openapi_v2 "github.com/google/gnostic-models/openapiv2"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// --- Context stubs (used by contexts_test.go) ---

// stubClientFactory is a hand-written stub for testing context handlers.
// It implements the contextManager interface without needing a real cluster.
type stubClientFactory struct {
	contexts      []k8sclient.Context
	activeContext string
	switchErr     error
	listErr       error
}

func (s *stubClientFactory) ListContexts() ([]k8sclient.Context, string, error) {
	if s.listErr != nil {
		return nil, "", s.listErr
	}
	return s.contexts, s.activeContext, nil
}

func (s *stubClientFactory) SwitchContext(ctx string) error {
	if s.switchErr != nil {
		return s.switchErr
	}
	// Validate context exists in the stub's list.
	for _, c := range s.contexts {
		if c.Name == ctx {
			s.activeContext = ctx
			return nil
		}
	}
	return fmt.Errorf("context %q not found in kubeconfig", ctx)
}

func (s *stubClientFactory) ActiveContext() string {
	return s.activeContext
}

// newTestHandler creates a Handler backed by a stubClientFactory for testing.
func newTestHandler(stub *stubClientFactory) *Handler {
	return &Handler{ctxMgr: stub}
}

// --- Dynamic + Discovery stubs (used by rgds_test.go, discover_test.go) ---

// stubK8sClients implements k8sClients and provides stub dynamic + discovery clients.
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

// newRGDTestHandler creates a Handler with stub dynamic and discovery clients.
func newRGDTestHandler(dyn *stubDynamic, disc *stubDiscovery) *Handler {
	return &Handler{
		factory: &stubK8sClients{dyn: dyn, disc: disc},
	}
}

// --- stubDynamic implements dynamic.Interface ---

// stubDynamic routes Resource() calls to per-GVR stubNamespaceableResource instances.
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
	// Return a stub that always errors for unknown GVRs.
	return &stubNamespaceableResource{
		listErr: fmt.Errorf("resource %v not found", gvr),
		getErr:  fmt.Errorf("resource %v not found", gvr),
	}
}

// --- stubNamespaceableResource implements dynamic.NamespaceableResourceInterface ---

// stubNamespaceableResource provides both cluster-scoped and namespaced results.
type stubNamespaceableResource struct {
	items       []unstructured.Unstructured           // items returned by List (cluster-wide)
	getItems    map[string]*unstructured.Unstructured // name → object for Get
	listErr     error
	getErr      error
	nsResources map[string]*stubResourceClient // namespace → namespaced stub
	// labelItems is used by cluster-scoped List() calls (no .Namespace() wrapper). Issue #202.
	labelItems   map[string][]unstructured.Unstructured
	createResult *unstructured.Unstructured
	// applyConfigured / applyResult / applyErr allow validate handler tests to control Apply.
	// Set applyConfigured=true to prevent the panic and return applyResult/applyErr instead.
	applyConfigured bool
	applyResult     *unstructured.Unstructured
	applyErr        error
}

func (s *stubNamespaceableResource) Namespace(ns string) dynamic.ResourceInterface {
	if s.nsResources != nil {
		if r, ok := s.nsResources[ns]; ok {
			return r
		}
	}
	// Return a default namespaced client that uses the same data.
	return &stubResourceClient{
		items:    s.items,
		getItems: s.getItems,
		listErr:  s.listErr,
		getErr:   s.getErr,
	}
}

// Cluster-scoped List/Get — delegate to inline data.
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
	// Return a proper k8s NotFound error so handlers can distinguish 404 from 503.
	return nil, k8serrors.NewNotFound(schema.GroupResource{Resource: "resource"}, name)
}

// Unused mutating methods — panics are fine since read-only per constitution.
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
func (s *stubNamespaceableResource) Apply(_ context.Context, _ string, _ *unstructured.Unstructured, _ metav1.ApplyOptions, _ ...string) (*unstructured.Unstructured, error) {
	if s.applyConfigured {
		return s.applyResult, s.applyErr
	}
	panic("read-only stub")
}
func (s *stubNamespaceableResource) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only stub")
}

// --- stubResourceClient implements dynamic.ResourceInterface (namespaced) ---

type stubResourceClient struct {
	items      []unstructured.Unstructured
	getItems   map[string]*unstructured.Unstructured
	labelItems map[string][]unstructured.Unstructured // label selector → items
	listErr    error
	getErr     error
}

func (s *stubResourceClient) List(_ context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	// If a label selector is present and labelItems is populated, return filtered results.
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
	return nil, k8serrors.NewNotFound(schema.GroupResource{Resource: "resource"}, name)
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

// --- stubDiscovery implements discovery.DiscoveryInterface ---

// stubDiscovery provides canned responses for ServerResourcesForGroupVersion.
type stubDiscovery struct {
	resources map[string]*metav1.APIResourceList // groupVersion → resource list
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

// Minimal no-op implementations for the rest of DiscoveryInterface.
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

// --- Test helpers ---

// makeRGDObject creates an unstructured RGD object for testing.
func makeRGDObject(name, kind, group, apiVersion string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "kro.run/v1alpha1",
		"kind":       "ResourceGraphDefinition",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"schema": map[string]any{},
		},
	}}
	schema := obj.Object["spec"].(map[string]any)["schema"].(map[string]any)
	if kind != "" {
		schema["kind"] = kind
	}
	if group != "" {
		schema["group"] = group
	}
	if apiVersion != "" {
		schema["apiVersion"] = apiVersion
	}
	return obj
}
