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

// Package k8s provides Kubernetes client helpers and kro-specific field extraction.
package k8s

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// ── Pod reference ─────────────────────────────────────────────────────────────

// PodRef identifies the resolved kro controller pod for a specific kubeconfig context.
// Populated by discoverKroPod.
type PodRef struct {
	Namespace string
	PodName   string
}

// cachedPodRef wraps a PodRef with a TTL for in-process caching.
type cachedPodRef struct {
	namespace string
	podName   string
	expiry    time.Time
}

// PodRefCache is a thread-safe per-context cache of resolved kro controller pod references.
// Use NewPodRefCache to create one.
type PodRefCache struct {
	mu   sync.RWMutex
	refs map[string]cachedPodRef
	ttl  time.Duration
}

// NewPodRefCache creates a PodRefCache with the given TTL.
// The recommended TTL for production use is 60 seconds.
func NewPodRefCache(ttl time.Duration) *PodRefCache {
	return &PodRefCache{
		refs: make(map[string]cachedPodRef),
		ttl:  ttl,
	}
}

// get returns the cached PodRef for the given context name if it exists and has not expired.
// Uses double-check locking: RLock → check → RUnlock → Lock → re-check.
func (c *PodRefCache) get(ctx string) (PodRef, bool) {
	c.mu.RLock()
	entry, ok := c.refs[ctx]
	c.mu.RUnlock()
	if ok && time.Now().Before(entry.expiry) {
		return PodRef{Namespace: entry.namespace, PodName: entry.podName}, true
	}
	return PodRef{}, false
}

// set stores a PodRef for the given context name with expiry = now + ttl.
func (c *PodRefCache) set(ctx string, ref PodRef) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.refs[ctx] = cachedPodRef{
		namespace: ref.Namespace,
		podName:   ref.PodName,
		expiry:    time.Now().Add(c.ttl),
	}
}

// invalidate removes the cached entry for the given context name.
// Called when the pod proxy returns 404 (pod may have restarted).
func (c *PodRefCache) invalidate(ctx string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.refs, ctx)
}

// invalidateAll clears all cached pod references.
// Called on context switch so the newly-active context is re-discovered on next request.
func (c *PodRefCache) invalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.refs = make(map[string]cachedPodRef)
}

// ── Pod discovery ─────────────────────────────────────────────────────────────

// podGVR is the GVR for Kubernetes core Pods.
var podGVR = schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}

// kroLabelSelectors is the ordered list of label selectors tried when discovering
// the kro controller pod. The first selector that returns at least one pod wins.
var kroLabelSelectors = []string{
	"app.kubernetes.io/name=kro",           // upstream standard label (kro Helm chart)
	"control-plane=kro-controller-manager", // controller-runtime manager convention
	"app=kro",                              // legacy / fallback
}

// kroNamespaces is the ordered list of namespaces probed before falling back to
// a cluster-scoped list. Probing specific namespaces avoids a cluster-wide list
// in the common case where kro is installed in kro-system.
var kroNamespaces = []string{"kro-system", "kro"}

// discoverKroPod finds the kro controller pod using the dynamic client.
// It tries each label selector in kroLabelSelectors order. For each selector
// it probes kroNamespaces first, then performs a cluster-scoped list.
// It prefers a Running-phase pod; falls back to any phase if none are Running.
// Returns (PodRef{}, false) when no matching pod is found.
func discoverKroPod(ctx context.Context, dyn dynamic.Interface) (PodRef, bool) {
	for _, selector := range kroLabelSelectors {
		ref, found := discoverWithSelector(ctx, dyn, selector)
		if found {
			return ref, true
		}
	}
	return PodRef{}, false
}

