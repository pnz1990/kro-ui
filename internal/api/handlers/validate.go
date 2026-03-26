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
	"io"
	"net/http"

	"github.com/rs/zerolog"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/yaml"

	apitypes "github.com/pnz1990/kro-ui/internal/api/types"
	"github.com/pnz1990/kro-ui/internal/validate"
)

const maxBodyBytes = 1 << 20 // 1 MiB

// ValidateRGD performs a Kubernetes dry-run apply (dryRun=All) of the RGD YAML
// in the request body. This triggers kro's admission webhook without persisting
// any state to etcd.
//
// POST /api/v1/rgds/validate
// Content-Type: text/plain  (raw YAML body)
//
// Response: DryRunResult JSON
//   - { "valid": true } when kro's admission webhook accepted the object.
//   - { "valid": false, "error": "..." } when rejected.
//   - HTTP 400 when the body is not a ResourceGraphDefinition.
//   - HTTP 503 on cluster connectivity failure.
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
	decoder := yaml.NewYAMLToJSONDecoder(io.NopCloser(
		// Wrap the body bytes in a reader
		func() io.Reader {
			return &bytesReader{data: body, pos: 0}
		}(),
	))
	if decErr := decoder.Decode(obj); decErr != nil {
		respondError(w, http.StatusBadRequest, "invalid YAML: "+decErr.Error())
		return
	}

	// Guard: must be a ResourceGraphDefinition
	if obj.GetKind() != "ResourceGraphDefinition" {
		respondError(w, http.StatusBadRequest, "body is not a ResourceGraphDefinition")
		return
	}

	name := obj.GetName()
	if name == "" {
		name = "dry-run-validate"
	}

	// Perform dry-run apply — does NOT persist state
	_, applyErr := h.factory.Dynamic().Resource(rgdGVR).Apply(
		r.Context(),
		name,
		obj,
		metav1.ApplyOptions{
			DryRun:       []string{"All"},
			FieldManager: "kro-ui",
		},
	)
	if applyErr == nil {
		respond(w, http.StatusOK, apitypes.DryRunResult{Valid: true})
		return
	}

	// Extract the human-readable message from a Kubernetes API status error
	if statusErr, ok := applyErr.(*k8serrors.StatusError); ok {
		log.Debug().Str("rgd", name).Str("reason", string(statusErr.Status().Reason)).
			Msg("dry-run validate: kro rejected")
		respond(w, http.StatusOK, apitypes.DryRunResult{
			Valid: false,
			Error: statusErr.Status().Message,
		})
		return
	}

	// Generic cluster connectivity failure
	log.Error().Err(applyErr).Str("rgd", name).Msg("dry-run validate: cluster error")
	respondError(w, http.StatusServiceUnavailable, "cluster unreachable: "+applyErr.Error())
}

// ValidateRGDStatic performs offline static validation of an RGD YAML using
// kro's own Go library packages (pkg/simpleschema and pkg/cel). It does NOT
// contact the Kubernetes API server — all checks are purely local.
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
	decoder := yaml.NewYAMLToJSONDecoder(io.NopCloser(&bytesReader{data: body, pos: 0}))
	if decErr := decoder.Decode(obj); decErr != nil {
		log.Warn().Err(decErr).Msg("static validate: YAML decode failed")
		respond(w, http.StatusOK, apitypes.StaticValidationResult{Issues: []apitypes.StaticIssue{}})
		return
	}

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
			allIssues = append(allIssues, validate.ValidateCELExpressions(celResources)...)
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

// bytesReader is a simple io.Reader over a []byte slice (avoids bytes.NewReader
// allocation in the hot path and keeps the handler self-contained).
type bytesReader struct {
	data []byte
	pos  int
}

func (b *bytesReader) Read(p []byte) (int, error) {
	if b.pos >= len(b.data) {
		return 0, io.EOF
	}
	n := copy(p, b.data[b.pos:])
	b.pos += n
	return n, nil
}
