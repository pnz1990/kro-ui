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
	"errors"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8s "github.com/pnz1990/kro-ui/internal/k8s"
)

// GetMetrics scrapes kro's Prometheus metrics endpoint and returns a JSON snapshot
// of the four key operational counters. Absent metrics are encoded as JSON null.
//
// Errors from the upstream endpoint are translated to appropriate HTTP status codes:
//   - 503 Service Unavailable — endpoint unreachable
//   - 502 Bad Gateway         — endpoint returned non-200
//   - 504 Gateway Timeout     — endpoint did not respond within budget
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := k8s.ScrapeMetrics(r.Context(), h.metricsURL)
	if err != nil {
		log.Ctx(r.Context()).Error().Err(err).Str("url", h.metricsURL).Msg("metrics scrape failed")

		var bgErr *k8s.ErrMetricsBadGateway
		var toErr *k8s.ErrMetricsTimeout
		var reachErr *k8s.ErrMetricsUnreachable

		switch {
		case errors.As(err, &toErr):
			respondError(w, http.StatusGatewayTimeout, toErr.Error())
		case errors.As(err, &bgErr):
			respondError(w, http.StatusBadGateway, bgErr.Error())
		case errors.As(err, &reachErr):
			respondError(w, http.StatusServiceUnavailable, reachErr.Error())
		default:
			respondError(w, http.StatusServiceUnavailable, err.Error())
		}
		return
	}

	resp := types.ControllerMetricsResponse{
		WatchCount:     metrics.WatchCount,
		GVRCount:       metrics.GVRCount,
		QueueDepth:     metrics.QueueDepth,
		WorkqueueDepth: metrics.WorkqueueDepth,
		ScrapedAt:      metrics.ScrapedAt.Format(time.RFC3339),
	}
	respond(w, http.StatusOK, resp)
}
