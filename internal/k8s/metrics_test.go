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
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// ── Stubs ─────────────────────────────────────────────────────────────────────

// stubDynamicForMetrics is a minimal dynamic.Interface stub that routes Resource()
// calls to per-GVR stub implementations.
type stubDynamicForMetrics struct {
	resources map[schema.GroupVersionResource]*stubNSResourceForMetrics
}

func newStubDynamicMetrics() *stubDynamicForMetrics {
	return &stubDynamicForMetrics{
		resources: make(map[schema.GroupVersionResource]*stubNSResourceForMetrics),
	}
}

func (s *stubDynamicForMetrics) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	if r, ok := s.resources[gvr]; ok {
		return r
	}
	return &stubNSResourceForMetrics{listErr: fmt.Errorf("unknown GVR %v", gvr)}
}

// stubNSResourceForMetrics implements dynamic.NamespaceableResourceInterface.
type stubNSResourceForMetrics struct {
	nsItems      map[string][]unstructured.Unstructured
	clusterItems []unstructured.Unstructured
	listErr      error
}

func (s *stubNSResourceForMetrics) Namespace(ns string) dynamic.ResourceInterface {
	return &stubResourceForMetrics{
		items:   s.nsItems[ns],
		listErr: s.listErr,
	}
}

func (s *stubNSResourceForMetrics) List(_ context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return &unstructured.UnstructuredList{Items: s.clusterItems}, nil
}

func (s *stubNSResourceForMetrics) Get(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *stubNSResourceForMetrics) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubNSResourceForMetrics) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only")
}

// stubResourceForMetrics implements dynamic.ResourceInterface (namespaced).
type stubResourceForMetrics struct {
	items   []unstructured.Unstructured
	listErr error
}

func (s *stubResourceForMetrics) List(_ context.Context, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return &unstructured.UnstructuredList{Items: s.items}, nil
}

func (s *stubResourceForMetrics) Get(_ context.Context, _ string, _ metav1.GetOptions, _ ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *stubResourceForMetrics) Create(context.Context, *unstructured.Unstructured, metav1.CreateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) Update(context.Context, *unstructured.Unstructured, metav1.UpdateOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) UpdateStatus(context.Context, *unstructured.Unstructured, metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) Delete(context.Context, string, metav1.DeleteOptions, ...string) error {
	panic("read-only")
}
func (s *stubResourceForMetrics) DeleteCollection(context.Context, metav1.DeleteOptions, metav1.ListOptions) error {
	panic("read-only")
}
func (s *stubResourceForMetrics) Watch(context.Context, metav1.ListOptions) (watch.Interface, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) Patch(context.Context, string, types.PatchType, []byte, metav1.PatchOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) Apply(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions, ...string) (*unstructured.Unstructured, error) {
	panic("read-only")
}
func (s *stubResourceForMetrics) ApplyStatus(context.Context, string, *unstructured.Unstructured, metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	panic("read-only")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// makePod creates an unstructured pod with the given name, namespace, and phase.
func makePod(name, ns, phase string) unstructured.Unstructured {
	return unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "v1",
		"kind":       "Pod",
		"metadata": map[string]any{
			"name":      name,
			"namespace": ns,
		},
		"status": map[string]any{
			"phase": phase,
		},
	}}
}

// ── TestDiscoverKroPod (T012) ──────────────────────────────────────────────────

