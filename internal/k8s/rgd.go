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

// DiscoverPlural finds the correct plural resource name for a kind using the
// TTL-cached discovery results. This avoids a live API server call on every
// request — the cache is refreshed at most once per 30s (Constitution §XI).
//
// It falls back to the naive "<kind>s" pluralisation only when the kind is
// genuinely absent from the cached resource lists (e.g. CRD not yet registered).
func DiscoverPlural(clients K8sClients, group, version, kind string) (string, error) {
	apiLists, err := clients.CachedServerGroupsAndResources()
	if err != nil {
		// Cache miss / discovery error — fall through to direct lookup below.
		apiLists = nil
	}

	gv := group + "/" + version
	if group == "" {
		gv = version
	}

	// Scan cached results first.
	for _, list := range apiLists {
		if list.GroupVersion != gv {
			continue
		}
		for _, r := range list.APIResources {
			if strings.EqualFold(r.Kind, kind) {
				return r.Name, nil
			}
		}
	}

	// Cache miss for this specific GV — fall back to a single targeted lookup.
	// This happens on first use after startup or when a new CRD is registered.
	resourceList, err := clients.Discovery().ServerResourcesForGroupVersion(gv)
	if err != nil {
		return "", fmt.Errorf("discovery for %s: %w", gv, err)
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
	labelSelector := fmt.Sprintf("%s=%s", LabelInstanceName, instanceName)

	// Use cached discovery — avoids per-request ServerGroupsAndResources() call.
	apiLists, err := clients.CachedServerGroupsAndResources()
	if err != nil {
		return nil, fmt.Errorf("discovery: %w", err)
	}

	// Collect all listable GVRs, carrying the Namespaced flag.
	// Cluster-scoped resources (Namespace, ClusterRole, PV, etc.) must be listed
	// without .Namespace() — using .Namespace("") on a cluster-scoped resource
	// routes through the wrong API path and produces intermittent failures. Issue #202.
	var gvrs []gvrEntry
	for _, apiList := range apiLists {
		gv, err := schema.ParseGroupVersion(apiList.GroupVersion)
		if err != nil {
			continue
		}
		for _, res := range apiList.APIResources {
			if !IsListable(res) {
				continue
			}
			gvrs = append(gvrs, gvrEntry{
				gvr: schema.GroupVersionResource{
					Group:    gv.Group,
					Version:  gv.Version,
					Resource: res.Name,
				},
				namespaced: res.Namespaced,
			})
		}
	}

	return listWithLabelSelector(ctx, log, clients.Dynamic(), gvrs, labelSelector)
}

// gvrEntry carries a GVR and whether the resource is namespace-scoped.
type gvrEntry struct {
	gvr        schema.GroupVersionResource
	namespaced bool
}

// rgdResourceGVRs extracts the set of GVRs for resources declared in an RGD's
// spec.resources[].template.{apiVersion,kind}. This allows ListChildResources
// to fan out only to the specific resource types the RGD manages rather than
// scanning all ~90+ API resource types — critical on large clusters (EKS) where
// a full fan-out causes throttling and intermittent 2s timeouts.
//
// Resources whose template apiVersion or kind is empty/invalid are skipped.
// The Namespaced flag is resolved via DiscoverPlural (cached). If discovery
// fails for a given kind, the resource is included with namespaced=true as a
// safe default (cluster-scoped resources have no namespace, so we use
// .Namespace("").List() which returns an empty list for cluster-scoped types
// rather than an error).
func rgdResourceGVRs(ctx context.Context, clients K8sClients, rgd map[string]any) []gvrEntry {
	log := zerolog.Ctx(ctx)
	resources, ok := rgd["spec"].(map[string]any)
	if !ok {
		return nil
	}
	resList, ok := resources["resources"].([]any)
	if !ok {
		return nil
	}

	seen := make(map[schema.GroupVersionResource]bool)
	var entries []gvrEntry

	for _, r := range resList {
		res, ok := r.(map[string]any)
		if !ok {
			continue
		}
		tmpl, ok := res["template"].(map[string]any)
		if !ok {
			continue
		}
		rawAPIVersion, _ := tmpl["apiVersion"].(string)
		rawKind, _ := tmpl["kind"].(string)
		if rawAPIVersion == "" || rawKind == "" {
			continue
		}

		gv, err := schema.ParseGroupVersion(rawAPIVersion)
		if err != nil {
			continue
		}

		plural, err := DiscoverPlural(clients, gv.Group, gv.Version, rawKind)
		if err != nil {
			// Discovery failed — fall back to naive plural and assume namespaced.
			plural = strings.ToLower(rawKind) + "s"
			log.Debug().Err(err).Str("kind", rawKind).Msg("DiscoverPlural failed for RGD resource; using naive plural")
		}

		gvr := schema.GroupVersionResource{Group: gv.Group, Version: gv.Version, Resource: plural}
		if seen[gvr] {
			continue // deduplicate (e.g. two ConfigMaps in the same RGD)
		}
		seen[gvr] = true

		// Determine Namespaced flag from discovery cache.
		namespaced := true // default: treat as namespaced (safer)
		if apiLists, err := clients.CachedServerGroupsAndResources(); err == nil {
			gvStr := rawAPIVersion
			for _, apiList := range apiLists {
				if apiList.GroupVersion != gvStr {
					continue
				}
				for _, res := range apiList.APIResources {
					if strings.EqualFold(res.Kind, rawKind) {
						namespaced = res.Namespaced
						break
					}
				}
			}
		}

		entries = append(entries, gvrEntry{gvr: gvr, namespaced: namespaced})
	}
	return entries
}

// ListChildResourcesForRGD is like ListChildResources but scopes the fan-out to
// only the resource types declared in the named RGD's spec.resources[].template.
// This avoids throttling on large clusters (EKS, GKE) where a full discovery
// fan-out across 90+ GVRs causes intermittent 2s timeouts for custom-resource
// types. When rgdName is empty or the RGD cannot be fetched, it falls back to
// the full discovery fan-out via ListChildResources.
func ListChildResourcesForRGD(ctx context.Context, clients K8sClients, instanceName, rgdName string) ([]map[string]any, error) {
	log := zerolog.Ctx(ctx)

	if rgdName != "" {
		rgdGVR := schema.GroupVersionResource{Group: KroGroup, Version: "v1alpha1", Resource: RGDResource}
		rgdObj, err := clients.Dynamic().Resource(rgdGVR).Get(ctx, rgdName, metav1.GetOptions{})
		if err == nil {
			gvrs := rgdResourceGVRs(ctx, clients, rgdObj.Object)
			if len(gvrs) > 0 {
				log.Debug().
					Str("rgd", rgdName).
					Int("gvrs", len(gvrs)).
					Msg("using RGD-scoped child listing")
				labelSelector := fmt.Sprintf("%s=%s", LabelInstanceName, instanceName)
				return listWithLabelSelector(ctx, log, clients.Dynamic(), gvrs, labelSelector)
			}
		} else {
			log.Debug().Err(err).Str("rgd", rgdName).Msg("could not fetch RGD for scoped listing; falling back to full discovery")
		}
	}

	return ListChildResources(ctx, clients, instanceName)
}

// listWithLabelSelector fans out concurrent List calls for the given GVRs and
// label selector. Each goroutine has a perResourceTimeout deadline.
func listWithLabelSelector(
	ctx context.Context,
	log *zerolog.Logger,
	dyn dynamic.Interface,
	gvrs []gvrEntry,
	labelSelector string,
) ([]map[string]any, error) {
	var (
		mu      sync.Mutex
		results []map[string]any
	)

	var wg sync.WaitGroup
	wg.Add(len(gvrs))

	for _, entry := range gvrs {
		entry := entry // capture loop variable
		go func() {
			defer wg.Done()

			rctx, cancel := context.WithTimeout(ctx, perResourceTimeout)
			defer cancel()

			// Use the correct client-go path based on whether the resource is namespaced.
			// Cluster-scoped resources (Namespace, ClusterRole, PV, etc.) must NOT use
			// .Namespace("") — that constructs a namespaced API path which fails for
			// cluster-scoped types. Issue #202.
			ri := dyn.Resource(entry.gvr)

			opts := metav1.ListOptions{LabelSelector: labelSelector}
			var items []map[string]any
			if entry.namespaced {
				raw, err := ri.Namespace("").List(rctx, opts)
				if err != nil || raw == nil {
					log.Debug().Err(err).Str("gvr", entry.gvr.String()).Msg("skipped namespaced resource during child listing")
					return
				}
				for i := range raw.Items {
					items = append(items, raw.Items[i].Object)
				}
			} else {
				raw, err := ri.List(rctx, opts)
				if err != nil || raw == nil {
					log.Debug().Err(err).Str("gvr", entry.gvr.String()).Msg("skipped cluster-scoped resource during child listing")
					return
				}
				for i := range raw.Items {
					items = append(items, raw.Items[i].Object)
				}
			}
			if len(items) == 0 {
				return
			}
			mu.Lock()
			results = append(results, items...)
			mu.Unlock()
		}()
	}

	wg.Wait()
	return results, nil
}
