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
	"fmt"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
)

// ContextClients holds ephemeral dynamic and discovery clients for a single
// kubeconfig context. It is created by BuildContextClient and is not shared.
type ContextClients struct {
	dyn  dynamic.Interface
	disc discovery.DiscoveryInterface
}

// Dynamic returns the dynamic client.
func (c *ContextClients) Dynamic() dynamic.Interface { return c.dyn }

// Discovery returns the discovery client.
func (c *ContextClients) Discovery() discovery.DiscoveryInterface { return c.disc }

// BuildContextClient creates an ephemeral pair of dynamic + discovery clients
// for the given kubeconfig context. It does NOT mutate the shared ClientFactory.
// This is the entry point for the fleet handler's per-context fan-out.
func BuildContextClient(kubeconfigPath, contextName string) (*ContextClients, error) {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath}
	overrides := &clientcmd.ConfigOverrides{}
	if contextName != "" {
		overrides.CurrentContext = contextName
	}
	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, overrides)

	restCfg, err := cfg.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("build rest config for context %q: %w", contextName, err)
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("build dynamic client for context %q: %w", contextName, err)
	}

	disc, err := discovery.NewDiscoveryClientForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("build discovery client for context %q: %w", contextName, err)
	}

	return &ContextClients{dyn: dyn, disc: disc}, nil
}

// KubeconfigPath returns the effective kubeconfig path from the ClientFactory.
// Used by the fleet handler to build per-context clients without duplicating
// the path resolution logic.
func (f *ClientFactory) KubeconfigPath() string {
	return f.kubeconfigPath
}