func TestDiscoverKroPod(t *testing.T) {
	type build struct {
		nsItems      map[string][]unstructured.Unstructured
		clusterItems []unstructured.Unstructured
	}
	type check struct {
		wantFound     bool
		wantNamespace string
		wantPodName   string
	}

	tests := []struct {
		name  string
		build build
		check check
	}{
		{
			name: "pod in kro-system with first selector — found immediately",
			build: build{
				nsItems: map[string][]unstructured.Unstructured{
					"kro-system": {makePod("kro-pod-0", "kro-system", "Running")},
				},
			},
			check: check{wantFound: true, wantNamespace: "kro-system", wantPodName: "kro-pod-0"},
		},
		{
			name: "no pods in kro-system, pod found in kro namespace",
			build: build{
				nsItems: map[string][]unstructured.Unstructured{
					"kro": {makePod("kro-manager", "kro", "Running")},
				},
			},
			check: check{wantFound: true, wantNamespace: "kro", wantPodName: "kro-manager"},
		},
		{
			name: "no pods in known namespaces, pod found via cluster-scoped list",
			build: build{
				nsItems:      map[string][]unstructured.Unstructured{},
				clusterItems: []unstructured.Unstructured{makePod("kro-pod-0", "other-ns", "Running")},
			},
			check: check{wantFound: true, wantNamespace: "other-ns", wantPodName: "kro-pod-0"},
		},
		{
			name: "Running pod preferred over Pending pod in same namespace",
			build: build{
				nsItems: map[string][]unstructured.Unstructured{
					"kro-system": {
						makePod("kro-pod-pending", "kro-system", "Pending"),
						makePod("kro-pod-running", "kro-system", "Running"),
					},
				},
			},
			check: check{wantFound: true, wantNamespace: "kro-system", wantPodName: "kro-pod-running"},
		},
		{
			name: "no Running pod — falls back to first pod in any phase",
			build: build{
				nsItems: map[string][]unstructured.Unstructured{
					"kro-system": {makePod("kro-pod-pending", "kro-system", "Pending")},
				},
			},
			check: check{wantFound: true, wantNamespace: "kro-system", wantPodName: "kro-pod-pending"},
		},
		{
			name:  "no pods anywhere — not found",
			build: build{nsItems: map[string][]unstructured.Unstructured{}},
			check: check{wantFound: false},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dyn := newStubDynamicMetrics()
			dyn.resources[podGVR] = &stubNSResourceForMetrics{
				nsItems:      tt.build.nsItems,
				clusterItems: tt.build.clusterItems,
			}

			ref, found := discoverKroPod(context.Background(), dyn)
			assert.Equal(t, tt.check.wantFound, found)
			if tt.check.wantFound {
				assert.Equal(t, tt.check.wantNamespace, ref.Namespace, "Namespace")
				assert.Equal(t, tt.check.wantPodName, ref.PodName, "PodName")
			}
		})
	}
}

// ── TestScrapeViaProxy (T013) ──────────────────────────────────────────────────

const metricsProxyBody = `# HELP dynamic_controller_watch_count Active informers
# TYPE dynamic_controller_watch_count gauge
dynamic_controller_watch_count 7
# HELP dynamic_controller_gvr_count GVRs managed
# TYPE dynamic_controller_gvr_count gauge
dynamic_controller_gvr_count 2
workqueue_depth{name="dynamic-controller-queue"} 3
`

// kro v0.8.5 removed dynamic_controller_watch_count in favour of
// dynamic_controller_handler_count_total{type="child"}.
const metricsProxyBodyV085 = `# HELP dynamic_controller_gvr_count GVRs managed
# TYPE dynamic_controller_gvr_count gauge
dynamic_controller_gvr_count 22
# HELP dynamic_controller_handler_count_total Active handler count
# TYPE dynamic_controller_handler_count_total gauge
dynamic_controller_handler_count_total{type="child"} 37
dynamic_controller_handler_count_total{type="parent"} 22
workqueue_depth{name="dynamic-controller-queue"} 0
`

