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
	"time"
)

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

// Sentinel error types for upstream failures — callers map these to HTTP status codes.

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

// scrapeTimeout is the deadline for the upstream HTTP request.
// Set to 4s to leave 1s margin within the 5s API performance budget.
const scrapeTimeout = 4 * time.Second

// target metric names as they appear in Prometheus text format.
const (
	metricWatchCount     = "dynamic_controller_watch_count"
	metricGVRCount       = "dynamic_controller_gvr_count"
	metricQueueDepth     = "dynamic_controller_queue_length"
	metricWorkqueueDepth = "workqueue_depth"
	// workqueueNameLabel is the label value that identifies the kro workqueue.
	workqueueNameLabel = `name="dynamic-controller-queue"`
)

// ScrapeMetrics fetches the Prometheus text endpoint at metricsURL and returns
// a ControllerMetrics snapshot. Absent metrics are represented as nil fields.
//
// Errors:
//   - *ErrMetricsUnreachable — network/DNS failure or connection refused
//   - *ErrMetricsTimeout     — upstream did not respond within 4 seconds
//   - *ErrMetricsBadGateway  — upstream returned a non-200 HTTP status
func ScrapeMetrics(ctx context.Context, metricsURL string) (*ControllerMetrics, error) {
	client := &http.Client{Timeout: scrapeTimeout}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metricsURL, nil)
	if err != nil {
		return nil, &ErrMetricsUnreachable{Cause: fmt.Errorf("build request: %w", err)}
	}

	resp, err := client.Do(req)
	if err != nil {
		// Distinguish timeout (context deadline or client timeout) from other errors.
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, &ErrMetricsTimeout{}
		}
		// Check for url.Error wrapping a timeout.
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
		// Skip comment/type lines.
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		parseMetricLine(line, result)
	}

	return result, nil
}

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