// discoverWithSelector tries to find a kro pod using a specific label selector,
// probing known namespaces first then falling back to cluster-scoped.
func discoverWithSelector(ctx context.Context, dyn dynamic.Interface, selector string) (PodRef, bool) {
	opts := metav1.ListOptions{LabelSelector: selector}

	// Probe specific namespaces first (avoids a cluster-wide scan in common cases).
	for _, ns := range kroNamespaces {
		list, err := dyn.Resource(podGVR).Namespace(ns).List(ctx, opts)
		if err != nil || len(list.Items) == 0 {
			continue
		}
		if ref, ok := pickPod(ns, list.Items); ok {
			return ref, true
		}
	}

	// Fallback: cluster-scoped list (finds kro in any namespace).
	list, err := dyn.Resource(podGVR).List(ctx, opts)
	if err != nil || len(list.Items) == 0 {
		return PodRef{}, false
	}

	// Group by namespace for pickPod — use flat slice for cluster-scoped result.
	// Extract namespace from each pod's metadata.
	//
	// We pass "" as namespace hint; pickPod will extract the real namespace
	// from the pod's metadata.namespace field.
	return pickPodFromClusterList(list.Items)
}

// pickPod selects a Running pod from items in the given namespace.
// Falls back to the first pod in any phase if none are Running.
func pickPod(ns string, items []unstructured.Unstructured) (PodRef, bool) {
	if len(items) == 0 {
		return PodRef{}, false
	}
	// Prefer Running phase.
	for i := range items {
		phase, _, _ := unstructured.NestedString(items[i].Object, "status", "phase")
		if phase == "Running" {
			return PodRef{Namespace: ns, PodName: items[i].GetName()}, true
		}
	}
	// Any phase fallback.
	return PodRef{Namespace: ns, PodName: items[0].GetName()}, true
}

// pickPodFromClusterList selects a pod from a cluster-scoped list result,
// extracting the namespace from each pod's metadata.
func pickPodFromClusterList(items []unstructured.Unstructured) (PodRef, bool) {
	if len(items) == 0 {
		return PodRef{}, false
	}
	// Prefer Running phase.
	for i := range items {
		phase, _, _ := unstructured.NestedString(items[i].Object, "status", "phase")
		if phase == "Running" {
			ns := items[i].GetNamespace()
			if ns == "" {
				ns, _, _ = unstructured.NestedString(items[i].Object, "metadata", "namespace")
			}
			return PodRef{Namespace: ns, PodName: items[i].GetName()}, true
		}
	}
	// Any phase fallback.
	ns := items[0].GetNamespace()
	if ns == "" {
		ns, _, _ = unstructured.NestedString(items[0].Object, "metadata", "namespace")
	}
	return PodRef{Namespace: ns, PodName: items[0].GetName()}, true
}

// ── Pod-proxy scrape ──────────────────────────────────────────────────────────

// scrapeTimeout is the deadline for the upstream HTTP request.
// Set to 4s to leave 1s margin within the 5s API performance budget.
const scrapeTimeout = 4 * time.Second

// scrapeViaProxy proxies the /metrics request through the kube-apiserver pod proxy.
// It builds an *http.Client from restCfg (which carries TLS and auth credentials)
// then issues GET /api/v1/namespaces/{ns}/pods/{podName}/proxy/metrics.
//
// Errors:
//   - *ErrMetricsUnreachable — network/DNS failure or connection refused
//   - *ErrMetricsTimeout     — upstream did not respond within 4 seconds
//   - *ErrMetricsBadGateway  — upstream returned a non-200 HTTP status
func scrapeViaProxy(ctx context.Context, restCfg *rest.Config, ref PodRef) (*ControllerMetrics, error) {
	httpClient, err := rest.HTTPClientFor(restCfg)
	if err != nil {
		return nil, &ErrMetricsUnreachable{Cause: fmt.Errorf("build proxy http client: %w", err)}
	}
	httpClient.Timeout = scrapeTimeout

	// Trim trailing slash from Host so URL concatenation is safe.
	base := strings.TrimRight(restCfg.Host, "/")
	proxyURL := base + "/api/v1/namespaces/" + ref.Namespace + "/pods/" + ref.PodName + "/proxy/metrics"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, proxyURL, nil)
	if err != nil {
		return nil, &ErrMetricsUnreachable{Cause: fmt.Errorf("build proxy request: %w", err)}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, &ErrMetricsTimeout{}
		}
		var urlErr interface{ Timeout() bool }
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			return nil, &ErrMetricsTimeout{}
		}
		return nil, &ErrMetricsUnreachable{Cause: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &ErrMetricsBadGateway{StatusCode: resp.StatusCode}
	}

	result := &ControllerMetrics{ScrapedAt: time.Now().UTC()}
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		parseMetricLine(line, result)
	}
	return result, nil
}

