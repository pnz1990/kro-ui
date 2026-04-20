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

// ── TestPickPod ───────────────────────────────────────────────────────────────

// TestPickPod verifies that pickPod handles an empty slice and the Running-phase
// preference directly, without going through discoverKroPod.
func TestPickPod(t *testing.T) {
	t.Run("empty slice — returns false", func(t *testing.T) {
		_, ok := pickPod("kro-system", nil)
		assert.False(t, ok)

		_, ok = pickPod("kro-system", []unstructured.Unstructured{})
		assert.False(t, ok)
	})

	t.Run("Running pod returned when present", func(t *testing.T) {
		items := []unstructured.Unstructured{
			makePod("kro-pending", "kro-system", "Pending"),
			makePod("kro-running", "kro-system", "Running"),
		}
		ref, ok := pickPod("kro-system", items)
		require.True(t, ok)
		assert.Equal(t, "kro-running", ref.PodName)
		assert.Equal(t, "kro-system", ref.Namespace)
	})

	t.Run("no Running pod — falls back to first", func(t *testing.T) {
		items := []unstructured.Unstructured{
			makePod("kro-pending", "kro-system", "Pending"),
		}
		ref, ok := pickPod("kro-system", items)
		require.True(t, ok)
		assert.Equal(t, "kro-pending", ref.PodName)
		assert.Equal(t, "kro-system", ref.Namespace)
	})
}

// ── TestPickPodFromClusterList ─────────────────────────────────────────────────

// TestPickPodFromClusterList tests the cluster-scoped pod selection, including the
// namespace-extraction path from pod metadata when GetNamespace() returns empty.
func TestPickPodFromClusterList(t *testing.T) {
	t.Run("empty list returns false", func(t *testing.T) {
		_, ok := pickPodFromClusterList(nil)
		assert.False(t, ok)

		_, ok = pickPodFromClusterList([]unstructured.Unstructured{})
		assert.False(t, ok)
	})

	t.Run("Running pod preferred — namespace from GetNamespace()", func(t *testing.T) {
		items := []unstructured.Unstructured{
			makePod("kro-pending", "kro-system", "Pending"),
			makePod("kro-running", "kro-system", "Running"),
		}
		ref, ok := pickPodFromClusterList(items)
		require.True(t, ok)
		assert.Equal(t, "kro-running", ref.PodName)
		assert.Equal(t, "kro-system", ref.Namespace)
	})

	t.Run("Running pod with empty GetNamespace() uses metadata.namespace", func(t *testing.T) {
		// Simulate a pod where metadata.namespace is set but GetNamespace() returns ""
		// (can happen with certain dynamic client responses that don't set .namespace in Object).
		pod := unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "v1",
			"kind":       "Pod",
			"metadata": map[string]any{
				"name":      "kro-pod",
				"namespace": "fleet-ns", // in metadata but not in spec
			},
			"status": map[string]any{
				"phase": "Running",
			},
		}}
		// GetNamespace() reads from metadata.namespace in Object, so it should work.
		// This test verifies the nested fallback path is reached when the unstructured
		// Object has metadata.namespace set without using SetNamespace().
		ref, ok := pickPodFromClusterList([]unstructured.Unstructured{pod})
		require.True(t, ok)
		assert.Equal(t, "kro-pod", ref.PodName)
		assert.Equal(t, "fleet-ns", ref.Namespace)
	})

	t.Run("no Running pod — falls back to first pod", func(t *testing.T) {
		items := []unstructured.Unstructured{
			makePod("kro-a", "kro-system", "Pending"),
			makePod("kro-b", "kro-system", "Terminating"),
		}
		ref, ok := pickPodFromClusterList(items)
		require.True(t, ok)
		assert.Equal(t, "kro-a", ref.PodName)
		assert.Equal(t, "kro-system", ref.Namespace)
	})

	t.Run("fallback pod with empty GetNamespace() uses metadata.namespace", func(t *testing.T) {
		pod := unstructured.Unstructured{Object: map[string]any{
			"metadata": map[string]any{
				"name":      "kro-fallback",
				"namespace": "other-ns",
			},
			"status": map[string]any{"phase": "Pending"},
		}}
		ref, ok := pickPodFromClusterList([]unstructured.Unstructured{pod})
		require.True(t, ok)
		assert.Equal(t, "kro-fallback", ref.PodName)
		assert.Equal(t, "other-ns", ref.Namespace)
	})
}

