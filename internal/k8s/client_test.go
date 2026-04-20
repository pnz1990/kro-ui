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
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakediscovery "k8s.io/client-go/discovery/fake"
	kubetesting "k8s.io/client-go/testing"
)

// testKubeconfig is a minimal kubeconfig with two contexts for testing.
const testKubeconfig = `apiVersion: v1
kind: Config
current-context: dev
clusters:
- cluster:
    server: https://dev.example.com
  name: dev-cluster
- cluster:
    server: https://prod.example.com
  name: prod-cluster
contexts:
- context:
    cluster: dev-cluster
    user: dev-user
  name: dev
- context:
    cluster: prod-cluster
    user: prod-user
  name: prod
users:
- name: dev-user
  user:
    token: dev-token
- name: prod-user
  user:
    token: prod-token
`

// writeTestKubeconfig writes the test kubeconfig to a temp file and returns
// its path. The file is automatically cleaned up when the test finishes.
func writeTestKubeconfig(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "kubeconfig")
	err := os.WriteFile(path, []byte(testKubeconfig), 0600)
	require.NoError(t, err)
	return path
}

func TestNewClientFactory(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (string, string)
		check func(t *testing.T, f *ClientFactory, err error)
	}{
		{
			name: "creates factory with default context",
			build: func(t *testing.T) (string, string) {
				t.Helper()
				return writeTestKubeconfig(t), ""
			},
			check: func(t *testing.T, f *ClientFactory, err error) {
				t.Helper()
				require.NoError(t, err)
				require.NotNil(t, f)
				assert.Equal(t, "dev", f.ActiveContext())
			},
		},
		{
			name: "creates factory with specified context",
			build: func(t *testing.T) (string, string) {
				t.Helper()
				return writeTestKubeconfig(t), "prod"
			},
			check: func(t *testing.T, f *ClientFactory, err error) {
				t.Helper()
				require.NoError(t, err)
				require.NotNil(t, f)
				assert.Equal(t, "prod", f.ActiveContext())
			},
		},
		{
			name: "fails for nonexistent kubeconfig",
			build: func(t *testing.T) (string, string) {
				t.Helper()
				return "/tmp/does-not-exist-kubeconfig-test", ""
			},
			check: func(t *testing.T, f *ClientFactory, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Nil(t, f)
			},
		},
		{
			name: "fails for unknown context",
			build: func(t *testing.T) (string, string) {
				t.Helper()
				return writeTestKubeconfig(t), "nonexistent"
			},
			check: func(t *testing.T, f *ClientFactory, err error) {
				t.Helper()
				require.Error(t, err)
				assert.Contains(t, err.Error(), "not found")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kubeconfigPath, ctx := tt.build(t)
			f, err := NewClientFactory(kubeconfigPath, ctx)
			tt.check(t, f, err)
		})
	}
}

func TestListContexts(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *ClientFactory
		check func(t *testing.T, contexts []Context, active string, err error)
	}{
		{
			name: "returns all contexts from kubeconfig",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "")
				require.NoError(t, err)
				return f
			},
			check: func(t *testing.T, contexts []Context, active string, err error) {
				t.Helper()
				require.NoError(t, err)
				assert.Len(t, contexts, 2)
				names := make([]string, len(contexts))
				for i, c := range contexts {
					names[i] = c.Name
				}
				assert.Contains(t, names, "dev")
				assert.Contains(t, names, "prod")
				assert.Equal(t, "dev", active)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := tt.build(t)
			contexts, active, err := f.ListContexts()
			tt.check(t, contexts, active, err)
		})
	}
}

func TestSwitchContext(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *ClientFactory
		check func(t *testing.T, f *ClientFactory)
	}{
		{
			name: "switches to valid context",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
				require.NoError(t, err)
				return f
			},
			check: func(t *testing.T, f *ClientFactory) {
				t.Helper()
				err := f.SwitchContext("prod")
				require.NoError(t, err)
				assert.Equal(t, "prod", f.ActiveContext())
			},
		},
		{
			name: "returns error for empty context",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
				require.NoError(t, err)
				return f
			},
			check: func(t *testing.T, f *ClientFactory) {
				t.Helper()
				err := f.SwitchContext("")
				require.Error(t, err)
				assert.Contains(t, err.Error(), "must not be empty")
				// Active context should be unchanged.
				assert.Equal(t, "dev", f.ActiveContext())
			},
		},
		{
			name: "returns error for unknown context",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
				require.NoError(t, err)
				return f
			},
			check: func(t *testing.T, f *ClientFactory) {
				t.Helper()
				err := f.SwitchContext("nonexistent")
				require.Error(t, err)
				assert.Contains(t, err.Error(), "not found")
				// Active context should be unchanged.
				assert.Equal(t, "dev", f.ActiveContext())
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := tt.build(t)
			tt.check(t, f)
		})
	}
}

