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
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
