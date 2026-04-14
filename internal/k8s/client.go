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
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// discoveryCacheTTL is the minimum age before cached discovery results are refreshed.
// Constitution §XI: discovery results MUST be cached for ≥30 seconds.
const discoveryCacheTTL = 30 * time.Second

// apiResourceCache is an in-memory TTL cache for ServerGroupsAndResources results.
// Separate mutex from ClientFactory so discovery reads don't block client switching.
type apiResourceCache struct {
	mu     sync.RWMutex
	lists  []*metav1.APIResourceList
	expiry time.Time
}

func (c *apiResourceCache) get() ([]*metav1.APIResourceList, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.lists == nil || time.Now().After(c.expiry) {
		return nil, false
	}
	return c.lists, true
}

func (c *apiResourceCache) set(lists []*metav1.APIResourceList) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lists = lists
	c.expiry = time.Now().Add(discoveryCacheTTL)
}

func (c *apiResourceCache) invalidate() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lists = nil
}

// ClientFactory holds the kubeconfig loader and provides clients for the active context.
// Context switching is safe for concurrent use.
type ClientFactory struct {
	mu             sync.RWMutex
	kubeconfigPath string
	activeContext  string
	restConfig     *rest.Config
	dynamic        dynamic.Interface
	discovery      discovery.DiscoveryInterface
	discCache      apiResourceCache
	// switchHooks are called (without the lock held) after a successful SwitchContext.
	// Use RegisterContextSwitchHook to add hooks. Each hook must be safe for concurrent call.
	switchHooks []func()
}

// NewClientFactory creates a ClientFactory from the given kubeconfig path and context.
// Fallback chain: explicit path → $KUBECONFIG → ~/.kube/config → in-cluster.
// If context is empty it uses the current context in the kubeconfig.
func NewClientFactory(kubeconfigPath, context string) (*ClientFactory, error) {
	path := kubeconfigPath
	if path == "" {
		path = os.Getenv("KUBECONFIG")
	}
	if path == "" {
		if home, err := os.UserHomeDir(); err == nil {
			defaultPath := filepath.Join(home, ".kube", "config")
			if _, err := os.Stat(defaultPath); err == nil {
				path = defaultPath
			}
		}
	}
	if path != "" {
		f := &ClientFactory{kubeconfigPath: path}
		if err := f.load(context); err != nil {
			return nil, err
		}
		return f, nil
	}

	f := &ClientFactory{kubeconfigPath: ""}
	if err := f.loadInCluster(); err != nil {
		return nil, fmt.Errorf("no kubeconfig and in-cluster unavailable: %w", err)
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
	// Invalidate discovery cache on context switch so the new cluster is discovered fresh.
	f.discCache.invalidate()
	return nil
}

// loadInCluster builds clients using in-cluster config (ServiceAccount token).
// This is used when running inside a Kubernetes cluster without a kubeconfig file.
func (f *ClientFactory) loadInCluster() error {
	restCfg, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("in-cluster config: %w", err)
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("build dynamic client: %w", err)
	}

	disc, err := discovery.NewDiscoveryClientForConfig(restCfg)
	if err != nil {
		return fmt.Errorf("build discovery client: %w", err)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.restConfig = restCfg
	f.dynamic = dyn
	f.discovery = disc
	f.activeContext = "in-cluster"
	f.discCache.invalidate()
	return nil
}

// SwitchContext reloads all clients for the given context.
// Returns an error if the factory was created with in-cluster mode
// (context switching is not supported when running inside a pod).
// After a successful switch, all registered context-switch hooks are called.
func (f *ClientFactory) SwitchContext(ctx string) error {
	if ctx == "" {
		return errors.New("context name must not be empty")
	}
	if f.kubeconfigPath == "" {
		return errors.New("context switching not supported in in-cluster mode")
	}
	if err := f.load(ctx); err != nil {
		return err
	}
	// Notify hooks (e.g. PodRefCache.invalidateAll) without holding the lock.
	f.mu.RLock()
	hooks := make([]func(), len(f.switchHooks))
	copy(hooks, f.switchHooks)
	f.mu.RUnlock()
	for _, h := range hooks {
		h()
	}
	return nil
}

// RegisterContextSwitchHook adds a function to be called after every successful
// SwitchContext call. This is used by MetricsDiscoverer to invalidate its
// PodRefCache when the active context changes (spec 040 — FR-003).
// hook must be safe for concurrent calls.
func (f *ClientFactory) RegisterContextSwitchHook(hook func()) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.switchHooks = append(f.switchHooks, hook)
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

// CachedServerGroupsAndResources returns all API resource lists, using a
// ≥30-second in-memory cache to avoid hammering the API server on every request.
//
// Constitution §XI: "Discovery operations MUST be cached for ≥30 seconds.
// Never call discovery on every request."
func (f *ClientFactory) CachedServerGroupsAndResources() ([]*metav1.APIResourceList, error) {
	if cached, ok := f.discCache.get(); ok {
		return cached, nil
	}

	f.mu.RLock()
	disc := f.discovery
	f.mu.RUnlock()

	_, lists, err := disc.ServerGroupsAndResources()
	if err != nil {
		return nil, fmt.Errorf("server groups and resources: %w", err)
	}
	f.discCache.set(lists)
	return lists, nil
}

// RESTConfig returns a copy of the REST config for the active context.
// The returned config carries TLS credentials and auth token — it can be
// passed to rest.HTTPClientFor to build an authenticated http.Client.
func (f *ClientFactory) RESTConfig() *rest.Config {
	f.mu.RLock()
	defer f.mu.RUnlock()
	// Return a shallow copy so callers cannot mutate the factory's config.
	cfg := *f.restConfig
	return &cfg
}

// ActiveContext returns the name of the currently active context.
func (f *ClientFactory) ActiveContext() string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.activeContext
}

// ListContexts returns all available contexts from the kubeconfig and the active context.
// When running in-cluster (no kubeconfig file), returns a synthetic single-context list
// containing only the in-cluster context.
func (f *ClientFactory) ListContexts() ([]Context, string, error) {
	if f.kubeconfigPath == "" {
		return []Context{{Name: "in-cluster", Cluster: "", User: ""}}, "in-cluster", nil
	}

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

// LabelInstanceName is the kro label key used to associate child resources with
// their parent CR instance. Defined here as a single source of truth so label
// renames only require one change.
const LabelInstanceName = KroGroup + "/instance-name"

// LabelNodeID is the kro label key that maps a child resource back to the RGD
// resource node that produced it (kro.run/node-id).
const LabelNodeID = KroGroup + "/node-id"

// RGDResource is the plural resource name for ResourceGraphDefinitions.
const RGDResource = "resourcegraphdefinitions"

// Placeholder for future GraphRevision resource name — discovered dynamically.
// When kro adds GraphRevision the discovery client will find it automatically.
const GraphRevisionResource = "graphrevisions"
