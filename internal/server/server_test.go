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
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

	r := NewRouter(nil)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := tt.build(t)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)
			tt.check(t, rr)
		})
	}
}
