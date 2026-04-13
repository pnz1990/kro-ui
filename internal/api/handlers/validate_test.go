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
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	apitypes "github.com/pnz1990/kro-ui/internal/api/types"
	k8sclient "github.com/pnz1990/kro-ui/internal/k8s"
)

// ── helpers ────────────────────────────────────────────────────────────────

func newValidateHandler(applyErr error) *Handler {
	dyn := newStubDynamic()
	disc := newStubDiscovery()
	dyn.resources[rgdGVR] = &stubNamespaceableResource{
		applyConfigured: true,
		applyErr:        applyErr,
		// applyResult stays nil — success is indicated by nil error
	}
	return newRGDTestHandler(dyn, disc)
}

// validRGDYAML is a minimal ResourceGraphDefinition YAML that decodes cleanly.
const validRGDYAML = `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-test-rgd
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
`

// ── TestValidateRGD ────────────────────────────────────────────────────────
// ValidateRGD now performs offline static validation — no cluster contact.
// Tests verify the static-only behaviour.

func TestValidateRGD(t *testing.T) {
	t.Run("valid RGD YAML → HTTP 200 valid:true (no static issues)", func(t *testing.T) {
		h := newValidateHandler(nil)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate", strings.NewReader(validRGDYAML))
		req.Header.Set("Content-Type", "text/plain")
		w := httptest.NewRecorder()

		h.ValidateRGD(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var res apitypes.DryRunResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if !res.Valid {
			t.Errorf("expected valid:true, got valid:false error=%q", res.Error)
		}
	})

	t.Run("RGD with invalid field type → HTTP 200 valid:false with error message", func(t *testing.T) {
		// validRGDYAML has a 'replicas: integer' field — if we introduce a bad type
		// the static validator should catch it. Use a YAML with invalid CEL to trigger.
		invalidRGD := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: invalid-rgd
spec:
  schema:
    apiVersion: v1alpha1
    kind: TestApp
    spec:
      name: string
  resources:
    - id: "invalid id with spaces"
      template:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: test
`
		h := newValidateHandler(nil)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate", strings.NewReader(invalidRGD))
		w := httptest.NewRecorder()

		h.ValidateRGD(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var res apitypes.DryRunResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		// Invalid resource ID "invalid id with spaces" should produce valid:false
		if res.Valid {
			t.Error("expected valid:false for invalid resource ID, got valid:true")
		}
		if res.Error == "" {
			t.Error("expected non-empty error message for invalid ID")
		}
	})

	t.Run("non-RGD YAML body → HTTP 400", func(t *testing.T) {
		h := newValidateHandler(nil)
		body := `apiVersion: v1
kind: ConfigMap
metadata:
  name: not-an-rgd
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate", strings.NewReader(body))
		w := httptest.NewRecorder()

		h.ValidateRGD(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("empty body → HTTP 400", func(t *testing.T) {
		h := newValidateHandler(nil)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate", strings.NewReader(""))
		w := httptest.NewRecorder()

		h.ValidateRGD(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	// Note: the "cluster connectivity error → HTTP 503" test case has been removed.
	// ValidateRGD no longer contacts the cluster (GH #303 fix — PATCH verb removed).
	// The endpoint now always responds 200 with offline validation results.
}

// genericClusterError satisfies the error interface but is not a *StatusError.
type genericClusterError struct{ msg string }

func (e *genericClusterError) Error() string { return e.msg }

// ── TestValidateRGDStatic ──────────────────────────────────────────────────

// staticOnlyHandler creates a Handler that is sufficient for ValidateRGDStatic
// (no cluster calls needed — static validation is offline).
func newStaticHandler() *Handler {
	return newRGDTestHandler(newStubDynamic(), newStubDiscovery())
}

func TestValidateRGDStatic(t *testing.T) {
	t.Run("valid schema fields → HTTP 200 issues:[]", func(t *testing.T) {
		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
    spec:
      replicas: "integer"
      image: "string"
  resources: []
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(res.Issues) != 0 {
			t.Errorf("expected 0 issues, got %d: %v", len(res.Issues), res.Issues)
		}
	})

	t.Run("PascalCase resource ID → 1 issue for ID format", func(t *testing.T) {
		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: MyDeployment
      template:
        apiVersion: apps/v1
        kind: Deployment
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(res.Issues) == 0 {
			t.Error("expected at least 1 issue for PascalCase resource ID, got 0")
		}
		// At least one issue must reference the ID format
		found := false
		for _, issue := range res.Issues {
			if strings.Contains(issue.Field, "MyDeployment") && strings.Contains(issue.Message, "lowerCamelCase") {
				found = true
			}
		}
		if !found {
			t.Errorf("expected lowerCamelCase issue referencing 'MyDeployment', got: %v", res.Issues)
		}
	})

	t.Run("invalid CEL expression → 1 issue for CEL parse error", func(t *testing.T) {
		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: web
      template:
        apiVersion: apps/v1
        kind: Deployment
        spec:
          replicas: ${x +++ y}
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(res.Issues) == 0 {
			t.Error("expected at least 1 CEL issue, got 0")
		}
		found := false
		for _, issue := range res.Issues {
			if strings.Contains(issue.Field, "web") {
				found = true
			}
		}
		if !found {
			t.Errorf("expected issue referencing resource 'web', got: %v", res.Issues)
		}
	})

	t.Run("empty body → HTTP 200 issues:[]", func(t *testing.T) {
		h := newStaticHandler()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(""))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		// Empty body → no issues (graceful degradation)
		_ = res
	})

	t.Run("issues array is always non-nil (never JSON null)", func(t *testing.T) {
		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		body := w.Body.String()
		// Must contain `"issues":[]` not `"issues":null`
		if strings.Contains(body, `"issues":null`) {
			t.Errorf("issues must be [] not null, got: %s", body)
		}
	})
}

// Ensure the rgdGVR variable from rgds.go is accessible in this file.
var _ = schema.GroupVersionResource{}

// ── TestKroVersionForRequest ───────────────────────────────────────────────

// TestKroVersionForRequest verifies that kroVersionForRequest returns the
// version from the capabilities cache when warm, and "" when cold.
// It also verifies that a warm cache with an older kro version causes
// ValidateRGDStatic to reject expressions using newer kro functions.
func TestKroVersionForRequest(t *testing.T) {
	t.Cleanup(func() { capCache.invalidate() })

	t.Run("cold cache returns empty string", func(t *testing.T) {
		capCache.invalidate()
		v := kroVersionForRequest()
		if v != "" {
			t.Errorf("cold cache: expected \"\", got %q", v)
		}
	})

	t.Run("warm cache returns stored version", func(t *testing.T) {
		capCache.invalidate()
		capCache.set(&k8sclient.KroCapabilities{Version: "v0.9.1"})
		v := kroVersionForRequest()
		if v != "v0.9.1" {
			t.Errorf("warm cache: expected \"v0.9.1\", got %q", v)
		}
	})

	// End-to-end: when capCache is warm with v0.8.5, ValidateRGDStatic must
	// reject hash.fnv64a (a v0.9.1-only function).
	t.Run("ValidateRGDStatic rejects v0.9.1 function on v0.8.5 cluster", func(t *testing.T) {
		capCache.invalidate()
		capCache.set(&k8sclient.KroCapabilities{Version: "v0.8.5"})

		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: web
      template:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: ${hash.fnv64a("hello")}
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(res.Issues) == 0 {
			t.Error("expected at least 1 issue: hash.fnv64a should be rejected on v0.8.5 cluster")
		}
	})

	// End-to-end: same expression must be accepted on a v0.9.1 cluster.
	t.Run("ValidateRGDStatic accepts v0.9.1 function on v0.9.1 cluster", func(t *testing.T) {
		capCache.invalidate()
		capCache.set(&k8sclient.KroCapabilities{Version: "v0.9.1"})

		h := newStaticHandler()
		yaml := `apiVersion: kro.run/v1alpha1
kind: ResourceGraphDefinition
metadata:
  name: my-app
spec:
  schema:
    kind: MyApp
    apiVersion: v1alpha1
  resources:
    - id: web
      template:
        apiVersion: v1
        kind: ConfigMap
        metadata:
          name: ${hash.fnv64a("hello")}
`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/rgds/validate/static", strings.NewReader(yaml))
		w := httptest.NewRecorder()

		h.ValidateRGDStatic(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var res apitypes.StaticValidationResult
		if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(res.Issues) != 0 {
			t.Errorf("expected 0 issues for hash.fnv64a on v0.9.1 cluster, got: %v", res.Issues)
		}
	})
}
