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

	"github.com/rs/zerolog"

	"github.com/pnz1990/kro-ui/internal/api/types"
	k8s "github.com/pnz1990/kro-ui/internal/k8s"
)

// GetMetrics scrapes the kro controller metrics for the requested context.
// If ?context= is absent or empty, the active context is used.
// If ?context= is set but not found in the kubeconfig, 404 is returned.
// When the kro pod is not found, 200 OK with null metric fields is returned
// (kro not installed is not an error — Constitution §XII graceful degradation).
//
// HTTP error mapping:
//   - 404 Not Found           — unknown ?context= param
//   - 503 Service Unavailable — pod proxy unreachable
//   - 502 Bad Gateway         — pod proxy returned non-200
//   - 504 Gateway Timeout     — pod proxy did not respond in time
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	// Read optional ?context= query param.
	contextName := r.URL.Query().Get("context")
	if contextName != "" {
		// Validate the requested context exists in the kubeconfig.
		contexts, _, err := h.ctxMgr.ListContexts()
		if err != nil {
			log.Error().Err(err).Msg("list contexts for metrics validation failed")
			respondError(w, http.StatusInternalServerError, "failed to list contexts")
			return
		}
		found := false
		for _, c := range contexts {
			if c.Name == contextName {
				found = true
				break
			}
		}
		if !found {
			respondError(w, http.StatusNotFound,
				"context \""+contextName+"\" not found in kubeconfig")
			return
		}
	}

	metrics, err := h.metrics.ScrapeMetrics(r.Context(), contextName)
	if err != nil {
		log.Error().Err(err).Str("context", contextName).Msg("metrics scrape failed")

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