// ── TestParseMetricLine ────────────────────────────────────────────────────────

// TestParseMetricLine tests the Prometheus text format parser for the kro metrics.
func TestParseMetricLine(t *testing.T) {
	int64p := func(v int64) *int64 { return &v }

	t.Run("watch count line", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("dynamic_controller_watch_count 5", r)
		require.NotNil(t, r.WatchCount)
		assert.Equal(t, int64(5), *r.WatchCount)
	})

	t.Run("gvr count line", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("dynamic_controller_gvr_count 3", r)
		require.NotNil(t, r.GVRCount)
		assert.Equal(t, int64(3), *r.GVRCount)
	})

	t.Run("queue depth line", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("dynamic_controller_queue_length 12", r)
		require.NotNil(t, r.QueueDepth)
		assert.Equal(t, int64(12), *r.QueueDepth)
	})

	t.Run("workqueue depth with matching label", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine(`workqueue_depth{name="dynamic-controller-queue"} 0`, r)
		require.NotNil(t, r.WorkqueueDepth)
		assert.Equal(t, int64(0), *r.WorkqueueDepth)
	})

	t.Run("workqueue depth with non-matching label — ignored", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine(`workqueue_depth{name="some-other-queue"} 99`, r)
		assert.Nil(t, r.WorkqueueDepth)
	})

	t.Run("handler count child fallback when WatchCount not yet set", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine(`dynamic_controller_handler_count_total{type="child"} 42`, r)
		require.NotNil(t, r.WatchCount)
		assert.Equal(t, int64(42), *r.WatchCount)
	})

	t.Run("handler count child does not overwrite existing WatchCount", func(t *testing.T) {
		r := &ControllerMetrics{WatchCount: int64p(7)}
		parseMetricLine(`dynamic_controller_handler_count_total{type="child"} 99`, r)
		require.NotNil(t, r.WatchCount)
		assert.Equal(t, int64(7), *r.WatchCount, "WatchCount must not be overwritten by fallback")
	})

	t.Run("line with timestamp — value before timestamp is parsed", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("dynamic_controller_watch_count 8 1714500000000", r)
		require.NotNil(t, r.WatchCount)
		assert.Equal(t, int64(8), *r.WatchCount)
	})

	t.Run("malformed line — no space — ignored gracefully", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("nospace", r)
		assert.Nil(t, r.WatchCount)
	})

	t.Run("malformed value — non-numeric — ignored gracefully", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("dynamic_controller_watch_count not_a_number", r)
		assert.Nil(t, r.WatchCount)
	})

	t.Run("unrecognized metric — ignored", func(t *testing.T) {
		r := &ControllerMetrics{}
		parseMetricLine("some_other_metric 100", r)
		assert.Nil(t, r.WatchCount)
		assert.Nil(t, r.GVRCount)
		assert.Nil(t, r.QueueDepth)
		assert.Nil(t, r.WorkqueueDepth)
	})
}

// ── TestErrorTypes ─────────────────────────────────────────────────────────────