// ── MetricsDiscoverer ─────────────────────────────────────────────────────────

// MetricsDiscoverer discovers the kro controller pod for a given kubeconfig context
// and proxies the /metrics scrape through the kube-apiserver pod proxy.
// It satisfies the metricsDiscoverer interface defined in internal/api/handlers/handler.go.
type MetricsDiscoverer struct {
	factory        *ClientFactory
	cache          *PodRefCache
	kubeconfigPath string
}

// NewMetricsDiscoverer creates a MetricsDiscoverer backed by the given ClientFactory.
// It registers a context-switch hook so the pod reference cache is invalidated
// whenever the active context changes (spec 040 — FR-003, AC-007).
func NewMetricsDiscoverer(factory *ClientFactory) *MetricsDiscoverer {
	md := &MetricsDiscoverer{
		factory:        factory,
		cache:          NewPodRefCache(60 * time.Second),
		kubeconfigPath: factory.KubeconfigPath(),
	}
	// Invalidate all cached pod references whenever the operator switches context.
	// This ensures the next metrics poll discovers the pod in the new context.
	factory.RegisterContextSwitchHook(md.cache.invalidateAll)
	return md
}

// ScrapeMetrics discovers the kro controller pod for contextName and proxies
// the /metrics endpoint through the kube-apiserver pod proxy.
//
// If contextName is empty, the active context in the ClientFactory is used.
// If contextName is non-empty, an ephemeral client is built for that specific context
// (same pattern as fleet fan-out in BuildContextClient) — this does NOT change the
// active context.
//
// When no kro pod is found, a ControllerMetrics with all nil metric fields is returned
// (200 OK semantics — "kro not installed" is not an error).
//
// Cache invalidation on context switch: ScrapeMetrics compares contextName against
// the factory's active context. When an empty contextName resolves to the active context
// and the caller is switching contexts (detected by the factory's SwitchContext method
// calling cache.invalidateAll), the cache is already cleared before the next poll arrives.
// See ClientFactory.SwitchContext — it calls md.cache.invalidateAll() if a MetricsDiscoverer
// is registered via RegisterCacheInvalidator.
func (md *MetricsDiscoverer) ScrapeMetrics(ctx context.Context, contextName string) (*ControllerMetrics, error) {
	var (
		dyn      dynamic.Interface
		restCfg  *rest.Config
		cacheKey string
	)

	if contextName == "" {
		// Use the shared factory's active context.
		dyn = md.factory.Dynamic()
		restCfg = md.factory.RESTConfig()
		cacheKey = md.factory.ActiveContext()
	} else {
		// Build ephemeral clients for the requested context (does not mutate factory).
		clients, err := BuildContextClient(md.kubeconfigPath, contextName)
		if err != nil {
			return nil, fmt.Errorf("build client for context %q: %w", contextName, err)
		}
		dyn = clients.Dynamic()
		// Ephemeral clients need their own REST config for proxy auth.
		restCfg, err = buildRESTConfig(md.kubeconfigPath, contextName)
		if err != nil {
			return nil, fmt.Errorf("build rest config for context %q: %w", contextName, err)
		}
		cacheKey = contextName
	}

	return md.scrapeWithCache(ctx, dyn, restCfg, cacheKey)
}

// scrapeWithCache looks up a cached pod ref, calls scrapeViaProxy, and handles
// the single-retry-on-404 logic described in spec FR-003.
func (md *MetricsDiscoverer) scrapeWithCache(ctx context.Context, dyn dynamic.Interface, restCfg *rest.Config, cacheKey string) (*ControllerMetrics, error) {
	ref, cached := md.cache.get(cacheKey)

	if !cached {
		// Cache miss: discover the pod.
		var found bool
		ref, found = discoverKroPod(ctx, dyn)
		if !found {
			// kro not installed or pod not found — return null fields, 200 OK.
			return &ControllerMetrics{ScrapedAt: time.Now().UTC()}, nil
		}
		md.cache.set(cacheKey, ref)
	}

	// Attempt proxy scrape.
	result, err := scrapeViaProxy(ctx, restCfg, ref)
	if err != nil {
		// On 404: pod may have restarted. Invalidate cache, re-discover once.
		var bgErr *ErrMetricsBadGateway
		if errors.As(err, &bgErr) && bgErr.StatusCode == http.StatusNotFound {
			md.cache.invalidate(cacheKey)
			ref, found := discoverKroPod(ctx, dyn)
			if !found {
				return &ControllerMetrics{ScrapedAt: time.Now().UTC()}, nil
			}
			md.cache.set(cacheKey, ref)
			// Single retry — if this also fails, propagate the error.
			return scrapeViaProxy(ctx, restCfg, ref)
		}
		return nil, err
	}
	return result, nil
}

