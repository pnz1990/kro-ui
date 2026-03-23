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
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/pnz1990/kro-ui/internal/api/types"
)

// metricsFixture is the Prometheus text body served by the stub metrics server.
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

func TestGetMetrics(t *testing.T) {
	int64p := func(v int64) *int64 { return &v }

	type build struct {
		// statusCode and body served by the stub upstream metrics server.
		// Set stubURL to "" to use a real stub server; set metricsURL to skip stub.
		upstreamStatus int
		upstreamBody   string
		// metricsURLOverride, when non-empty, overrides the handler's metricsURL
		// (e.g., to test with an unreachable address).
		metricsURLOverride string
	}
	type check struct {
		wantStatus     int
		wantWatchCount *int64
		wantGVRCount   *int64
		wantQueueDepth *int64
		wantWQDepth    *int64
		wantErrBody    bool
	}

	tests := []struct {
		name  string
		build build
		check check
	}{
		{
			name:  "upstream returns full metrics — 200 with correct JSON",
			build: build{upstreamStatus: http.StatusOK, upstreamBody: metricsFixture},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: int64p(4),
				wantGVRCount:   int64p(3),
				wantQueueDepth: int64p(2),
				wantWQDepth:    int64p(1),
			},
		},
		{
			name:  "upstream returns empty body — 200 with all null fields",
			build: build{upstreamStatus: http.StatusOK, upstreamBody: ""},
			check: check{
				wantStatus:     http.StatusOK,
				wantWatchCount: nil,
				wantGVRCount:   nil,
				wantQueueDepth: nil,
				wantWQDepth:    nil,
			},
		},
		{
			name:  "upstream returns 500 — 502 bad gateway",
			build: build{upstreamStatus: http.StatusInternalServerError, upstreamBody: ""},
			check: check{wantStatus: http.StatusBadGateway, wantErrBody: true},
		},
		{
			name:  "upstream returns 403 — 502 bad gateway",
			build: build{upstreamStatus: http.StatusForbidden, upstreamBody: ""},
			check: check{wantStatus: http.StatusBadGateway, wantErrBody: true},
		},
		{
			name:  "upstream unreachable — 503 service unavailable",
			build: build{metricsURLOverride: "http://127.0.0.1:1"},
			check: check{wantStatus: http.StatusServiceUnavailable, wantErrBody: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			metricsURL := tt.build.metricsURLOverride
			if metricsURL == "" {
				// Start a stub upstream metrics server.
				stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(tt.build.upstreamStatus)
					_, _ = w.Write([]byte(tt.build.upstreamBody))
				}))
				t.Cleanup(stub.Close)
				metricsURL = stub.URL
			}

			h := &Handler{metricsURL: metricsURL}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics", nil)
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
			assert.Equal(t, tt.check.wantGVRCount, resp.GVRCount, "GVRCount")
			assert.Equal(t, tt.check.wantQueueDepth, resp.QueueDepth, "QueueDepth")
			assert.Equal(t, tt.check.wantWQDepth, resp.WorkqueueDepth, "WorkqueueDepth")
			assert.NotEmpty(t, resp.ScrapedAt, "ScrapedAt must be set")
		})
	}
}

// TestGetMetrics_ContractShape verifies the response contract for US3:
// Content-Type header, no HTML on error paths, all five JSON fields present.
func TestGetMetrics_ContractShape(t *testing.T) {
	// ── Helper: assert a response is valid JSON (not HTML) ────────────────
	assertJSONNotHTML := func(t *testing.T, body string) {
		t.Helper()
		assert.NotContains(t, body, "<html", "error body must not contain HTML")
		assert.NotContains(t, body, "<!DOCTYPE", "error body must not contain HTML doctype")
	}

	t.Run("200 response has Content-Type application/json and all 5 fields", func(t *testing.T) {
		stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(metricsFixture))
		}))
		t.Cleanup(stub.Close)

		h := &Handler{metricsURL: stub.URL}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/kro/metrics", nil)
		rr := httptest.NewRecorder()
		h.GetMetrics(rr, req)

		assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

		// Decode as raw map to verify all 5 keys are present (even if null).
		var raw map[string]any
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&raw))
		for _, key := range []string{"watchCount", "gvrCount", "queueDepth", "workqueueDepth", "scrapedAt"} {
			_, ok := raw[key]
			assert.True(t, ok, "response must contain key %q", key)
		}
	})

	t.Run("error response has Content-Type application/json and no HTML", func(t *testing.T) {
		h := &Handler{metricsURL: "http://127.0.0.1:1"}
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
		stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(""))
		}))
		t.Cleanup(stub.Close)

		h := &Handler{metricsURL: stub.URL}
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
