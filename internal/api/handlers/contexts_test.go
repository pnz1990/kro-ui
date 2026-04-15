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
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

func TestListContexts(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (*Handler, *stubClientFactory)
		check func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory)
	}{
		{
			name: "returns all contexts and active",
			build: func(t *testing.T) (*Handler, *stubClientFactory) {
				t.Helper()
				stub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "dev", Cluster: "dev-cluster", User: "dev-user"},
						{Name: "prod", Cluster: "prod-cluster", User: "prod-user"},
					},
					activeContext: "dev",
				}
				return newTestHandler(stub), stub
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				body := rr.Body.String()
				assert.Contains(t, body, `"active"`)
				assert.Contains(t, body, `"contexts"`)
				assert.Contains(t, body, `"dev"`)
				assert.Contains(t, body, `"prod"`)
			},
		},
		{
			name: "returns active context matching factory state",
			build: func(t *testing.T) (*Handler, *stubClientFactory) {
				t.Helper()
				stub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "staging", Cluster: "stg", User: "stg-user"},
					},
					activeContext: "staging",
				}
				return newTestHandler(stub), stub
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Body.String(), `"staging"`)
			},
		},
		{
			name: "returns 500 when factory.ListContexts fails",
			build: func(t *testing.T) (*Handler, *stubClientFactory) {
				t.Helper()
				stub := &stubClientFactory{
					listErr: fmt.Errorf("kubeconfig not readable"),
				}
				return newTestHandler(stub), stub
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusInternalServerError, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, stub := tt.build(t)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/contexts", nil)
			rr := httptest.NewRecorder()
			h.ListContexts(rr, req)
			tt.check(t, rr, stub)
		})
	}
}

func TestSwitchContext(t *testing.T) {
	tests := []struct {
		name  string
		build func(t *testing.T) (*Handler, *stubClientFactory, *http.Request)
		check func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory)
	}{
		{
			name: "returns 200 for valid context",
			build: func(t *testing.T) (*Handler, *stubClientFactory, *http.Request) {
				t.Helper()
				stub := &stubClientFactory{
					contexts: []k8sclient.Context{
						{Name: "dev", Cluster: "dev-cluster", User: "dev-user"},
						{Name: "prod", Cluster: "prod-cluster", User: "prod-user"},
					},
					activeContext: "dev",
				}
				h := newTestHandler(stub)
				req := httptest.NewRequest(http.MethodPost, "/api/v1/contexts/switch",
					strings.NewReader(`{"context": "prod"}`))
				req.Header.Set("Content-Type", "application/json")
				return h, stub, req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusOK, rr.Code)
				assert.Contains(t, rr.Body.String(), `"active"`)
				assert.Contains(t, rr.Body.String(), `"prod"`)
				assert.Equal(t, "prod", stub.ActiveContext(),
					"stub active context should be updated")
			},
		},
		{
			name: "returns 400 for empty context",
			build: func(t *testing.T) (*Handler, *stubClientFactory, *http.Request) {
				t.Helper()
				stub := &stubClientFactory{
					contexts:      []k8sclient.Context{{Name: "dev"}},
					activeContext: "dev",
				}
				h := newTestHandler(stub)
				req := httptest.NewRequest(http.MethodPost, "/api/v1/contexts/switch",
					strings.NewReader(`{"context": ""}`))
				req.Header.Set("Content-Type", "application/json")
				return h, stub, req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusBadRequest, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
			},
		},
		{
			name: "returns 400 for unknown context",
			build: func(t *testing.T) (*Handler, *stubClientFactory, *http.Request) {
				t.Helper()
				stub := &stubClientFactory{
					contexts:      []k8sclient.Context{{Name: "dev"}},
					activeContext: "dev",
				}
				h := newTestHandler(stub)
				req := httptest.NewRequest(http.MethodPost, "/api/v1/contexts/switch",
					strings.NewReader(`{"context": "nonexistent"}`))
				req.Header.Set("Content-Type", "application/json")
				return h, stub, req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusBadRequest, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
				assert.Contains(t, rr.Body.String(), "not found")
			},
		},
		{
			name: "returns 400 for invalid JSON",
			build: func(t *testing.T) (*Handler, *stubClientFactory, *http.Request) {
				t.Helper()
				stub := &stubClientFactory{
					contexts:      []k8sclient.Context{{Name: "dev"}},
					activeContext: "dev",
				}
				h := newTestHandler(stub)
				req := httptest.NewRequest(http.MethodPost, "/api/v1/contexts/switch",
					strings.NewReader(`not json`))
				req.Header.Set("Content-Type", "application/json")
				return h, stub, req
			},
			check: func(t *testing.T, rr *httptest.ResponseRecorder, stub *stubClientFactory) {
				t.Helper()
				require.Equal(t, http.StatusBadRequest, rr.Code)
				assert.Contains(t, rr.Body.String(), `"error"`)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, stub, req := tt.build(t)
			rr := httptest.NewRecorder()
			h.SwitchContext(rr, req)
			tt.check(t, rr, stub)
		})
	}
}
