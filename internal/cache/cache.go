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

// Package cache provides a lightweight in-memory response cache for the
// kro-ui HTTP server.
//
// Design goals:
//   - Zero external dependencies (no Redis, memcached, etc.)
//   - Thread-safe concurrent reads via sync.RWMutex
//   - Per-key TTL with passive expiry (no background goroutine needed)
//   - Context-prefix invalidation (clear all cache entries for a context on switch)
//   - X-Cache: HIT/MISS header for observability
//   - ?refresh=true query param to bypass cache
//
// Spec: .specify/specs/052-response-cache/spec.md

package cache

import (
	"bytes"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

// entry holds a cached HTTP response body and metadata.
type entry struct {
	body        []byte
	contentType string
	statusCode  int
	expiresAt   time.Time
}

// ResponseCache is a thread-safe in-memory cache for HTTP responses.
// It is safe for concurrent use by multiple goroutines.
type ResponseCache struct {
	mu      sync.RWMutex
	entries map[string]*entry
}

// New creates a new ResponseCache.
func New() *ResponseCache {
	return &ResponseCache{
		entries: make(map[string]*entry),
	}
}

// cacheKey builds a normalised cache key from a request.
// Format: "GET:/api/v1/rgds?name=foo&tab=graph" (query params sorted).
func cacheKey(r *http.Request) string {
	q := r.URL.RawQuery
	if q != "" {
		// Sort query params for consistent keys regardless of client order.
		parts := strings.Split(q, "&")
		sort.Strings(parts)
		q = strings.Join(parts, "&")
	}
	if q == "" {
		return r.Method + ":" + r.URL.Path
	}
	return r.Method + ":" + r.URL.Path + "?" + q
}

// get returns a cached entry if present and not expired.
func (c *ResponseCache) get(key string) (*entry, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e, true
}

// set stores a response body in the cache with a TTL.
func (c *ResponseCache) set(key string, body []byte, contentType string, statusCode int, ttl time.Duration) {
	c.mu.Lock()
	c.entries[key] = &entry{
		body:        body,
		contentType: contentType,
		statusCode:  statusCode,
		expiresAt:   time.Now().Add(ttl),
	}
	c.mu.Unlock()
}

// InvalidatePrefix removes all entries whose key starts with the given prefix.
// Used to invalidate all cached responses for a specific context on context-switch.
func (c *ResponseCache) InvalidatePrefix(prefix string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	count := 0
	for k := range c.entries {
		if strings.HasPrefix(k, prefix) {
			delete(c.entries, k)
			count++
		}
	}
	return count
}

// Size returns the number of entries currently in the cache (including expired ones).
func (c *ResponseCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// Purge removes all expired entries. Call periodically if memory is a concern.
func (c *ResponseCache) Purge() int {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	count := 0
	for k, e := range c.entries {
		if now.After(e.expiresAt) {
			delete(c.entries, k)
			count++
		}
	}
	return count
}

// ── Middleware ────────────────────────────────────────────────────────────────

// responseRecorder captures the response body and status code written by a handler.
type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
	header     http.Header
}

func newRecorder(w http.ResponseWriter) *responseRecorder {
	return &responseRecorder{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
		header:         w.Header(),
	}
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

// Middleware returns a chi-compatible middleware that caches GET responses for
// the given TTL. Only 200 OK responses are cached. Requests with ?refresh=true
// bypass the cache (but the fresh response is stored back into the cache).
func Middleware(c *ResponseCache, ttl time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only cache GET requests
			if r.Method != http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}

			// ?refresh=true bypasses the cache
			skipCache := r.URL.Query().Get("refresh") == "true"

			key := cacheKey(r)

			if !skipCache {
				if e, ok := c.get(key); ok {
					// Cache HIT — serve from cache
					w.Header().Set("Content-Type", e.contentType)
					w.Header().Set("X-Cache", "HIT")
					w.Header().Set("X-Cache-TTL", ttl.String())
					if e.statusCode != http.StatusOK {
						w.WriteHeader(e.statusCode)
					}
					_, _ = w.Write(e.body)
					return
				}
			}

			// Cache MISS — call the real handler, capture the response
			rec := newRecorder(w)
			rec.Header().Set("X-Cache", "MISS")
			next.ServeHTTP(rec, r)

			// Only cache successful JSON responses
			if rec.statusCode == http.StatusOK && rec.body.Len() > 0 {
				ct := rec.Header().Get("Content-Type")
				if ct == "" {
					ct = "application/json"
				}
				c.set(key, rec.body.Bytes(), ct, rec.statusCode, ttl)
			}
		})
	}
}
