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

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8s "github.com/pnz1990/kro-ui/internal/k8s"
)

// ── stubMetricsDiscoverer ─────────────────────────────────────────────────────

// stubMetricsDiscoverer is a hand-written stub implementing the metricsDiscoverer
// interface for unit tests. It records the contextName it was called with.
type stubMetricsDiscoverer struct {
	result     *k8s.ControllerMetrics
	err        error
	calledWith string // last contextName argument
}

func (s *stubMetricsDiscoverer) ScrapeMetrics(_ context.Context, contextName string) (*k8s.ControllerMetrics, error) {
	s.calledWith = contextName
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

// metricsFixture is the Prometheus text body served by the stub upstream server.
const metricsFixture = `# HELP dynamic_controller_watch_count Active informers
# TYPE dynamic_controller_watch_count gauge
dynamic_controller_watch_count 4
# HELP dynamic_controller_gvr_count GVRs managed
# TYPE dynamic_controller_gvr_count gauge
dynamic_controller_gvr_count 3
# HELP dynamic_controller_queue_length Workqueue length
# TYPE dynamic_controller_queue_length gauge
dynamic_controller_queue_length 2
# HELP workqueue_depth Queue depth
# TYPE workqueue_depth gauge
workqueue_depth{name="dynamic-controller-queue"} 1
`

func int64p(v int64) *int64 { return &v }

// ── TestGetMetrics ────────────────────────────────────────────────────────────

func TestGetMetrics(t *testing.T) {
	type build struct {
		stub        *stubMetricsDiscoverer
		queryString string // e.g. "?context=foo" or ""
		ctxMgr      contextManager
	}
	type check struct {
		wantStatus     int
		wantWatchCount *int64
		wantGVRCount   *int64
		wantQueueDepth *int64
		wantWQDepth    *int64
		wantErrBody    bool
		wantCalledWith string // expected contextName passed to ScrapeMetrics
	}

	// Helper: a contextManager stub that knows a set of context names.
	makeCtxMgr := func(names ...string) contextManager {
		ctxs := make([]k8s.Context, len(names))
		for i, n := range names {
			ctxs[i] = k8s.Context{Name: n}
		}
		return &stubClientFactory{contexts: ctxs, activeContext: names[0]}
	}

	fullMetrics := &k8s.ControllerMetrics{
		WatchCount:     int64p(4),
		GVRCount:       int64p(3),
		QueueDepth:     int64p(2),
		WorkqueueDepth: int64p(1),
		ScrapedAt:      time.Now().UTC(),
	}
	emptyMetrics := &k8s.ControllerMetrics{ScrapedAt: time.Now().UTC()}

	tests := []struct {
		name  string
		build build
		check check
	}{
		{
			name: "active context — scrape succeeds with full metrics",
			build: build{
				stub:   &stubMetricsDiscoverer{result: fullMetrics},
				ctxMgr: makeCtxMgr("ctx-a"),
			},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: int64p(4),
				wantGVRCount:   int64p(3),
				wantQueueDepth: int64p(2),
				wantWQDepth:    int64p(1),
				wantCalledWith: "",
			},
		},
		{
			name: "active context — kro pod not found returns 200 with null fields",
			build: build{
				stub:   &stubMetricsDiscoverer{result: emptyMetrics},
				ctxMgr: makeCtxMgr("ctx-a"),
			},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: nil,
				wantCalledWith: "",
			},
		},
		{
			name: "scrape error — 503 bad gateway",
			build: build{
				stub:   &stubMetricsDiscoverer{err: &k8s.ErrMetricsBadGateway{StatusCode: 500}},
				ctxMgr: makeCtxMgr("ctx-a"),
			},
			check: check{wantStatus: http.StatusBadGateway, wantErrBody: true},
		},
		{
			name: "scrape timeout — 504",
			build: build{
				stub:   &stubMetricsDiscoverer{err: &k8s.ErrMetricsTimeout{}},
				ctxMgr: makeCtxMgr("ctx-a"),
			},
			check: check{wantStatus: http.StatusGatewayTimeout, wantErrBody: true},
		},
		{
			name: "scrape unreachable — 503",
			build: build{
				stub:   &stubMetricsDiscoverer{err: &k8s.ErrMetricsUnreachable{Cause: assert.AnError}},
				ctxMgr: makeCtxMgr("ctx-a"),
			},
			check: check{wantStatus: http.StatusServiceUnavailable, wantErrBody: true},
		},
		// ── ?context= param tests (T021) ──────────────────────────────────────────
		{
			name: "?context= absent — ScrapeMetrics called with empty string",
			build: build{
				stub:        &stubMetricsDiscoverer{result: fullMetrics},
				ctxMgr:      makeCtxMgr("ctx-a", "ctx-b"),
				queryString: "",
			},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: int64p(4),
				wantCalledWith: "",
			},
		},
		{
			name: "?context=ctx-b — known context, ScrapeMetrics called with ctx-b",
			build: build{
				stub:        &stubMetricsDiscoverer{result: fullMetrics},
				ctxMgr:      makeCtxMgr("ctx-a", "ctx-b"),
				queryString: "?context=ctx-b",
			},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: int64p(4),
				wantCalledWith: "ctx-b",
			},
		},
		{
			name: "?context=unknown — 404 with JSON error body",
			build: build{
				stub:        &stubMetricsDiscoverer{result: fullMetrics},
				ctxMgr:      makeCtxMgr("ctx-a"),
				queryString: "?context=unknown",
			},
			check: check{
				wantStatus:  http.StatusNotFound,
				wantErrBody: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &Handler{
				metrics: tt.build.stub,
				ctxMgr:  tt.build.ctxMgr,
			}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics"+tt.build.queryString, nil)
			rr := httptest.NewRecorder()

			h.GetMetrics(rr, req)

			assert.Equal(t, tt.check.wantStatus, rr.Code)
			assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

			if tt.check.wantErrBody {
				var errResp types.ErrorResponse
				require.NoError(t, json.NewDecoder(rr.Body).Decode(&errResp))
				assert.NotEmpty(t, errResp.Error)
				return
			}

			var resp types.ControllerMetricsResponse
			require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))

			assert.Equal(t, tt.check.wantWatchCount, resp.WatchCount, "WatchCount")
			if tt.check.wantGVRCount != nil {
				assert.Equal(t, tt.check.wantGVRCount, resp.GVRCount, "GVRCount")
			}
			if tt.check.wantQueueDepth != nil {
				assert.Equal(t, tt.check.wantQueueDepth, resp.QueueDepth, "QueueDepth")
			}
			if tt.check.wantWQDepth != nil {
				assert.Equal(t, tt.check.wantWQDepth, resp.WorkqueueDepth, "WorkqueueDepth")
			}
			assert.NotEmpty(t, resp.ScrapedAt, "ScrapedAt must be set")

			// Verify the correct contextName was forwarded to ScrapeMetrics.
			if tt.check.wantStatus != http.StatusNotFound {
				assert.Equal(t, tt.check.wantCalledWith, tt.build.stub.calledWith,
					"ScrapeMetrics must be called with expected contextName")
			}
		})
	}
}