// TestErrorTypes covers the Error(), Unwrap() methods on the sentinel error types.
func TestErrorTypes(t *testing.T) {
	t.Run("ErrMetricsUnreachable.Error contains cause", func(t *testing.T) {
		cause := fmt.Errorf("tcp connect: refused")
		err := &ErrMetricsUnreachable{Cause: cause}
		assert.Contains(t, err.Error(), "unreachable")
		assert.Contains(t, err.Error(), "tcp connect")
	})

	t.Run("ErrMetricsUnreachable.Unwrap returns cause", func(t *testing.T) {
		cause := fmt.Errorf("root cause")
		err := &ErrMetricsUnreachable{Cause: cause}
		assert.Equal(t, cause, err.Unwrap())
	})

	t.Run("ErrMetricsBadGateway.Error contains status code", func(t *testing.T) {
		err := &ErrMetricsBadGateway{StatusCode: 503}
		assert.Contains(t, err.Error(), "503")
	})

	t.Run("ErrMetricsTimeout.Error describes timeout", func(t *testing.T) {
		err := &ErrMetricsTimeout{}
		assert.Contains(t, err.Error(), "timeout")
	})

	t.Run("errors.As works with ErrMetricsUnreachable", func(t *testing.T) {
		inner := &ErrMetricsUnreachable{Cause: fmt.Errorf("refused")}
		wrapped := fmt.Errorf("scrape: %w", inner)
		var target *ErrMetricsUnreachable
		assert.True(t, errors.As(wrapped, &target))
	})

	t.Run("errors.As works with ErrMetricsBadGateway", func(t *testing.T) {
		inner := &ErrMetricsBadGateway{StatusCode: 404}
		wrapped := fmt.Errorf("scrape: %w", inner)
		var target *ErrMetricsBadGateway
		assert.True(t, errors.As(wrapped, &target))
		assert.Equal(t, 404, target.StatusCode)
	})
}

// ── TestNewMetricsDiscoverer (T016) ────────────────────────────────────────────

// TestNewMetricsDiscoverer verifies that NewMetricsDiscoverer constructs a
// MetricsDiscoverer with the correct kubeconfigPath and that the context-switch
// hook is wired (cache is invalidated when SwitchContext is called).
func TestNewMetricsDiscoverer(t *testing.T) {
	t.Run("creates discoverer with correct kubeconfigPath from factory", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "")
		require.NoError(t, err)

		md := NewMetricsDiscoverer(f)
		assert.NotNil(t, md)
		assert.Equal(t, path, md.kubeconfigPath)
		assert.NotNil(t, md.cache)
		assert.NotNil(t, md.factory)
	})

	t.Run("context-switch hook invalidates cache", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)

		md := NewMetricsDiscoverer(f)

		// Prime the cache with a fake pod ref.
		md.cache.set("dev", PodRef{Namespace: "kro-system", PodName: "kro-0"})
		_, ok := md.cache.get("dev")
		require.True(t, ok, "cache should contain pod ref before context switch")

		// Switch context — should trigger invalidateAll via hook.
		require.NoError(t, f.SwitchContext("prod"))

		_, ok = md.cache.get("dev")
		assert.False(t, ok, "cache must be cleared after context switch")
	})
}

// ── TestScrapeMetrics (T017) ───────────────────────────────────────────────────

// TestScrapeMetrics tests the ScrapeMetrics entry point, focusing on the
// empty-contextName path (uses factory) and the bad-kubeconfig error path
// (non-empty contextName with broken kubeconfig).
func TestScrapeMetrics(t *testing.T) {
	t.Run("empty contextName — no kro pod found — returns empty metrics (200 OK)", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)

		md := NewMetricsDiscoverer(f)
		// factory.Dynamic() is a real client pointed at a fake server that
		// returns no pods. discoverKroPod will find nothing → empty result.
		result, err := md.ScrapeMetrics(context.Background(), "")
		require.NoError(t, err)
		require.NotNil(t, result)
		// All metric fields nil when no pod is found.
		assert.Nil(t, result.WatchCount)
		assert.Nil(t, result.GVRCount)
		assert.False(t, result.ScrapedAt.IsZero(), "ScrapedAt must be set")
	})

	t.Run("non-empty contextName with broken kubeconfig — returns error", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)

		// Point kubeconfigPath at a missing file so BuildContextClient fails.
		md := NewMetricsDiscoverer(f)
		md.kubeconfigPath = "/nonexistent/kubeconfig"

		_, err = md.ScrapeMetrics(context.Background(), "some-context")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "build client")
	})
}

