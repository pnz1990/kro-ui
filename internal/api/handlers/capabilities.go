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
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// capabilitiesCache is an in-memory TTL cache for capabilities detection results.
// Lives in the handler layer because caching is an HTTP concern.
type capabilitiesCache struct {
	mu        sync.RWMutex
	result    *k8sclient.KroCapabilities
	fetchedAt time.Time
	ttl       time.Duration
}

const defaultCapabilitiesTTL = 30 * time.Second

// get returns the cached result if fresh, or nil if stale/empty.
func (c *capabilitiesCache) get() *k8sclient.KroCapabilities {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.result == nil {
		return nil
	}
	if time.Since(c.fetchedAt) > c.ttl {
		return nil
	}
	return c.result
}

// set stores a new result in the cache.
func (c *capabilitiesCache) set(caps *k8sclient.KroCapabilities) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.result = caps
	c.fetchedAt = time.Now()
}

// invalidate clears the cache (e.g., on context switch).
func (c *capabilitiesCache) invalidate() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.result = nil
	c.fetchedAt = time.Time{}
}

// capCache is the package-level capabilities cache, shared by all handler instances.
// Initialized once, safe for concurrent use.
var capCache = &capabilitiesCache{ttl: defaultCapabilitiesTTL}

// GetCapabilities handles GET /api/v1/kro/capabilities.
// Returns detected capabilities with a 30s cache. Always returns 200 with valid JSON —
// falls back to conservative baseline on any detection failure.
func (h *Handler) GetCapabilities(w http.ResponseWriter, r *http.Request) {
	// Try cache first.
	if cached := capCache.get(); cached != nil {
		respond(w, http.StatusOK, cached)
		return
	}

	// Cache miss — run detection pipeline.
	ctx := r.Context()
	log := zerolog.Ctx(ctx)

	caps := k8sclient.DetectCapabilities(ctx, h.factory.Dynamic(), h.factory.Discovery())
	if caps == nil {
		log.Error().Msg("DetectCapabilities returned nil, using baseline")
		caps = k8sclient.Baseline()
	}

	capCache.set(caps)
	respond(w, http.StatusOK, caps)
}

// InvalidateCapabilitiesCache clears the capabilities cache.
// Called when the user switches kubeconfig context.
func InvalidateCapabilitiesCache() {
	capCache.invalidate()
}
