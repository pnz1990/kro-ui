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
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// resolveInstanceGVR looks up the GVR for instances of the given RGD.
func (h *Handler) resolveInstanceGVR(rgdName string) (schema.GroupVersionResource, error) {
	if rgdName == "" {
		return schema.GroupVersionResource{}, fmt.Errorf("rgd query param required")
	}
	rgdGVR := schema.GroupVersionResource{
		Group:    k8sclient.KroGroup,
		Version:  "v1alpha1",
		Resource: k8sclient.RGDResource,
	}
	rgd, err := h.factory.Dynamic().Resource(rgdGVR).Get(context.Background(), rgdName, metav1.GetOptions{})
	if err != nil {
		return schema.GroupVersionResource{}, fmt.Errorf("get RGD %q: %w", rgdName, err)
	}

	kind, _, _ := unstructuredString(rgd.Object, "spec", "schema", "kind")
	group, _, _ := unstructuredString(rgd.Object, "spec", "schema", "group")
	version, _, _ := unstructuredString(rgd.Object, "spec", "schema", "apiVersion")
	if kind == "" {
		return schema.GroupVersionResource{}, fmt.Errorf("RGD has no spec.schema.kind")
	}
	if group == "" {
		group = k8sclient.KroGroup
	}
	if version == "" {
		version = "v1alpha1"
	}

	plural, err := discoverPlural(h.factory, group, version, kind)
	if err != nil {
		plural = strings.ToLower(kind) + "s"
	}
	return schema.GroupVersionResource{Group: group, Version: version, Resource: plural}, nil
}

// listChildResources finds all resources in the given namespace that carry the
// kro.run/instance-name label matching the instance name.
// Uses the discovery client to enumerate all resource types, then label-selects.
// This approach automatically handles any new resource kinds kro introduces.
func (h *Handler) listChildResources(namespace, instanceName, rgdName string) ([]map[string]any, error) {
	labelSelector := fmt.Sprintf("kro.run/instance-name=%s", instanceName)

	// Get all API resources from discovery — this is what makes it future-proof.
	_, apiLists, err := h.factory.Discovery().ServerGroupsAndResources()
	if err != nil {
		return nil, fmt.Errorf("discovery: %w", err)
	}

	var results []map[string]any
	for _, apiList := range apiLists {
		gv, err := schema.ParseGroupVersion(apiList.GroupVersion)
		if err != nil {
			continue
		}
		for _, res := range apiList.APIResources {
			if !isListable(res) {
				continue
			}
			gvr := schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: res.Name,
			}
			raw, err := h.factory.Dynamic().Resource(gvr).Namespace(namespace).List(
				context.Background(), metav1.ListOptions{LabelSelector: labelSelector},
			)
			if err != nil || raw == nil {
				continue
			}
			for _, item := range raw.Items {
				results = append(results, item.Object)
			}
		}
	}
	return results, nil
}

// discoverPlural uses the discovery API to find the correct plural resource name for a kind.
func discoverPlural(factory k8sClients, group, version, kind string) (string, error) {
	gv := group + "/" + version
	if group == "" {
		gv = version
	}
	resourceList, err := factory.Discovery().ServerResourcesForGroupVersion(gv)
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

// unstructuredString extracts a string value from a nested map by path.
func unstructuredString(obj map[string]any, path ...string) (string, bool, error) {
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

// isListable returns true if the API resource supports list and is not a subresource.
func isListable(r metav1.APIResource) bool {
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