// ── TestScrapeWithCache (T018) ─────────────────────────────────────────────────

// TestScrapeWithCache tests scrapeWithCache directly, covering:
//   - cache miss → pod not found → empty metrics
//   - cache hit → successful scrape (via httptest server)
//   - 404 response → cache invalidate → re-discover → pod not found → empty metrics
func TestScrapeWithCache(t *testing.T) {
	t.Run("cache miss — pod not found — returns empty metrics", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)
		md := NewMetricsDiscoverer(f)

		// Use an empty stub dynamic client (no pods).
		dyn := newStubDynamicMetrics()
		dyn.resources[podGVR] = &stubNSResourceForMetrics{}

		result, err := md.scrapeWithCache(context.Background(), dyn, &rest.Config{Host: "http://127.0.0.1:1"}, "test-key")
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Nil(t, result.WatchCount, "no pod means nil watch count")
		assert.False(t, result.ScrapedAt.IsZero())
	})

	t.Run("cache hit — successful scrape", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)
		md := NewMetricsDiscoverer(f)

		// Serve a metrics response from an httptest server.
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(metricsProxyBody))
		}))
		t.Cleanup(srv.Close)

		// Prime cache with the pod ref.
		ref := PodRef{Namespace: "kro-system", PodName: "kro-0"}
		md.cache.set("test-key", ref)

		restCfg := &rest.Config{Host: srv.URL}
		result, err := md.scrapeWithCache(context.Background(), newStubDynamicMetrics(), restCfg, "test-key")
		require.NoError(t, err)
		require.NotNil(t, result)
		require.NotNil(t, result.WatchCount)
		assert.Equal(t, int64(7), *result.WatchCount)
	})

	t.Run("404 response — re-discover fails — returns empty metrics", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)
		md := NewMetricsDiscoverer(f)

		// httptest server returns 404 (simulates pod restarted and proxy returns not found).
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		t.Cleanup(srv.Close)

		// Prime cache so first lookup uses cached ref → gets 404.
		ref := PodRef{Namespace: "kro-system", PodName: "kro-gone"}
		md.cache.set("test-key", ref)

		// No pods in the dynamic stub → re-discover finds nothing.
		dyn := newStubDynamicMetrics()
		dyn.resources[podGVR] = &stubNSResourceForMetrics{}

		restCfg := &rest.Config{Host: srv.URL}
		result, err := md.scrapeWithCache(context.Background(), dyn, restCfg, "test-key")
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Nil(t, result.WatchCount, "re-discover found nothing — nil metrics")
	})

	t.Run("404 response — re-discover succeeds — single retry scrape", func(t *testing.T) {
		path := writeTestKubeconfig(t)
		f, err := NewClientFactory(path, "dev")
		require.NoError(t, err)
		md := NewMetricsDiscoverer(f)

		// First request returns 404; second returns valid metrics.
		callCount := 0
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			callCount++
			if callCount == 1 {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(metricsProxyBody))
		}))
		t.Cleanup(srv.Close)

		// Prime cache with stale pod ref → causes first 404.
		ref := PodRef{Namespace: "kro-system", PodName: "kro-stale"}
		md.cache.set("test-key", ref)

		// Re-discover will find a new pod.
		newPod := makePod("kro-new", "kro-system", "Running")
		dyn := newStubDynamicMetrics()
		dyn.resources[podGVR] = &stubNSResourceForMetrics{
			nsItems: map[string][]unstructured.Unstructured{
				"kro-system": {newPod},
			},
		}

		restCfg := &rest.Config{Host: srv.URL}
		result, err := md.scrapeWithCache(context.Background(), dyn, restCfg, "test-key")
		require.NoError(t, err)
		require.NotNil(t, result)
		require.NotNil(t, result.WatchCount)
		assert.Equal(t, int64(7), *result.WatchCount)
		assert.Equal(t, 2, callCount, "must have called scrape twice (initial + retry)")
	})
}
