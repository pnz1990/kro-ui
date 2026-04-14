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
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/rs/zerolog"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/yaml"

	apitypes "github.com/pnz1990/kro-ui/internal/api/types"
	"github.com/pnz1990/kro-ui/internal/validate"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// kroVersionForRequest returns the kro version string for the currently active
// context. It reads from the capabilities cache (populated by GetCapabilities),
// returning "" when the cache is cold so ValidateCELExpressions falls back to
// the most conservative environment.
func kroVersionForRequest() string {
	if cached := capCache.get(); cached != nil {
		return cached.Version
	}
	return ""
}

// ValidateRGD performs OFFLINE static validation of the RGD YAML in the request
// body using kro's own Go library packages. It does NOT contact the Kubernetes
// API server and does NOT issue any PATCH/Apply verb.
//
// This replaced the previous server-side apply (SSA) dry-run implementation which
// violated Constitution §III (read-only contract) and required a PATCH ClusterRole
// that the Helm chart never granted (GH #303).
//
// CEL expressions are validated against the CEL environment matching the connected
// cluster's kro version (read from the capabilities cache). This prevents false
// positives where a function like hash.fnv64a() appears valid on kro v0.8.5.
//
// POST /api/v1/rgds/validate
// Content-Type: text/plain  (raw YAML body)
//
// Response: DryRunResult JSON
//   - { "valid": true } when all static checks pass.
//   - { "valid": false, "error": "..." } when one or more issues are found.
//   - HTTP 400 when the body is not a ResourceGraphDefinition.
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US9
func (h *Handler) ValidateRGD(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body: "+err.Error())
		return
	}
	if len(body) == 0 {
		respondError(w, http.StatusBadRequest, "empty body")
		return
	}

	// Decode YAML body into an unstructured object
	obj := &unstructured.Unstructured{}
	decoder := yaml.NewYAMLToJSONDecoder(io.NopCloser(bytes.NewReader(body)))
	if decErr := decoder.Decode(obj); decErr != nil {
		respondError(w, http.StatusBadRequest, "invalid YAML: "+decErr.Error())
		return
	}

	// Guard: must be a ResourceGraphDefinition
	if obj.GetKind() != "ResourceGraphDefinition" {
		respondError(w, http.StatusBadRequest, "body is not a ResourceGraphDefinition")
		return
	}

	// Run offline static validation — same logic as ValidateRGDStatic.
	// No PATCH/Apply verb is issued; no cluster contact.
	kroVersion := kroVersionForRequest()
	var allIssues []apitypes.StaticIssue

	specMap := extractSpecFields(obj.Object)
	if len(specMap) > 0 {
		allIssues = append(allIssues, validate.ValidateSpecFields(specMap)...)
	}

	if resources, ok := obj.Object["spec"].(map[string]any); ok {
		resourceList, _ := resources["resources"].([]any)
		var ids []string
		var celResources []validate.ResourceExpressions

		for _, item := range resourceList {
			res, ok := item.(map[string]any)
			if !ok {
				continue
			}
			id, _ := res["id"].(string)
			ids = append(ids, id)

			var exprs []string
			if tmpl, ok := res["template"].(map[string]any); ok {
				exprs = extractExpressionsFromMap(tmpl)
			}
			if len(exprs) > 0 {
				celResources = append(celResources, validate.ResourceExpressions{
					ID:          id,
					Expressions: exprs,
				})
			}
		}

		if len(ids) > 0 {
			allIssues = append(allIssues, validate.ValidateResourceIDs(ids)...)
		}
		if len(celResources) > 0 {
			allIssues = append(allIssues, validate.ValidateCELExpressions(kroVersion, celResources)...)
		}
	}

	if len(allIssues) == 0 {
		log.Debug().Str("rgd", obj.GetName()).Msg("validate: no issues found")
		respond(w, http.StatusOK, apitypes.DryRunResult{Valid: true})
		return
	}

	// Aggregate issue messages for the DryRunResult.Error field
	msgs := make([]string, 0, len(allIssues))
	for _, iss := range allIssues {
		if iss.Field != "" {
			msgs = append(msgs, fmt.Sprintf("%s: %s", iss.Field, iss.Message))
		} else {
			msgs = append(msgs, iss.Message)
		}
	}
	log.Debug().Str("rgd", obj.GetName()).Int("issues", len(allIssues)).Msg("validate: issues found")
	respond(w, http.StatusOK, apitypes.DryRunResult{
		Valid: false,
		Error: strings.Join(msgs, "; "),
	})
}

