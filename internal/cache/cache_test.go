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

package cache

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Unit tests for ResponseCache ─────────────────────────────────────────────

func TestResponseCache_MissAndHit(t *testing.T) {
	c := New()
	key := "GET:/api/v1/rgds"

	_, ok := c.get(key)
	assert.False(t, ok, "fresh cache should be a miss")

	c.set(key, []byte(`{"items":[]}`), "application/json", 200, 30*time.Second)

	e, ok := c.get(key)
	require.True(t, ok, "should be a hit after set")
	assert.Equal(t, `{"items":[]}`, string(e.body))
	assert.Equal(t, 200, e.statusCode)
}

func TestResponseCache_TTLExpiry(t *testing.T) {
	c := New()
	key := "GET:/api/v1/rgds"
	c.set(key, []byte("data"), "application/json", 200, 1*time.Millisecond)

	time.Sleep(5 * time.Millisecond)

	_, ok := c.get(key)
	assert.False(t, ok, "cache should expire after TTL")
}

func TestResponseCache_InvalidatePrefix(t *testing.T) {
	c := New()
	c.set("GET:/api/v1/rgds", []byte("1"), "application/json", 200, time.Minute)
	c.set("GET:/api/v1/rgds/foo", []byte("2"), "application/json", 200, time.Minute)
	c.set("GET:/api/v1/instances/ns/bar", []byte("3"), "application/json", 200, time.Minute)

	n := c.InvalidatePrefix("GET:/api/v1/rgds")
	assert.Equal(t, 2, n, "should remove 2 entries with rgds prefix")

	_, ok1 := c.get("GET:/api/v1/rgds")
	_, ok2 := c.get("GET:/api/v1/rgds/foo")
	_, ok3 := c.get("GET:/api/v1/instances/ns/bar")
	assert.False(t, ok1)
	assert.False(t, ok2)
	assert.True(t, ok3, "unrelated key should survive")
}

func TestResponseCache_ConcurrentAccess(t *testing.T) {
	c := New()
	done := make(chan struct{})
	for i := 0; i < 50; i++ {
		go func(n int) {
			c.set("key", []byte("v"), "application/json", 200, time.Minute)
			c.get("key")
			done <- struct{}{}
		}(i)
	}
	for i := 0; i < 50; i++ {
		<-done
	}
}

func TestResponseCache_Purge(t *testing.T) {
	c := New()
	c.set("old", []byte("old"), "application/json", 200, 1*time.Millisecond)
	c.set("fresh", []byte("fresh"), "application/json", 200, time.Minute)
	time.Sleep(5 * time.Millisecond)
	n := c.Purge()
	assert.Equal(t, 1, n, "should purge 1 expired entry")
	assert.Equal(t, 1, c.Size())
}

// TestResponseCache_Flush verifies that Flush removes ALL entries including
// non-expired ones (spec 057-cache-context-invalidation FR-001).
func TestResponseCache_Flush(t *testing.T) {
	c := New()
	c.set("a", []byte("a"), "application/json", 200, time.Minute)
	c.set("b", []byte("b"), "application/json", 200, time.Minute)
	c.set("c", []byte("c"), "application/json", 200, time.Minute)
	require.Equal(t, 3, c.Size(), "setup: 3 entries before flush")

	c.Flush()

	assert.Equal(t, 0, c.Size(), "all entries removed by Flush")

	// Verify entries are gone on get
	_, hit := c.get("a")
	assert.False(t, hit, "entry 'a' should be absent after Flush")
}

// TestResponseCache_Flush_ConcurrentSafety ensures Flush is race-free.
func TestResponseCache_Flush_ConcurrentSafety(t *testing.T) {
	c := New()
	for i := 0; i < 10; i++ {
		c.set(string(rune('a'+i)), []byte("v"), "application/json", 200, time.Minute)
	}

	done := make(chan struct{})
	go func() {
		c.Flush()
		close(done)
	}()
	// Concurrent get while flush is in progress
	c.get("a")
	<-done
	// No panic = test passes (go test -race verifies data-race freedom)
}

// ── Integration tests for Middleware ──────────────────────────────────────────

func TestMiddleware_CachesOnMiss(t *testing.T) {
	c := New()
	callCount := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"cached":true}`))
	})

	mw := Middleware(c, 30*time.Second)
	wrapped := mw(handler)

	// First request — cache MISS
	req := httptest.NewRequest("GET", "/api/v1/rgds", nil)
	w1 := httptest.NewRecorder()
	wrapped.ServeHTTP(w1, req)
	assert.Equal(t, 1, callCount)
	assert.Equal(t, "MISS", w1.Header().Get("X-Cache"))

	// Second request — cache HIT
	req2 := httptest.NewRequest("GET", "/api/v1/rgds", nil)
	w2 := httptest.NewRecorder()
	wrapped.ServeHTTP(w2, req2)
	assert.Equal(t, 1, callCount, "handler should NOT be called again on cache hit")
	assert.Equal(t, "HIT", w2.Header().Get("X-Cache"))
	assert.Equal(t, `{"cached":true}`, w2.Body.String())
}

func TestMiddleware_RefreshBypassesCache(t *testing.T) {
	c := New()
	callCount := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		_, _ = w.Write([]byte(`{}`))
	})
	wrapped := Middleware(c, time.Minute)(handler)

	// Populate cache
	req1 := httptest.NewRequest("GET", "/api/v1/rgds", nil)
	wrapped.ServeHTTP(httptest.NewRecorder(), req1)
	assert.Equal(t, 1, callCount)

	// ?refresh=true should bypass cache and call handler again
	req2 := httptest.NewRequest("GET", "/api/v1/rgds?refresh=true", nil)
	wrapped.ServeHTTP(httptest.NewRecorder(), req2)
	assert.Equal(t, 2, callCount, "handler should be called again with ?refresh=true")
}

func TestMiddleware_PostNotCached(t *testing.T) {
	c := New()
	callCount := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		_, _ = w.Write([]byte(`{}`))
	})
	wrapped := Middleware(c, time.Minute)(handler)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("POST", "/api/v1/rgds/validate", nil)
		wrapped.ServeHTTP(httptest.NewRecorder(), req)
	}
	assert.Equal(t, 3, callCount, "POST requests should never be cached")
}

func TestCacheKey_SortsQueryParams(t *testing.T) {
	r1, _ := http.NewRequest("GET", "/api/v1/rgds?b=2&a=1", nil)
	r2, _ := http.NewRequest("GET", "/api/v1/rgds?a=1&b=2", nil)
	assert.Equal(t, cacheKey(r1), cacheKey(r2), "same params in different order should produce the same key")
}
