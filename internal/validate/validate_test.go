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

package validate_test

import (
	"strings"
	"testing"

	"github.com/pnz1990/kro-ui/internal/validate"
)

// ── ValidateSpecFields ────────────────────────────────────────────────────

func TestValidateSpecFields(t *testing.T) {
	tests := []struct {
		name      string
		fieldMap  map[string]string
		wantCount int
		wantField string // if wantCount > 0, the issue field must contain this
	}{
		{
			name:      "valid string type",
			fieldMap:  map[string]string{"name": `"string"`},
			wantCount: 0,
		},
		{
			name:      "valid integer type",
			fieldMap:  map[string]string{"replicas": `"integer"`},
			wantCount: 0,
		},
		{
			name:      "valid integer with constraints",
			fieldMap:  map[string]string{"replicas": `"integer | minimum=1 | maximum=100"`},
			wantCount: 0,
		},
		{
			name:      "valid string with required=true marker",
			fieldMap:  map[string]string{"image": `"string | required=true"`},
			wantCount: 0,
		},
		{
			name:      "unquoted string type",
			fieldMap:  map[string]string{"name": "string"},
			wantCount: 0,
		},
		{
			name:      "unknown base type",
			fieldMap:  map[string]string{"replicas": `"badtype"`},
			wantCount: 1,
			wantField: "spec.schema.spec.replicas",
		},
		{
			name:      "empty field map",
			fieldMap:  map[string]string{},
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issues := validate.ValidateSpecFields(tt.fieldMap)
			if len(issues) != tt.wantCount {
				t.Errorf("ValidateSpecFields(%v) returned %d issues, want %d; issues: %v",
					tt.fieldMap, len(issues), tt.wantCount, issues)
			}
			if tt.wantCount > 0 && tt.wantField != "" {
				if len(issues) > 0 && !strings.Contains(issues[0].Field, tt.wantField) {
					t.Errorf("issue[0].Field = %q, want contains %q", issues[0].Field, tt.wantField)
				}
			}
		})
	}
}

// ── ValidateCELExpressions ────────────────────────────────────────────────

func TestValidateCELExpressions(t *testing.T) {
	tests := []struct {
		name      string
		resources []validate.ResourceExpressions
		wantCount int
		wantResID string // if wantCount > 0, the issue field must reference this resource ID
	}{
		{
			name: "valid CEL expression",
			resources: []validate.ResourceExpressions{
				{ID: "web", Expressions: []string{"${schema.spec.replicas}"}},
			},
			wantCount: 0,
		},
		{
			name: "non-dollar-brace expression is skipped",
			resources: []validate.ResourceExpressions{
				{ID: "web", Expressions: []string{"some-literal-value"}},
			},
			wantCount: 0,
		},
		{
			name: "invalid CEL syntax",
			resources: []validate.ResourceExpressions{
				{ID: "web", Expressions: []string{"${x +++ y}"}},
			},
			wantCount: 1,
			wantResID: "web",
		},
		{
			name: "multiple resources, one invalid",
			resources: []validate.ResourceExpressions{
				{ID: "svc", Expressions: []string{"${schema.spec.port}"}},
				{ID: "db", Expressions: []string{"${x !!!}"}},
			},
			wantCount: 1,
			wantResID: "db",
		},
		{
			name:      "empty resources list",
			resources: []validate.ResourceExpressions{},
			wantCount: 0,
		},
		{
			name: "empty expressions list",
			resources: []validate.ResourceExpressions{
				{ID: "web", Expressions: []string{}},
			},
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issues := validate.ValidateCELExpressions(tt.resources)
			if len(issues) != tt.wantCount {
				t.Errorf("ValidateCELExpressions returned %d issues, want %d; issues: %v",
					len(issues), tt.wantCount, issues)
			}
			if tt.wantCount > 0 && tt.wantResID != "" {
				if len(issues) > 0 && !strings.Contains(issues[0].Field, tt.wantResID) {
					t.Errorf("issue[0].Field = %q, want contains %q", issues[0].Field, tt.wantResID)
				}
			}
		})
	}
}

// ── ValidateResourceIDs ───────────────────────────────────────────────────

func TestValidateResourceIDs(t *testing.T) {
	tests := []struct {
		name      string
		ids       []string
		wantCount int
		wantID    string // if wantCount > 0, the issue field must reference this id
	}{
		{
			name:      "valid lowerCamelCase IDs",
			ids:       []string{"web", "database", "configMap"},
			wantCount: 0,
		},
		{
			name:      "PascalCase ID",
			ids:       []string{"MyDB"},
			wantCount: 1,
			wantID:    "MyDB",
		},
		{
			name:      "kebab-case ID",
			ids:       []string{"my-db"},
			wantCount: 1,
			wantID:    "my-db",
		},
		{
			name:      "ID starting with digit",
			ids:       []string{"123abc"},
			wantCount: 1,
			wantID:    "123abc",
		},
		{
			name:      "empty ID is ignored",
			ids:       []string{""},
			wantCount: 0,
		},
		{
			name:      "mixed valid and invalid",
			ids:       []string{"web", "MyDB", "service"},
			wantCount: 1,
			wantID:    "MyDB",
		},
		{
			name:      "empty list",
			ids:       []string{},
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issues := validate.ValidateResourceIDs(tt.ids)
			if len(issues) != tt.wantCount {
				t.Errorf("ValidateResourceIDs(%v) returned %d issues, want %d; issues: %v",
					tt.ids, len(issues), tt.wantCount, issues)
			}
			if tt.wantCount > 0 && tt.wantID != "" {
				if len(issues) > 0 && !strings.Contains(issues[0].Field, tt.wantID) {
					t.Errorf("issue[0].Field = %q, want contains %q", issues[0].Field, tt.wantID)
				}
			}
		})
	}
}

// ── ExtractCELExpressions ────────────────────────────────────────────────

func TestExtractCELExpressions(t *testing.T) {
	tests := []struct {
		name     string
		template string
		want     []string
	}{
		{
			name:     "no expressions",
			template: "spec:\n  replicas: 1",
			want:     nil,
		},
		{
			name:     "single expression",
			template: "spec:\n  replicas: ${schema.spec.replicas}",
			want:     []string{"${schema.spec.replicas}"},
		},
		{
			name:     "multiple expressions",
			template: "${x} and ${y}",
			want:     []string{"${x}", "${y}"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := validate.ExtractCELExpressions(tt.template)
			if len(got) != len(tt.want) {
				t.Errorf("ExtractCELExpressions = %v, want %v", got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("ExtractCELExpressions[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}
