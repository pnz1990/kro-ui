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
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSPAServing(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) *http.Request
		check func(t *testing.T, rr *httptest.ResponseRecorder)
	}{
		{
			name: "GET / returns 200 with HTML containing div#root",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Header().Get("Content-Type"), "text/html")
				assert.Contains(t, rr.Body.String(), `<div id="root">`)
			},
		},
		{
			name: "GET /rgds/something returns 200 with HTML (SPA fallback)",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/rgds/something", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `<div id="root">`,
					"SPA fallback should serve index.html for unknown paths")
			},
		},
		{
			name: "GET /rgds/web-service-graph returns index.html not 404",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/rgds/web-service-graph", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code,
					"client-side route must not return 404")
				assert.Contains(t, rr.Body.String(), `<div id="root">`)
			},
		},
		{
			name: "GET /api/v1/healthz still returns ok not index.html",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/api/v1/healthz", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := strings.TrimSpace(rr.Body.String())
				assert.Equal(t, "ok", body,
					"API routes must not be caught by SPA fallback")
			},
		},
		{
			name: "GET /index.html redirects to / (standard file server behavior)",
			build: func(t *testing.T) *http.Request {
				t.Helper()
				return httptest.NewRequest(http.MethodGet, "/index.html", nil)
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder) {
				t.Helper()
				// Go's file server redirects /index.html to / with 301.
				// This is correct behavior — the SPA fallback at / serves the file.
				assert.Contains(t, []int{http.StatusOK, http.StatusMovedPermanently}, rr.Code)
			},
		},
	}

	r, err := NewRouter(nil, "")
	require.NoError(t, err)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.build(t)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}
