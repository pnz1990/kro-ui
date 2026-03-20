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
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
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

	f := &ClientFactory{kubeconfigPath: kubeconfigPath, activeContext: context}
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

	rawCfg, err := cfg.RawConfig()
	if err != nil {
		return fmt.Errorf("load raw kubeconfig: %w", err)
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
func (f *ClientFactory) SwitchContext(ctx string) error {
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

// ListContexts returns all available contexts from the kubeconfig.
func (f *ClientFactory) ListContexts() ([]Context, string, error) {
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: f.kubeconfigPath}
	rawCfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules, &clientcmd.ConfigOverrides{},
	).RawConfig()
	if err != nil {
		return nil, "", err
	}

	var contexts []Context
	for name, ctx := range rawCfg.Contexts {
		contexts = append(contexts, Context{
			Name:    name,
			Cluster: ctx.Cluster,
			User:    ctx.AuthInfo,
		})
	}
	return contexts, rawCfg.CurrentContext, nil
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

// ignoring unused import warning
var _ = clientcmdapi.Config{}
