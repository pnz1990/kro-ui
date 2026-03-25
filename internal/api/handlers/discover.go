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

	"k8s.io/apimachinery/pkg/runtime/schema"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// resolveInstanceGVR looks up the GVR for instances of the given RGD.
// Thin wrapper that delegates to k8s.ResolveInstanceGVR.
func (h *Handler) resolveInstanceGVR(ctx context.Context, rgdName string) (schema.GroupVersionResource, error) {
	return k8sclient.ResolveInstanceGVR(ctx, h.factory, rgdName)
}

// listChildResources finds all child resources across all namespaces that carry
// the kro.run/instance-name label matching the instance name.
// When rgdName is provided the fan-out is scoped to only the resource types
// declared in the RGD spec — avoiding full-cluster discovery fan-out that causes
// throttling on large clusters (EKS/GKE). Falls back to full discovery when
// rgdName is empty or the RGD cannot be fetched.
func (h *Handler) listChildResources(ctx context.Context, instanceName, rgdName string) ([]map[string]any, error) {
	return k8sclient.ListChildResourcesForRGD(ctx, h.factory, instanceName, rgdName)
}
