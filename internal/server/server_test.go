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

package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// testKubeconfig is a minimal kubeconfig with one context for server tests.
// The server URL is intentionally unreachable — unit tests only check route wiring,
// not actual k8s API calls.
const testKubeconfig = `apiVersion: v1
kind: Config
current-context: test
clusters:
- cluster:
    server: https://127.0.0.1:1
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-user
  name: test
users:
- name: test-user
  user:
    token: test-token
`

// writeTestKubeconfig writes the test kubeconfig to a temp file.
func writeTestKubeconfig(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "kubeconfig")
	require.NoError(t, os.WriteFile(path, []byte(testKubeconfig), 0600))
	return path
}

// newTestFactory creates a ClientFactory backed by the fake kubeconfig.
// The factory is valid (routes are registered) but any actual k8s call will fail.
func newTestFactory(t *testing.T) *k8sclient.ClientFactory {
	t.Helper()
	f, err := k8sclient.NewClientFactory(writeTestKubeconfig(t), "")
	require.NoError(t, err)
	return f
}

// newTestRouter creates a NewRouter(nil) for unit tests.
// nil factory means only healthz, version, and static serving are wired.
func newTestRouter(t *testing.T) http.Handler {
	t.Helper()
	r, err := NewRouter(nil)
	require.NoError(t, err)
	return r
}

// newTestRouterWithFactory creates a NewRouter with a real (but disconnected)
// factory so that all routes are registered. Used to test route availability
// without making real k8s API calls.
func newTestRouterWithFactory(t *testing.T) http.Handler {
	t.Helper()
	r, err := NewRouter(newTestFactory(t))
	require.NoError(t, err)
	return r
}

func TestHealthz(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *http.Request
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "GET /api/v1/healthz returns 200 with body ok",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Equal(t, "ok", rr.Body.String())
			},
		},
		{
			name: "GET /api/v1/healthz does not return JSON content type",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				// healthz is plain text, not JSON
				assert.NotContains(t, rr.Header().Get("Content-Type"), "application/json")
			},
		},
	}

	r := newTestRouter(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.build(t)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// TestVersionEndpoint verifies GET /api/v1/version in nil-factory mode.
// The version endpoint is always available regardless of cluster connectivity.
func TestVersionEndpoint(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *http.Request
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "GET /api/v1/version returns 200 JSON",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/version", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Header().Get("Content-Type"), "application/json")
			},
		},
		{
			name: "GET /api/v1/version response is valid JSON with version fields",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/version", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				var v map[string]interface{}
				require.NoError(t, json.NewDecoder(rr.Body).Decode(&v),
					"version response must be valid JSON")
				assert.Contains(t, v, "version", "version field must be present")
				assert.Contains(t, v, "commit", "commit field must be present")
				assert.Contains(t, v, "buildDate", "buildDate field must be present")
			},
		},
		{
			name: "GET /api/v1/version is not caught by SPA fallback",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/version", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				// Must not be the SPA index.html
				assert.NotContains(t, rr.Body.String(), `<div id="root">`)
			},
		},
	}

	r := newTestRouter(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.build(t)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// TestAPIRoutesWithNilFactory verifies that API routes (beyond healthz/version)
// return 404 (no handler) rather than panicking when factory is nil.
// This confirms the nil-safety contract documented in NewRouter.
func TestAPIRoutesWithNilFactory(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "GET /api/v1/rgds returns 404 without factory", method: http.MethodGet, path: "/api/v1/rgds"},
		{name: "GET /api/v1/contexts returns 404 without factory", method: http.MethodGet, path: "/api/v1/contexts"},
		{name: "GET /api/v1/fleet/summary returns 404 without factory", method: http.MethodGet, path: "/api/v1/fleet/summary"},
	}

	r := newTestRouter(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			// Without a factory, these routes are not registered — chi returns 404.
			assert.Equal(t, http.StatusNotFound, rr.Code,
				"unregistered API routes must return 404 not panic")
		})
	}
}

// TestAPIRoutesRegisteredWithFactory verifies that expected API routes exist
// when a factory is provided. The actual k8s calls will fail (fake server),
// but the routes must be registered (not 404).
// This validates the factory != nil branch of NewRouter.
func TestAPIRoutesRegisteredWithFactory(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "GET /api/v1/rgds route is registered", method: http.MethodGet, path: "/api/v1/rgds"},
		{name: "GET /api/v1/contexts route is registered", method: http.MethodGet, path: "/api/v1/contexts"},
		{name: "GET /api/v1/kro/capabilities route is registered", method: http.MethodGet, path: "/api/v1/kro/capabilities"},
		{name: "GET /api/v1/instances route is registered", method: http.MethodGet, path: "/api/v1/instances"},
	}

	r := newTestRouterWithFactory(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			// Route must be registered — any status except 404 means the handler ran.
			// (The handler will return an error because k8s is unreachable, but not 404.)
			assert.NotEqual(t, http.StatusNotFound, rr.Code,
				"API route %q must be registered when factory is provided", tt.path)
		})
	}
}

// TestCORSHeaders verifies that the CORS middleware is applied correctly.
// kro-ui allows any origin (designed for local dev tool use).
func TestCORSHeaders(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *http.Request
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "OPTIONS preflight returns CORS allow-origin header",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				req := httptest.NewRequest(http.MethodOptions, "/api/v1/healthz", nil)
				req.Header.Set("Origin", "http://localhost:3000")
				req.Header.Set("Access-Control-Request-Method", "GET")
				return req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				assert.Equal(t, "*", rr.Header().Get("Access-Control-Allow-Origin"),
					"CORS allow-origin must be wildcard")
			},
		},
		{
			name: "GET healthz response includes Access-Control-Allow-Origin",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				req := httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil)
				req.Header.Set("Origin", "http://example.com")
				return req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Equal(t, "*", rr.Header().Get("Access-Control-Allow-Origin"),
					"all GET responses must allow cross-origin access")
			},
		},
	}

	r := newTestRouter(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.build(t)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}

// TestNewRouter_UnknownStaticPath confirms that requests to arbitrary paths
// are served the SPA's index.html (client-side router takes over).
// This complements TestSPAServing in embed_test.go with additional path shapes.
func TestNewRouter_UnknownStaticPath(t *testing.T) {
	r := newTestRouter(t)

	paths := []string{
		"/fleet",
		"/author",
		"/instances",
		"/rgds/some-name/graph",
		"/a/b/c/d/e/deep/path",
	}

	for _, path := range paths {
		t.Run("SPA fallback for "+path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			require.Equal(t, http.StatusOK, rr.Code,
				"SPA route %q must return 200, not 404", path)
			assert.True(t,
				strings.Contains(rr.Body.String(), `<div id="root">`) ||
					strings.Contains(rr.Body.String(), "<!doctype html") ||
					strings.Contains(rr.Body.String(), "<!DOCTYPE html"),
				"SPA fallback for %q must serve index.html content", path)
		})
	}
}