// ValidateRGDStatic performs offline static validation of an RGD YAML using
// kro's own Go library packages (pkg/simpleschema and pkg/cel). It does NOT
// contact the Kubernetes API server — all checks are purely local.
//
// CEL expressions are validated against the CEL environment matching the connected
// cluster's kro version (read from the capabilities cache).
//
// POST /api/v1/rgds/validate/static
// Content-Type: text/plain  (raw YAML body)
//
// Response: StaticValidationResult JSON { "issues": [...] }
// Issues is always a non-nil array. HTTP 200 always (even with issues).
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US10
func (h *Handler) ValidateRGDStatic(w http.ResponseWriter, r *http.Request) {
	log := zerolog.Ctx(r.Context())

	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes))
	if err != nil || len(body) == 0 {
		respond(w, http.StatusOK, apitypes.StaticValidationResult{Issues: []apitypes.StaticIssue{}})
		return
	}

	// Decode YAML into unstructured for field extraction
	obj := &unstructured.Unstructured{}
	decoder := yaml.NewYAMLToJSONDecoder(io.NopCloser(bytes.NewReader(body)))
	if decErr := decoder.Decode(obj); decErr != nil {
		log.Warn().Err(decErr).Msg("static validate: YAML decode failed")
		respond(w, http.StatusOK, apitypes.StaticValidationResult{Issues: []apitypes.StaticIssue{}})
		return
	}

	kroVersion := kroVersionForRequest()
	var allIssues []apitypes.StaticIssue

	// ── Extract and validate spec.schema.spec fields ─────────────────────
	specMap := extractSpecFields(obj.Object)
	if len(specMap) > 0 {
		allIssues = append(allIssues, validate.ValidateSpecFields(specMap)...)
	}

	// ── Extract and validate resource IDs + CEL expressions ──────────────
	resources, ok := obj.Object["spec"].(map[string]any)
	if ok {
		resourceList, _ := resources["resources"].([]any)
		var ids []string
		var celResources []validate.ResourceExpressions

		for _, item := range resourceList {
			res, ok := item.(map[string]any)
			if !ok {
				continue
			}
			id, _ := res["id"].(string)
			ids = append(ids, id)

			// Extract CEL expressions from template
			var exprs []string
			if tmpl, ok := res["template"].(map[string]any); ok {
				exprs = extractExpressionsFromMap(tmpl)
			}
			if len(exprs) > 0 {
				celResources = append(celResources, validate.ResourceExpressions{
					ID:          id,
					Expressions: exprs,
				})
			}
		}

		if len(ids) > 0 {
			allIssues = append(allIssues, validate.ValidateResourceIDs(ids)...)
		}
		if len(celResources) > 0 {
			allIssues = append(allIssues, validate.ValidateCELExpressions(kroVersion, celResources)...)
		}
	}

	if allIssues == nil {
		allIssues = []apitypes.StaticIssue{}
	}
	respond(w, http.StatusOK, apitypes.StaticValidationResult{Issues: allIssues})
}

// ── helpers ───────────────────────────────────────────────────────────────

// extractSpecFields walks spec.schema.spec and returns a map of field name → type string.
func extractSpecFields(obj map[string]any) map[string]string {
	result := make(map[string]string)
	spec, ok := obj["spec"].(map[string]any)
	if !ok {
		return result
	}
	schema, ok := spec["schema"].(map[string]any)
	if !ok {
		return result
	}
	specFields, ok := schema["spec"].(map[string]any)
	if !ok {
		return result
	}
	for name, val := range specFields {
		if s, ok := val.(string); ok {
			result[name] = s
		}
	}
	return result
}

// extractExpressionsFromMap recursively walks a map and collects "${...}" strings.
func extractExpressionsFromMap(m map[string]any) []string {
	var exprs []string
	for _, v := range m {
		switch vt := v.(type) {
		case string:
			exprs = append(exprs, validate.ExtractCELExpressions(vt)...)
		case map[string]any:
			exprs = append(exprs, extractExpressionsFromMap(vt)...)
		case []any:
			for _, item := range vt {
				if sm, ok := item.(map[string]any); ok {
					exprs = append(exprs, extractExpressionsFromMap(sm)...)
				} else if s, ok := item.(string); ok {
					exprs = append(exprs, validate.ExtractCELExpressions(s)...)
				}
			}
		}
	}
	return exprs
}

// bytesReader removed — use bytes.NewReader from stdlib instead.
// bytes.Reader implements io.ReadSeeker which handles multi-document YAML correctly.