func TestConcurrentAccess(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)

	// Run concurrent reads and switches to verify no data races.
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(3)
		go func() {
			defer wg.Done()
			_ = f.ActiveContext()
		}()
		go func() {
			defer wg.Done()
			_, _, _ = f.ListContexts()
		}()
		go func() {
			defer wg.Done()
			// Alternate between valid contexts.
			_ = f.SwitchContext("prod")
			_ = f.SwitchContext("dev")
		}()
	}
	wg.Wait()

	// After all concurrent ops, active context should be one of the two valid ones.
	active := f.ActiveContext()
	assert.Contains(t, []string{"dev", "prod"}, active)
}

func TestInClusterFallback(t *testing.T) {
	t.Run("returns clear error when not running in a pod", func(t *testing.T) {
		// Point HOME to a temp dir so ~/.kube/config doesn't exist,
		// forcing the code past the kubeconfig fallback into the in-cluster path.
		t.Setenv("HOME", t.TempDir())
		t.Setenv("KUBECONFIG", "")
		t.Setenv("KUBERNETES_SERVICE_HOST", "")
		t.Setenv("KUBERNETES_SERVICE_PORT", "")

		_, err := NewClientFactory("", "")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "in-cluster unavailable")
	})
}

func TestInClusterModeListContexts(t *testing.T) {
	// Simulate in-cluster mode by constructing a factory with no kubeconfig path.
	f := &ClientFactory{
		kubeconfigPath: "",
		activeContext:  "in-cluster",
	}

	contexts, active, err := f.ListContexts()
	require.NoError(t, err)
	assert.Equal(t, "in-cluster", active)
	require.Len(t, contexts, 1)
	assert.Equal(t, "in-cluster", contexts[0].Name)
}

func TestInClusterModeSwitchContext(t *testing.T) {
	f := &ClientFactory{
		kubeconfigPath: "",
		activeContext:  "in-cluster",
	}

	err := f.SwitchContext("some-context")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "in-cluster mode")
	// Active context unchanged.
	assert.Equal(t, "in-cluster", f.ActiveContext())
}

// ── Accessor method tests ─────────────────────────────────────────────────────

// TestDynamic verifies that Dynamic() returns a non-nil dynamic client after
// a successful NewClientFactory call.
func TestDynamic(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)
	assert.NotNil(t, f.Dynamic(), "Dynamic() must return a non-nil client")
}

// TestDiscovery verifies that Discovery() returns a non-nil discovery client
// after a successful NewClientFactory call.
func TestDiscovery(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)
	assert.NotNil(t, f.Discovery(), "Discovery() must return a non-nil client")
}

// TestRESTConfig verifies that RESTConfig() returns a copy of the REST config
// and that mutating the returned copy does not affect the factory's config.
func TestRESTConfig(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)

	cfg := f.RESTConfig()
	require.NotNil(t, cfg)

	// Mutate the returned copy — the factory's config must be unaffected.
	original := cfg.Host
	cfg.Host = "https://mutated.example.com"
	assert.Equal(t, original, f.RESTConfig().Host,
		"RESTConfig() must return a copy — mutating it must not affect the factory")
}

// TestRegisterContextSwitchHook verifies that registered hooks are called after
// a successful SwitchContext and are not called when SwitchContext fails.
func TestRegisterContextSwitchHook(t *testing.T) {
	tests := []struct {
		name      string
		build     func(t *testing.T) *ClientFactory
		switchTo  string
		wantCalls int
	}{
		{
			name: "hook called on successful context switch",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
				require.NoError(t, err)
				return f
			},
			switchTo:  "prod",
			wantCalls: 1,
		},
		{
			name: "hook not called on failed context switch",
			build: func(t *testing.T) *ClientFactory {
				t.Helper()
				f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
				require.NoError(t, err)
				return f
			},
			switchTo:  "nonexistent",
			wantCalls: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := tt.build(t)

			var mu sync.Mutex
			calls := 0
			f.RegisterContextSwitchHook(func() {
				mu.Lock()
				defer mu.Unlock()
				calls++
			})

			_ = f.SwitchContext(tt.switchTo)

			mu.Lock()
			got := calls
			mu.Unlock()
			assert.Equal(t, tt.wantCalls, got)
		})
	}
}

// TestRegisterContextSwitchHook_MultipleHooks verifies that all registered hooks
// are called when there are multiple hooks registered.
func TestRegisterContextSwitchHook_MultipleHooks(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)

	var mu sync.Mutex
	total := 0
	for i := 0; i < 3; i++ {
		f.RegisterContextSwitchHook(func() {
			mu.Lock()
			defer mu.Unlock()
			total++
		})
	}

	err = f.SwitchContext("prod")
	require.NoError(t, err)

	mu.Lock()
	got := total
	mu.Unlock()
	assert.Equal(t, 3, got, "all registered hooks must be called")
}

