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
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	fakediscovery "k8s.io/client-go/discovery/fake"
	fakeDynamic "k8s.io/client-go/dynamic/fake"
	kubetesting "k8s.io/client-go/testing"
)

// ── TestContextClients_Accessors (T020) ───────────────────────────────────────

// TestContextClients_Accessors covers Dynamic(), Discovery(), and
// CachedServerGroupsAndResources() on a ContextClients built directly
// (avoiding a real kubeconfig and real cluster call).
func TestContextClients_Accessors(t *testing.T) {
	t.Run("Dynamic returns the injected dynamic client", func(t *testing.T) {
		dyn := fakeDynamic.NewSimpleDynamicClient(runtime.NewScheme())
		cc := &ContextClients{dyn: dyn}
		assert.Same(t, dyn, cc.Dynamic())
	})

	t.Run("Discovery returns the injected discovery client", func(t *testing.T) {
		fakeDisc := &fakediscovery.FakeDiscovery{Fake: &kubetesting.Fake{}}
		cc := &ContextClients{disc: fakeDisc}
		assert.Same(t, fakeDisc, cc.Discovery())
	})

	t.Run("CachedServerGroupsAndResources — cache hit — no discovery call", func(t *testing.T) {
		fakeDisc := &fakediscovery.FakeDiscovery{Fake: &kubetesting.Fake{}}
		lists := []*metav1.APIResourceList{
			{
				GroupVersion: "apps/v1",
				APIResources: []metav1.APIResource{{Name: "deployments", Kind: "Deployment"}},
			},
		}
		cc := &ContextClients{disc: fakeDisc}
		// Prime the cache directly.
		cc.discCache.set(lists)

		got, err := cc.CachedServerGroupsAndResources()
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, "apps/v1", got[0].GroupVersion)
		// No discovery calls were made.
		assert.Empty(t, fakeDisc.Actions(), "cache hit must not call discovery")
	})

	t.Run("CachedServerGroupsAndResources — cache miss — calls discovery and caches result", func(t *testing.T) {
		fakeDisc := &fakediscovery.FakeDiscovery{Fake: &kubetesting.Fake{}}
		fakeDisc.Resources = []*metav1.APIResourceList{
			{
				GroupVersion: "v1",
				APIResources: []metav1.APIResource{{Name: "pods", Kind: "Pod"}},
			},
		}
		cc := &ContextClients{disc: fakeDisc}

		got, err := cc.CachedServerGroupsAndResources()
		require.NoError(t, err)
		require.NotEmpty(t, got, "must return at least one resource list")

		// Second call must hit the cache (same number of discovery actions).
		actionsAfterFirst := len(fakeDisc.Actions())
		_, err = cc.CachedServerGroupsAndResources()
		require.NoError(t, err)
		assert.Equal(t, actionsAfterFirst, len(fakeDisc.Actions()), "second call must use cache")
	})
}

// ── TestBuildContextClient_ErrorPaths (T021) ──────────────────────────────────

// TestBuildContextClient_ErrorPaths covers the error returns from BuildContextClient
// without attempting to connect to a real cluster.
func TestBuildContextClient_ErrorPaths(t *testing.T) {
	t.Run("missing kubeconfig file returns error", func(t *testing.T) {
		_, err := BuildContextClient("/nonexistent/kubeconfig", "")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "build rest config")
	})

	t.Run("invalid kubeconfig YAML returns error", func(t *testing.T) {
		dir := t.TempDir()
		path := dir + "/kubeconfig"
		require.NoError(t, writeFile(t, path, "not: valid: kubeconfig: yaml: :::"))

		_, err := BuildContextClient(path, "")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "build rest config")
	})

	t.Run("valid kubeconfig — builds client successfully", func(t *testing.T) {
		path := writeTestKubeconfigForFleet(t)
		cc, err := BuildContextClient(path, "dev")
		require.NoError(t, err)
		assert.NotNil(t, cc.Dynamic())
		assert.NotNil(t, cc.Discovery())
	})

	t.Run("valid kubeconfig — empty context uses current context", func(t *testing.T) {
		path := writeTestKubeconfigForFleet(t)
		cc, err := BuildContextClient(path, "")
		require.NoError(t, err)
		assert.NotNil(t, cc)
	})
}

// ── TestKubeconfigPath (T022) ─────────────────────────────────────────────────

// TestKubeconfigPath covers ClientFactory.KubeconfigPath().
func TestKubeconfigPath(t *testing.T) {
	path := writeTestKubeconfigForFleet(t)
	f, err := NewClientFactory(path, "dev")
	require.NoError(t, err)
	assert.Equal(t, path, f.KubeconfigPath())
}

// ── TestBuildRESTConfig_ErrorPaths (T023) ─────────────────────────────────────

// TestBuildRESTConfig_ErrorPaths covers buildRESTConfig() error and success paths.
func TestBuildRESTConfig_ErrorPaths(t *testing.T) {
	t.Run("missing kubeconfig returns error", func(t *testing.T) {
		_, err := buildRESTConfig("/nonexistent/path", "")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "build rest config")
	})

	t.Run("valid kubeconfig with explicit context returns REST config", func(t *testing.T) {
		path := writeTestKubeconfigForFleet(t)
		cfg, err := buildRESTConfig(path, "dev")
		require.NoError(t, err)
		assert.Contains(t, cfg.Host, "dev.example.com")
	})

	t.Run("valid kubeconfig with empty context uses current context", func(t *testing.T) {
		path := writeTestKubeconfigForFleet(t)
		cfg, err := buildRESTConfig(path, "")
		require.NoError(t, err)
		assert.NotEmpty(t, cfg.Host)
	})

	t.Run("valid kubeconfig with second context returns correct server", func(t *testing.T) {
		path := writeTestKubeconfigForFleet(t)
		cfg, err := buildRESTConfig(path, "prod")
		require.NoError(t, err)
		assert.Contains(t, cfg.Host, "prod.example.com")
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// writeTestKubeconfigForFleet writes the shared test kubeconfig (from client_test.go)
// to a temp file. Uses the same testKubeconfig constant.
func writeTestKubeconfigForFleet(t *testing.T) string {
	t.Helper()
	path := writeTestKubeconfig(t)
	return path
}

// writeFile is a helper that writes content to path for tests.
func writeFile(t *testing.T, path, content string) error {
	t.Helper()
	return os.WriteFile(path, []byte(content), 0600)
}
