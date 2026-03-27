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

// Package validate performs offline static validation of ResourceGraphDefinition
// content using kro's own library packages. It does NOT contact the Kubernetes
// API server — all checks are purely local.
//
// This package is the single point of contact with kro library code.
// When upgrading kro (go get github.com/kubernetes-sigs/kro@vX.Y.Z && make tidy),
// only this package needs updating if kro's library API changes.
//
// Spec: .specify/specs/045-rgd-designer-validation-optimizer/ US10
package validate

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	cel "github.com/google/cel-go/cel"
	krocel "github.com/kubernetes-sigs/kro/pkg/cel"
	kroschema "github.com/kubernetes-sigs/kro/pkg/simpleschema"

	apitypes "github.com/pnz1990/kro-ui/internal/api/types"
)

// ── ResourceExpressions ───────────────────────────────────────────────────

// ResourceExpressions is the input type for ValidateCELExpressions.
// Expressions contains all raw "${...}" strings found in the resource template.
type ResourceExpressions struct {
	// ID is the resource id value (used in field path in issue reports).
	ID string
	// Expressions is the list of raw "${...}" strings extracted from the template.
	Expressions []string
}

// ── CEL environment singleton ──────────────────────────────────────────────

var (
	celEnvOnce sync.Once
	celEnv     *cel.Env
	celEnvErr  error
)

// celEnvironment returns the cached kro CEL environment.
// Initialised once on first call. Thread-safe.
func celEnvironment() (*cel.Env, error) {
	celEnvOnce.Do(func() {
		celEnv, celEnvErr = krocel.DefaultEnvironment()
	})
	return celEnv, celEnvErr
}

// ── lowerCamelCase regex ───────────────────────────────────────────────────

// kro requires resource IDs to be lowerCamelCase:
// starts with a lowercase letter, followed by alphanumeric characters only.
var lowerCamelRE = regexp.MustCompile(`^[a-z][a-zA-Z0-9]*$`)

// celExprRE matches "${...}" expressions in template text.
var celExprRE = regexp.MustCompile(`\$\{([^}]+)\}`)

// ── ValidateSpecFields ─────────────────────────────────────────────────────

// ValidateSpecFields validates kro SimpleSchema type strings from spec.schema.spec.
//
// fieldMap maps field name → raw type string (e.g. `"integer | minimum=1 | maximum=100"`).
// Surrounding double-quotes are stripped before validation.
//
// Uses kroschema.ToOpenAPISpec to validate the full field spec through kro's own
// schema transformer — the same code path kro uses when applying an RGD. This
// catches unknown base types and unknown marker keys.
//
// Returns one StaticIssue per invalid field.
// Panic-safe: any panic from kro library code is recovered and returned as an issue.
func ValidateSpecFields(fieldMap map[string]string) (issues []apitypes.StaticIssue) {
	defer func() {
		if r := recover(); r != nil {
			issues = append(issues, apitypes.StaticIssue{
				Field:   "internal",
				Message: fmt.Sprintf("validation panic: %v", r),
			})
		}
	}()

	for name, rawType := range fieldMap {
		// Strip surrounding double-quotes (kro YAML uses quoted strings)
		s := rawType
		if strings.HasPrefix(s, `"`) && strings.HasSuffix(s, `"`) {
			s = s[1 : len(s)-1]
		}
		// Normalise our " | " separator format to kro's format:
		// kro ParseField does SplitN(s, "|", 2) — only the FIRST "|" is the
		// type/markers boundary. Markers themselves must be space-separated.
		// Our format: "integer | minimum=1 | maximum=100"
		// kro format:  "integer | minimum=1 maximum=100"
		// So we join the marker tokens with spaces after the first "|".
		parts := strings.SplitN(s, " | ", 2)
		if len(parts) == 2 {
			// Replace remaining " | " separators in the markers section with spaces
			markers := strings.ReplaceAll(parts[1], " | ", " ")
			s = parts[0] + " | " + markers
		}
		// Validate via ToOpenAPISpec — the same path kro uses when applying.
		specMap := map[string]interface{}{name: s}
		_, err := kroschema.ToOpenAPISpec(specMap, nil)
		if err != nil {
			issues = append(issues, apitypes.StaticIssue{
				Field:   "spec.schema.spec." + name,
				Message: err.Error(),
			})
		}
	}
	return issues
}

// ── ValidateCELExpressions ────────────────────────────────────────────────

// ValidateCELExpressions validates CEL syntax in resource template expressions.
//
// Each entry in resources carries a resource ID and a list of raw "${...}"
// strings extracted from the template body. Non-"${...}" strings are skipped.
//
// Returns one StaticIssue per expression that fails CEL parsing, referencing
// the resource ID.
// Panic-safe: any panic from kro library code is recovered and returned as an issue.
func ValidateCELExpressions(resources []ResourceExpressions) (issues []apitypes.StaticIssue) {
	defer func() {
		if r := recover(); r != nil {
			issues = append(issues, apitypes.StaticIssue{
				Field:   "internal",
				Message: fmt.Sprintf("validation panic: %v", r),
			})
		}
	}()

	env, err := celEnvironment()
	if err != nil {
		return []apitypes.StaticIssue{{
			Field:   "internal",
			Message: "CEL environment unavailable: " + err.Error(),
		}}
	}

	for _, res := range resources {
		for _, raw := range res.Expressions {
			// Only process "${...}" expressions
			if !strings.HasPrefix(raw, "${") || !strings.HasSuffix(raw, "}") {
				continue
			}
			// Strip the ${ } wrappers to get raw CEL text
			celText := raw[2 : len(raw)-1]
			ast, iss := env.Parse(celText)
			if iss != nil && iss.Err() != nil {
				issues = append(issues, apitypes.StaticIssue{
					Field:   fmt.Sprintf("spec.resources[%s].template", res.ID),
					Message: iss.Err().Error(),
				})
			}
			_ = ast
		}
	}
	return issues
}

// ── ValidateResourceIDs ───────────────────────────────────────────────────

// ValidateResourceIDs validates that resource IDs conform to kro's lowerCamelCase
// format: starts with a lowercase letter, followed by alphanumeric characters only.
//
// Empty IDs are silently ignored (already caught by generator-level filter F-1).
// Returns one StaticIssue per non-conforming ID.
func ValidateResourceIDs(ids []string) []apitypes.StaticIssue {
	var issues []apitypes.StaticIssue
	for _, id := range ids {
		if id == "" {
			continue
		}
		if !lowerCamelRE.MatchString(id) {
			issues = append(issues, apitypes.StaticIssue{
				Field:   fmt.Sprintf("spec.resources[%s].id", id),
				Message: "resource ID must be lowerCamelCase",
			})
		}
	}
	return issues
}

// ── ExtractCELExpressions ────────────────────────────────────────────────

// ExtractCELExpressions extracts all "${...}" expression strings from a template
// body string. Used by the ValidateRGDStatic handler when walking resource templates.
//
// Returns only the matched "${...}" substrings — not the surrounding text.
func ExtractCELExpressions(templateText string) []string {
	matches := celExprRE.FindAllString(templateText, -1)
	return matches
}