// ── discCache (apiResourceCache) tests ───────────────────────────────────────

// TestDiscCache_GetSetMissHit verifies the cache miss-then-hit behaviour.
func TestDiscCache_GetSetMissHit(t *testing.T) {
	var c apiResourceCache

	// Miss: cache is empty.
	lists, ok := c.get()
	assert.False(t, ok, "empty cache must be a miss")
	assert.Nil(t, lists)

	// Populate the cache.
	want := []*metav1.APIResourceList{
		{GroupVersion: "v1"},
		{GroupVersion: "apps/v1"},
	}
	c.set(want)

	// Hit: cache is populated and not yet expired.
	got, ok := c.get()
	assert.True(t, ok, "populated cache must be a hit")
	require.Len(t, got, 2)
	assert.Equal(t, "v1", got[0].GroupVersion)
	assert.Equal(t, "apps/v1", got[1].GroupVersion)
}

// TestDiscCache_InvalidateClearsList verifies that invalidate() causes get() to
// return a cache miss.
func TestDiscCache_InvalidateClearsList(t *testing.T) {
	var c apiResourceCache

	c.set([]*metav1.APIResourceList{{GroupVersion: "v1"}})

	// Sanity: cache is hot.
	_, ok := c.get()
	require.True(t, ok)

	c.invalidate()

	_, ok = c.get()
	assert.False(t, ok, "cache must be a miss after invalidate()")
}

// ── CachedServerGroupsAndResources tests ─────────────────────────────────────

// newFactoryWithFakeDiscovery creates a ClientFactory wired with a FakeDiscovery
// that returns the supplied resource lists. This avoids network calls and allows
// hermetic unit-testing of the caching layer.
func newFactoryWithFakeDiscovery(t *testing.T, resources []*metav1.APIResourceList) *ClientFactory {
	t.Helper()
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)
	fake := &kubetesting.Fake{}
	fake.Resources = resources
	f.discovery = &fakediscovery.FakeDiscovery{Fake: fake}
	return f
}

// TestCachedServerGroupsAndResources_CacheMissAndHit verifies that:
//   - First call (cache miss) invokes the discovery client and populates the cache.
//   - Second call (cache hit) returns the same data without invoking discovery again.
func TestCachedServerGroupsAndResources_CacheMissAndHit(t *testing.T) {
	want := []*metav1.APIResourceList{
		{GroupVersion: "v1"},
		{GroupVersion: "apps/v1"},
	}
	f := newFactoryWithFakeDiscovery(t, want)

	// First call — cache miss, discovery invoked.
	got1, err := f.CachedServerGroupsAndResources()
	require.NoError(t, err)
	require.Len(t, got1, 2)
	assert.Equal(t, "v1", got1[0].GroupVersion)

	// Second call — cache hit; FakeDiscovery resources still returns same data
	// but the cache prevents another call to discovery.
	got2, err := f.CachedServerGroupsAndResources()
	require.NoError(t, err)
	assert.Equal(t, got1, got2, "cache hit must return identical slice")
}

// TestCachedServerGroupsAndResources_ReturnsErrorOnDiscoveryFailure verifies
// that CachedServerGroupsAndResources propagates errors from the discovery client
// and does not cache the failed result.
func TestCachedServerGroupsAndResources_ReturnsErrorOnDiscoveryFailure(t *testing.T) {
	f, err := NewClientFactory(writeTestKubeconfig(t), "dev")
	require.NoError(t, err)
	// Wire a FakeDiscovery with a reaction that always errors.
	fake := &fakediscovery.FakeDiscovery{
		Fake: &kubetesting.Fake{},
	}
	fake.AddReactor("get", "group", func(_ kubetesting.Action) (bool, runtime.Object, error) {
		return true, nil, fmt.Errorf("discovery server unavailable")
	})
	f.discovery = fake

	_, err = f.CachedServerGroupsAndResources()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "server groups and resources")

	// Cache must remain empty after an error — subsequent calls retry discovery.
	_, ok := f.discCache.get()
	assert.False(t, ok, "failed discovery must not populate the cache")
}

// TestCachedServerGroupsAndResources_CacheInvalidatedOnContextSwitch verifies
// that switching context clears the discovery cache so the new cluster is
// discovered fresh on the next call.
func TestCachedServerGroupsAndResources_CacheInvalidatedOnContextSwitch(t *testing.T) {
	want := []*metav1.APIResourceList{{GroupVersion: "v1"}}
	f := newFactoryWithFakeDiscovery(t, want)

	// Warm the cache.
	_, err := f.CachedServerGroupsAndResources()
	require.NoError(t, err)
	_, ok := f.discCache.get()
	require.True(t, ok, "cache must be warm before switch")

	// Switch context — this must invalidate the cache.
	require.NoError(t, f.SwitchContext("prod"))

	_, ok = f.discCache.get()
	assert.False(t, ok, "cache must be cold after context switch")
}