// ── ControllerMetrics ─────────────────────────────────────────────────────────

// ControllerMetrics is a point-in-time snapshot of kro controller operational state.
// Pointer fields are nil when the corresponding metric was absent in the upstream scrape.
// A nil value must be rendered as "Not reported", never as zero.
type ControllerMetrics struct {
	// WatchCount is the number of active informers (dynamic_controller_watch_count).
	WatchCount *int64
	// GVRCount is the number of instance GVRs managed (dynamic_controller_gvr_count).
	GVRCount *int64
	// QueueDepth is the kro workqueue length (dynamic_controller_queue_length).
	QueueDepth *int64
	// WorkqueueDepth is the client-go workqueue depth
	// (workqueue_depth{name="dynamic-controller-queue"}).
	WorkqueueDepth *int64
	// ScrapedAt is the time the upstream endpoint responded successfully.
	ScrapedAt time.Time
}

// ── Sentinel error types ──────────────────────────────────────────────────────

// ErrMetricsUnreachable is returned when the upstream endpoint cannot be contacted.
type ErrMetricsUnreachable struct {
	Cause error
}

func (e *ErrMetricsUnreachable) Error() string {
	return fmt.Sprintf("metrics source unreachable: %v", e.Cause)
}

func (e *ErrMetricsUnreachable) Unwrap() error { return e.Cause }

// ErrMetricsBadGateway is returned when the upstream endpoint returns a non-200 status.
type ErrMetricsBadGateway struct {
	StatusCode int
}

func (e *ErrMetricsBadGateway) Error() string {
	return fmt.Sprintf("metrics source returned HTTP %d", e.StatusCode)
}

// ErrMetricsTimeout is returned when the upstream endpoint does not respond in time.
type ErrMetricsTimeout struct{}

func (e *ErrMetricsTimeout) Error() string {
	return "metrics source timeout after 4s"
}

// ── Prometheus text parser ────────────────────────────────────────────────────

// target metric names as they appear in Prometheus text format.
const (
	metricWatchCount     = "dynamic_controller_watch_count"
	metricGVRCount       = "dynamic_controller_gvr_count"
	metricQueueDepth     = "dynamic_controller_queue_length"
	metricWorkqueueDepth = "workqueue_depth"
	// workqueueNameLabel is the label value that identifies the kro workqueue.
	workqueueNameLabel = `name="dynamic-controller-queue"`
)

// parseMetricLine extracts a value from a single Prometheus text line and writes
// it into result if the line matches one of the four target metrics.
func parseMetricLine(line string, result *ControllerMetrics) {
	// Prometheus text format: <name>[{labels}] <value> [<timestamp>]
	// We split on space to get the name+labels part and the value.
	spaceIdx := strings.IndexByte(line, ' ')
	if spaceIdx < 0 {
		return
	}
	namePart := line[:spaceIdx]
	rest := strings.TrimSpace(line[spaceIdx+1:])
	// Value may be followed by a timestamp — take only the first token.
	valueStr := rest
	if spaceIdx2 := strings.IndexByte(rest, ' '); spaceIdx2 >= 0 {
		valueStr = rest[:spaceIdx2]
	}
	val, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return
	}
	intVal := int64(val)

	switch {
	case namePart == metricWatchCount:
		result.WatchCount = &intVal

	case namePart == metricGVRCount:
		result.GVRCount = &intVal

	case namePart == metricQueueDepth:
		result.QueueDepth = &intVal

	case strings.HasPrefix(namePart, metricWorkqueueDepth+"{") &&
		strings.Contains(namePart, workqueueNameLabel):
		result.WorkqueueDepth = &intVal
	}
}