// TestGetMetrics_ContractShape verifies the response contract:
// Content-Type header, no HTML on error paths, all five JSON fields present.
func TestGetMetrics_ContractShape(t *testing.T) {
	assertJSONNotHTML := func(t *testing.T, body string) {
		t.Helper()
		assert.NotContains(t, body, "<html", "error body must not contain HTML")
		assert.NotContains(t, body, "<!DOCTYPE", "error body must not contain HTML doctype")
	}

	t.Run("200 response has Content-Type application/json and all 5 fields", func(t *testing.T) {
		h := &Handler{
			metrics: &stubMetricsDiscoverer{result: &k8s.ControllerMetrics{
				WatchCount: int64p(4), GVRCount: int64p(3),
				QueueDepth: int64p(2), WorkqueueDepth: int64p(1),
				ScrapedAt: time.Now().UTC(),
			}},
			ctxMgr: &stubClientFactory{contexts: []k8s.Context{{Name: "ctx-a"}}, activeContext: "ctx-a"},
		}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics", nil)
		rr := httptest.NewRecorder()
		h.GetMetrics(rr, req)

		assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

		var raw map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&raw))
		for _, key := range []string{"watchCount", "gvrCount", "queueDepth", "workqueueDepth", "scrapedAt"} {
			_, ok := raw[key]
			assert.True(t, ok, "response must contain key %q", key)
		}
	})

	t.Run("error response has Content-Type application/json and no HTML", func(t *testing.T) {
		h := &Handler{
			metrics: &stubMetricsDiscoverer{err: &k8s.ErrMetricsUnreachable{Cause: assert.AnError}},
			ctxMgr:  &stubClientFactory{contexts: []k8s.Context{{Name: "ctx-a"}}, activeContext: "ctx-a"},
		}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics", nil)
		rr := httptest.NewRecorder()
		h.GetMetrics(rr, req)

		assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))
		assertJSONNotHTML(t, rr.Body.String())

		var errResp types.ErrorResponse
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&errResp))
		assert.NotEmpty(t, errResp.Error)
	})

	t.Run("empty metrics body — 200 with all 5 keys present (nulls count)", func(t *testing.T) {
		h := &Handler{
			metrics: &stubMetricsDiscoverer{result: &k8s.ControllerMetrics{ScrapedAt: time.Now().UTC()}},
			ctxMgr:  &stubClientFactory{contexts: []k8s.Context{{Name: "ctx-a"}}, activeContext: "ctx-a"},
		}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics", nil)
		rr := httptest.NewRecorder()
		h.GetMetrics(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var raw map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&raw))
		for _, key := range []string{"watchCount", "gvrCount", "queueDepth", "workqueueDepth", "scrapedAt"} {
			_, ok := raw[key]
			assert.True(t, ok, "key %q must be present even when null", key)
		}
	})
}

// TestGetMetrics_ContextNotFound verifies that an unknown ?context= param returns 404.
func TestGetMetrics_ContextNotFound(t *testing.T) {
	h := &Handler{
		metrics: &stubMetricsDiscoverer{result: &k8s.ControllerMetrics{ScrapedAt: time.Now().UTC()}},
		ctxMgr: &stubClientFactory{
			contexts:      []k8s.Context{{Name: "ctx-a"}},
			activeContext: "ctx-a",
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics?context=no-such-context", nil)
	rr := httptest.NewRecorder()
	h.GetMetrics(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
	assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

	var errResp types.ErrorResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&errResp))
	assert.Contains(t, errResp.Error, "no-such-context")
}

// metricsFixture is retained for documentation purposes and potential future
// integration tests that wire a real httptest.Server to a stub MetricsDiscoverer.
// The blank reference below prevents the compiler from removing the httptest import
// if all direct httptest.NewServer calls are later removed from this file.
// (scrapeViaProxy tests that use httptest.NewServer live in internal/k8s/metrics_test.go.)
var _ = httptest.NewServer
