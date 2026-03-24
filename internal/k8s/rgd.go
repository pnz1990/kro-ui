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
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
)

// perResourceTimeout is the per-GVR List deadline used by ListChildResources.
// Constitution §XI: fan-out list operations MUST use a per-resource timeout of 2 seconds.
const perResourceTimeout = 2 * time.Second

// K8sClients provides access to dynamic and discovery clients.
// CachedServerGroupsAndResources is separated from Discovery() so callers can
// benefit from the ≥30s cache without bypassing it.
type K8sClients interface {
	Dynamic() dynamic.Interface
	Discovery() discovery.DiscoveryInterface
	// CachedServerGroupsAndResources returns all API resource lists from a
	// ≥30-second cache, refreshing only when the cache is stale.
	// Constitution §XI: Never call ServerGroupsAndResources() per-request.
	CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error)
}

// UnstructuredString extracts a string value from a nested map by path.
func UnstructuredString(obj map[string]any, path ...string) (string, bool, error) {
	cur := obj
	for i, key := range path {
		if i == len(path)-1 {
			v, ok := cur[key]
			if !ok {
				return "", false, nil
			}
			s, ok := v.(string)
			return s, ok, nil
		}
		next, ok := cur[key].(map[string]any)
		if !ok {
			return "", false, nil
		}
		cur = next
	}
	return "", false, nil
}

// IsListable returns true if the API resource supports list and is not a subresource.
func IsListable(r metav1.APIResource) bool {
	if strings.Contains(r.Name, "/") {
		return false // subresource
	}
	for _, v := range r.Verbs {
		if v == "list" {
			return true
		}
	}
	return false
}

// DiscoverPlural uses the discovery API to find the correct plural resource name for a kind.
func DiscoverPlural(clients K8sClients, group, version, kind string) (string, error) {
	gv := group + "/" + version
	if group == "" {
		gv = version
	}
	resourceList, err := clients.Discovery().ServerResourcesForGroupVersion(gv)
	if err != nil {
		return "", err
	}
	for _, r := range resourceList.APIResources {
		if strings.EqualFold(r.Kind, kind) {
			return r.Name, nil
		}
	}
	return "", fmt.Errorf("kind %q not found in %s", kind, gv)
}

// ResolveInstanceGVR looks up the GVR for instances of the given RGD.
func ResolveInstanceGVR(ctx context.Context, clients K8sClients, rgdName string) (schema.GroupVersionResource, error) {
	if rgdName == "" {
		return schema.GroupVersionResource{}, fmt.Errorf("rgd query param required")
	}
	rgdGVR := schema.GroupVersionResource{
		Group:    KroGroup,
		Version:  "v1alpha1",
		Resource: RGDResource,
	}
	rgd, err := clients.Dynamic().Resource(rgdGVR).Get(ctx, rgdName, metav1.GetOptions{})
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("get RGD %q: %w", rgdName, err)
	}

	kind, _, _ := UnstructuredString(rgd.Object, "spec", "schema", "kind")
	group, _, _ := UnstructuredString(rgd.Object, "spec", "schema", "group")
	version, _, _ := UnstructuredString(rgd.Object, "spec", "schema", "apiVersion")
	if kind == "" {
		return schema.GroupVersionResource{}, fmt.Errorf("RGD has no schema kind defined")
	}
	if group == "" {
		group = KroGroup
	}
	if version == "" {
		version = "v1alpha1"
	}

	plural, err := DiscoverPlural(clients, group, version, kind)
	if err != nil {
		plural = strings.ToLower(kind) + "s"
	}
	return schema.GroupVersionResource{Group: group, Version: version, Resource: plural}, nil
}

// ListChildResources finds all resources across all namespaces that carry the
// kro.run/instance-name label matching the instance name.
//
// Issue #146: kro creates managed resources in per-instance namespaces (e.g.
// instance "carrlos" may place its children in a namespace also named "carrlos").
// Scoping the search to the instance's own namespace returns nothing in that case.
// We therefore search cluster-wide (empty namespace = all namespaces) and rely
// on the label selector to narrow results correctly.
//
// Uses cached discovery to enumerate all resource types (cache TTL ≥30s),
// then fans out label-selector List calls concurrently with a 2s per-resource
// timeout. Resources that time out or error are silently skipped — a partial
// result is always better than a hung request.
//
// Constitution §XI: no sequential API loops; discovery must be cached;
// fan-out via goroutines with per-resource deadline.
func ListChildResources(ctx context.Context, clients K8sClients, instanceName string) ([]map[string]any, error) {
	log := zerolog.Ctx(ctx)
	labelSelector := fmt.Sprintf("kro.run/instance-name=%s", instanceName)

	// Use cached discovery — avoids per-request ServerGroupsAndResources() call.
	apiLists, err := clients.CachedServerGroupsAndResources()
	if err != nil {
		return nil, fmt.Errorf("discovery: %w", err)
	}

	// Collect all listable GVRs.
	var gvrs []schema.GroupVersionResource
	for _, apiList := range apiLists {
		gv, err := schema.ParseGroupVersion(apiList.GroupVersion)
		if err != nil {
			continue
		}
		for _, res := range apiList.APIResources {
			if !IsListable(res) {
				continue
			}
			gvrs = append(gvrs, schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: res.Name,
			})
		}
	}

	// Fan out concurrently — one goroutine per GVR, each with a 2s deadline.
	// Search cluster-wide (empty namespace) so children in per-instance namespaces
	// are included. Constitution §XI: fan-out list operations MUST use concurrency
	// with a per-resource timeout of 2 seconds.
	var (
		mu      sync.Mutex
		results []map[string]any
	)

	dyn := clients.Dynamic()
	var wg sync.WaitGroup
	wg.Add(len(gvrs))

	for _, gvr := range gvrs {
		gvr := gvr // capture loop variable
		go func() {
			defer wg.Done()

			rctx, cancel := context.WithTimeout(ctx, perResourceTimeout)
			defer cancel()

			// Empty namespace = cluster-wide list. kro creates child resources in
			// per-instance namespaces, so we must search all namespaces.
			raw, err := dyn.Resource(gvr).Namespace("").List(
				rctx, metav1.ListOptions{LabelSelector: labelSelector},
			)
			if err != nil || raw == nil {
				log.Debug().Err(err).Str("gvr", gvr.String()).Msg("skipped resource during child listing")
				return
			}
			if len(raw.Items) == 0 {
				return
			}
			mu.Lock()
			for _, item := range raw.Items {
				results = append(results, item.Object)
			}
			mu.Unlock()
		}()
	}

	wg.Wait()
	return results, nil
}
