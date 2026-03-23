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
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// prometheusBody is a representative Prometheus text exposition snippet.
const fullPrometheusBody = `# HELP dynamic_controller_watch_count Number of active informers managed by the WatchManager
# TYPE dynamic_controller_watch_count gauge
dynamic_controller_watch_count 4
# HELP dynamic_controller_gvr_count Number of Instance GVRs currently managed by the controller
# TYPE dynamic_controller_gvr_count gauge
dynamic_controller_gvr_count 3
# HELP dynamic_controller_queue_length Current length of the workqueue
# TYPE dynamic_controller_queue_length gauge
dynamic_controller_queue_length 2
# HELP workqueue_depth Current depth of workqueue
# TYPE workqueue_depth gauge
workqueue_depth{name="dynamic-controller-queue"} 7
workqueue_depth{name="other-queue"} 99
`

const partialPrometheusBody = `# HELP dynamic_controller_watch_count Number of active informers
# TYPE dynamic_controller_watch_count gauge
dynamic_controller_watch_count 12
# HELP dynamic_controller_gvr_count Number of GVRs
# TYPE dynamic_controller_gvr_count gauge
dynamic_controller_gvr_count 5
`

const emptyPrometheusBody = ``

const wrongLabelBody = `# HELP workqueue_depth Current depth of workqueue
# TYPE workqueue_depth gauge
workqueue_depth{name="unrelated-queue"} 55
`

const zeroValueBody = `dynamic_controller_watch_count 0
dynamic_controller_gvr_count 0
dynamic_controller_queue_length 0
workqueue_depth{name="dynamic-controller-queue"} 0
`

func TestScrapeMetrics(t *testing.T) {
	type build struct {
		statusCode int
		body       string
	}
	type check struct {
		wantErr          bool
		errType          string // "unreachable", "bad_gateway", "timeout"
		watchCount       *int64
		gvrCount         *int64
		queueDepth       *int64
		workqueueDepth   *int64
		scrapedAtNonZero bool
	}

	int64p := func(v int64) *int64 { return &v }

	tests := []struct {
		name  string
		build build
		check check
	}{
		{
			name:  "all four metrics present",
			build: build{statusCode: http.StatusOK, body: fullPrometheusBody},
			check: check{
				watchCount:       int64p(4),
				gvrCount:         int64p(3),
				queueDepth:       int64p(2),
				workqueueDepth:   int64p(7),
				scrapedAtNonZero: true,
			},
		},
		{
			name:  "only watch and gvr metrics present",
			build: build{statusCode: http.StatusOK, body: partialPrometheusBody},
			check: check{
				watchCount:       int64p(12),
				gvrCount:         int64p(5),
				queueDepth:       nil,
				workqueueDepth:   nil,
				scrapedAtNonZero: true,
			},
		},
		{
			name:  "empty body — all fields nil, no error",
			build: build{statusCode: http.StatusOK, body: emptyPrometheusBody},
			check: check{
				watchCount:       nil,
				gvrCount:         nil,
				queueDepth:       nil,
				workqueueDepth:   nil,
				scrapedAtNonZero: true,
			},
		},
		{
			name:  "workqueue_depth with wrong label name is nil",
			build: build{statusCode: http.StatusOK, body: wrongLabelBody},
			check: check{
				workqueueDepth: nil,
			},
		},
		{
			name:  "all counters are zero — zero is distinct from nil",
			build: build{statusCode: http.StatusOK, body: zeroValueBody},
			check: check{
				watchCount:       int64p(0),
				gvrCount:         int64p(0),
				queueDepth:       int64p(0),
				workqueueDepth:   int64p(0),
				scrapedAtNonZero: true,
			},
		},
		{
			name:  "upstream returns 500 — bad gateway error",
			build: build{statusCode: http.StatusInternalServerError, body: ""},
			check: check{wantErr: true, errType: "bad_gateway"},
		},
		{
			name:  "upstream returns 403 — bad gateway error",
			build: build{statusCode: http.StatusForbidden, body: ""},
			check: check{wantErr: true, errType: "bad_gateway"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.build.statusCode)
				_, _ = fmt.Fprint(w, tt.build.body)
			}))
			t.Cleanup(srv.Close)

			got, err := ScrapeMetrics(context.Background(), srv.URL)

			if tt.check.wantErr {
				require.Error(t, err)
				switch tt.check.errType {
				case "bad_gateway":
					var bgErr *ErrMetricsBadGateway
					assert.True(t, errors.As(err, &bgErr), "expected ErrMetricsBadGateway, got %T: %v", err, err)
				case "unreachable":
					var reachErr *ErrMetricsUnreachable
					assert.True(t, errors.As(err, &reachErr), "expected ErrMetricsUnreachable, got %T: %v", err, err)
				case "timeout":
					var toErr *ErrMetricsTimeout
					assert.True(t, errors.As(err, &toErr), "expected ErrMetricsTimeout, got %T: %v", err, err)
				}
				return
			}

			require.NoError(t, err)
			require.NotNil(t, got)

			assert.Equal(t, tt.check.watchCount, got.WatchCount, "WatchCount")
			assert.Equal(t, tt.check.gvrCount, got.GVRCount, "GVRCount")
			assert.Equal(t, tt.check.queueDepth, got.QueueDepth, "QueueDepth")
			assert.Equal(t, tt.check.workqueueDepth, got.WorkqueueDepth, "WorkqueueDepth")

			if tt.check.scrapedAtNonZero {
				assert.False(t, got.ScrapedAt.IsZero(), "ScrapedAt must be set on success")
			}
		})
	}
}

func TestScrapeMetrics_Unreachable(t *testing.T) {
	// Point at a port that has nothing listening.
	_, err := ScrapeMetrics(context.Background(), "http://127.0.0.1:1")
	require.Error(t, err)
	var reachErr *ErrMetricsUnreachable
	assert.True(t, errors.As(err, &reachErr), "expected ErrMetricsUnreachable, got %T: %v", err, err)
}

func TestScrapeMetrics_ConcurrentSafe(t *testing.T) {
	// T018: Verify no data races when 5 goroutines call ScrapeMetrics simultaneously.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, fullPrometheusBody)
	}))
	t.Cleanup(srv.Close)

	var wg sync.WaitGroup
	errs := make([]error, 5)
	for i := 0; i < 5; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, errs[i] = ScrapeMetrics(ctx, srv.URL)
		}()
	}
	wg.Wait()

	for i, err := range errs {
		assert.NoError(t, err, "goroutine %d returned error", i)
	}
}