func TestScrapeViaProxy(t *testing.T) {
	int64p := func(v int64) *int64 { return &v }

	ref := PodRef{Namespace: "kro-system", PodName: "kro-pod-0"}
	expectedPath := "/api/v1/namespaces/" + ref.Namespace + "/pods/" + ref.PodName + "/proxy/metrics"

	type build struct {
		hostSuffix       string // e.g. "/" to test trailing slash trimming
		upstreamCode     int
		upstreamBody     string
		forceUnreachable bool
	}
	type check struct {
		wantErr        bool
		wantErrBadGW   bool
		wantErrReach   bool
		wantWatchCount *int64
		wantGVRCount   *int64
		wantWQDepth    *int64
	}

	tests := []struct {
		name  string
		build build
		check check
	}{
		{
			name:  "kro v0.8.5 metrics — handler_count_total fallback for watch count",
			build: build{upstreamCode: http.StatusOK, upstreamBody: metricsProxyBodyV085},
			check: check{wantWatchCount: int64p(37), wantGVRCount: int64p(22), wantWQDepth: int64p(0)},
		},
		{
			name:  "200 response parses metrics correctly",
			build: build{upstreamCode: http.StatusOK, upstreamBody: metricsProxyBody},
			check: check{wantWatchCount: int64p(7), wantGVRCount: int64p(2), wantWQDepth: int64p(3)},
		},
		{
			name:  "Host with trailing slash — URL still correct",
			build: build{upstreamCode: http.StatusOK, upstreamBody: metricsProxyBody, hostSuffix: "/"},
			check: check{wantWatchCount: int64p(7)},
		},
		{
			name:  "500 response — ErrMetricsBadGateway",
			build: build{upstreamCode: http.StatusInternalServerError, upstreamBody: ""},
			check: check{wantErr: true, wantErrBadGW: true},
		},
		{
			name:  "403 response — ErrMetricsBadGateway",
			build: build{upstreamCode: http.StatusForbidden, upstreamBody: ""},
			check: check{wantErr: true, wantErrBadGW: true},
		},
		{
			name:  "unreachable address — ErrMetricsUnreachable",
			build: build{forceUnreachable: true},
			check: check{wantErr: true, wantErrReach: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var restCfg *rest.Config

			if tt.build.forceUnreachable {
				restCfg = &rest.Config{Host: "http://127.0.0.1:1"}
			} else {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, expectedPath, r.URL.Path, "proxy path must match")
					w.WriteHeader(tt.build.upstreamCode)
					_, _ = w.Write([]byte(tt.build.upstreamBody))
				}))
				t.Cleanup(srv.Close)
				restCfg = &rest.Config{Host: srv.URL + tt.build.hostSuffix}
			}

			result, err := scrapeViaProxy(context.Background(), restCfg, ref)

			if tt.check.wantErr {
				require.Error(t, err)
				if tt.check.wantErrBadGW {
					var e *ErrMetricsBadGateway
					assert.True(t, errors.As(err, &e), "expected ErrMetricsBadGateway, got %T", err)
				}
				if tt.check.wantErrReach {
					var e *ErrMetricsUnreachable
					assert.True(t, errors.As(err, &e), "expected ErrMetricsUnreachable, got %T", err)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			if tt.check.wantWatchCount != nil {
				require.NotNil(t, result.WatchCount)
				assert.Equal(t, *tt.check.wantWatchCount, *result.WatchCount, "WatchCount")
			}
			if tt.check.wantGVRCount != nil {
				require.NotNil(t, result.GVRCount)
				assert.Equal(t, *tt.check.wantGVRCount, *result.GVRCount, "GVRCount")
			}
			if tt.check.wantWQDepth != nil {
				require.NotNil(t, result.WorkqueueDepth)
				assert.Equal(t, *tt.check.wantWQDepth, *result.WorkqueueDepth, "WorkqueueDepth")
			}
			assert.False(t, result.ScrapedAt.IsZero(), "ScrapedAt must be set")
		})
	}
}

// ── TestPodRefCache (T014) ─────────────────────────────────────────────────────

func TestPodRefCache(t *testing.T) {
	t.Run("cache miss when empty — returns false", func(t *testing.T) {
		c := NewPodRefCache(60 * time.Second)
		_, ok := c.get("ctx-a")
		assert.False(t, ok)
	})

	t.Run("cache hit within TTL — returns true with correct ref", func(t *testing.T) {
		c := NewPodRefCache(60 * time.Second)
		ref := PodRef{Namespace: "kro-system", PodName: "kro-pod-0"}
		c.set("ctx-a", ref)

		got, ok := c.get("ctx-a")
		require.True(t, ok)
		assert.Equal(t, ref, got)
	})

	t.Run("expired entry returns false", func(t *testing.T) {
		c := NewPodRefCache(1 * time.Millisecond)
		c.set("ctx-a", PodRef{Namespace: "kro-system", PodName: "kro-pod-0"})
		time.Sleep(5 * time.Millisecond)
		_, ok := c.get("ctx-a")
		assert.False(t, ok, "entry should be expired")
	})

	t.Run("invalidate removes specific entry, leaves others intact", func(t *testing.T) {
		c := NewPodRefCache(60 * time.Second)
		c.set("ctx-a", PodRef{Namespace: "kro-system", PodName: "pod-a"})
		c.set("ctx-b", PodRef{Namespace: "kro-system", PodName: "pod-b"})

		c.invalidate("ctx-a")

		_, okA := c.get("ctx-a")
		assert.False(t, okA, "ctx-a must be evicted")
		_, okB := c.get("ctx-b")
		assert.True(t, okB, "ctx-b must remain")
	})

	t.Run("invalidateAll clears all entries", func(t *testing.T) {
		c := NewPodRefCache(60 * time.Second)
		c.set("ctx-a", PodRef{Namespace: "kro-system", PodName: "pod-a"})
		c.set("ctx-b", PodRef{Namespace: "kro-system", PodName: "pod-b"})

		c.invalidateAll()

		_, okA := c.get("ctx-a")
		assert.False(t, okA)
		_, okB := c.get("ctx-b")
		assert.False(t, okB)
	})

	t.Run("different context name — cache miss", func(t *testing.T) {
		c := NewPodRefCache(60 * time.Second)
		c.set("ctx-a", PodRef{Namespace: "kro-system", PodName: "pod-a"})
		_, ok := c.get("ctx-b")
		assert.False(t, ok)
	})
}
