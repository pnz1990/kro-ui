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

// Package k8s provides a ClientFactory that can switch kubeconfig contexts at runtime.
// All resource access uses the dynamic client so kro API changes require no code updates.
package k8s

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// ClientFactory holds the kubeconfig loader and provides clients for the active context.
// Context switching is safe for concurrent use.
type ClientFactory struct {
	mu             sync.RWMutex
	kubeconfigPath string
	activeContext  string
	restConfig     *rest.Config
	dynamic        dynamic.Interface
	discovery      discovery.DiscoveryInterface
}

// NewClientFactory creates a ClientFactory from the given kubeconfig path and context.
// If kubeconfigPath is empty it falls back to $KUBECONFIG then ~/.kube/config.
// If context is empty it uses the current context in the kubeconfig.
func NewClientFactory(kubeconfigPath, context string) (*ClientFactory, error) {
	if kubeconfigPath == "" {
		if env := os.Getenv("KUBECONFIG"); env != "" {
			kubeconfigPath = env
		} else {
			home, _ := os.UserHomeDir()
			kubeconfigPath = filepath.Join(home, ".kube", "config")
		}
	}

	f := &ClientFactory{kubeconfigPath: kubeconfigPath}
	if err := f.load(context); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *ClientFactory) load(context string) error {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: f.kubeconfigPath}
	overrides := &clientcmd.ConfigOverrides{}
	if context != "" {
		overrides.CurrentContext = context
	}
	cfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, overrides)

	// Validate that the requested context exists before building clients.
	rawCfg, err := cfg.RawConfig()
	if err != nil {
		return fmt.Errorf("load raw kubeconfig: %w", err)
	}
	if context != "" {
		if _, ok := rawCfg.Contexts[context]; !ok {
			return fmt.Errorf("context %q not found in kubeconfig", context)
		}
	}

	restCfg, err := cfg.ClientConfig()
	if err != nil {
		return fmt.Errorf("build rest config: %w", err)
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("build dynamic client: %w", err)
	}

	disc, err := discovery.NewDiscoveryClientForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("build discovery client: %w", err)
	}

	active := rawCfg.CurrentContext
	if context != "" {
		active = context
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.restConfig = restCfg
	f.dynamic = dyn
	f.discovery = disc
	f.activeContext = active
	return nil
}

// SwitchContext reloads all clients for the given context.
// Returns an error if the context name is empty or not found in the kubeconfig.
func (f *ClientFactory) SwitchContext(ctx string) error {
	if ctx == "" {
		return fmt.Errorf("context name must not be empty")
	}
	return f.load(ctx)
}

// Dynamic returns the dynamic client for the active context.
func (f *ClientFactory) Dynamic() dynamic.Interface {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.dynamic
}

// Discovery returns the discovery client for the active context.
func (f *ClientFactory) Discovery() discovery.DiscoveryInterface {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.discovery
}

// ActiveContext returns the name of the currently active context.
func (f *ClientFactory) ActiveContext() string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.activeContext
}

// ListContexts returns all available contexts from the kubeconfig and the active context.
func (f *ClientFactory) ListContexts() ([]Context, string, error) {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: f.kubeconfigPath}
	rawCfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules, &clientcmd.ConfigOverrides{},
	).RawConfig()
	if err != nil {
		return nil, "", fmt.Errorf("load kubeconfig: %w", err)
	}

	contexts := make([]Context, 0, len(rawCfg.Contexts))
	for name, ctx := range rawCfg.Contexts {
		contexts = append(contexts, Context{
			Name:    name,
			Cluster: ctx.Cluster,
			User:    ctx.AuthInfo,
		})
	}

	f.mu.RLock()
	active := f.activeContext
	f.mu.RUnlock()

	return contexts, active, nil
}

// Context is a simplified kubeconfig context entry.
type Context struct {
	Name    string `json:"name"`
	Cluster string `json:"cluster"`
	User    string `json:"user"`
}

// KroGroup is the API group for kro resources.
const KroGroup = "kro.run"

// RGDResource is the plural resource name for ResourceGraphDefinitions.
const RGDResource = "resourcegraphdefinitions"

// Placeholder for future GraphRevision resource name — discovered dynamically.
// When kro adds GraphRevision the discovery client will find it automatically.
const GraphRevisionResource = "graphrevisions"
