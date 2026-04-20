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

// Package validate — internal (white-box) tests for package-private helpers.
// Uses `package validate` (not `package validate_test`) to access unexported
// functions: compareVersionStrings, parseVersionTriple, envForVersion,
// celVersionRegistry.
package validate

import (
	"errors"
	"sync"
	"testing"
)

// ── compareVersionStrings ─────────────────────────────────────────────────

func TestCompareVersionStrings(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		// Major comparison
		{"1.0.0", "0.9.1", 1},
		{"0.9.1", "1.0.0", -1},
		// Minor comparison (same major)
		{"0.9.0", "0.8.5", 1},
		{"0.8.5", "0.9.0", -1},
		// Patch comparison (same major.minor)
		{"0.9.2", "0.9.1", 1},
		{"0.9.1", "0.9.2", -1},
		// Equal
		{"0.9.1", "0.9.1", 0},
		{"0.8.0", "0.8.0", 0},
		// Leading "v" stripped
		{"v0.9.1", "0.9.1", 0},
		{"v0.9.1", "v0.9.0", 1},
		// Pre-release stripped
		{"0.9.1-alpha.1", "0.9.1", 0},
		{"v0.9.1-rc.2", "0.9.0", 1},
		// Unparseable treated as 0.0.0
		{"", "0.0.0", 0},
		{"unknown", "0.0.0", 0},
		{"bad", "0.0.0", 0},
	}

	for _, tt := range tests {
		t.Run(tt.a+"_vs_"+tt.b, func(t *testing.T) {
			got := compareVersionStrings(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("compareVersionStrings(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// ── parseVersionTriple ────────────────────────────────────────────────────

func TestParseVersionTriple(t *testing.T) {
	tests := []struct {
		input                       string
		wantMaj, wantMin, wantPatch int
	}{
		// Normal
		{"0.9.1", 0, 9, 1},
		{"1.2.3", 1, 2, 3},
		// Leading lowercase v
		{"v0.9.1", 0, 9, 1},
		// Leading uppercase V
		{"V0.9.1", 0, 9, 1},
		// Pre-release suffix stripped
		{"0.9.1-alpha.1", 0, 9, 1},
		{"v0.9.1-rc.2", 0, 9, 1},
		// Fewer than 3 parts → (0,0,0)
		{"0.9", 0, 0, 0},
		{"1", 0, 0, 0},
		// Empty → (0,0,0)
		{"", 0, 0, 0},
		// Unparseable → (0,0,0)
		{"not.a.version", 0, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			maj, min, patch := parseVersionTriple(tt.input)
			if maj != tt.wantMaj || min != tt.wantMin || patch != tt.wantPatch {
				t.Errorf("parseVersionTriple(%q) = (%d,%d,%d), want (%d,%d,%d)",
					tt.input, maj, min, patch, tt.wantMaj, tt.wantMin, tt.wantPatch)
			}
		})
	}
}

// ── envForVersion: initErr path ───────────────────────────────────────────

// TestEnvForVersionInitError injects a poisoned registry entry and verifies
// that envForVersion propagates the build error correctly. The sticky
// sync.Once behaviour is also verified: a second call returns the same error
// without calling build again.
func TestEnvForVersionInitError(t *testing.T) {
	buildCalls := 0
	poisoned := &celVersionEntry{
		minVersion: "99.0.0", // newest-first; will always be selected for "99.0.0"
		build: func() (func(string, []string) error, error) {
			buildCalls++
			return nil, errors.New("injected build failure")
		},
	}

	// Prepend to the registry for this test; restore afterwards.
	orig := celVersionRegistry
	celVersionRegistry = append([]*celVersionEntry{poisoned}, celVersionRegistry...)
	defer func() { celVersionRegistry = orig }()

	fn, err := envForVersion("99.0.0")
	if err == nil {
		t.Fatal("expected error from poisoned entry, got nil")
	}
	if fn != nil {
		t.Error("expected nil fn on error, got non-nil")
	}
	if buildCalls != 1 {
		t.Errorf("build called %d times, want 1", buildCalls)
	}

	// Second call: sync.Once must not re-invoke build.
	fn2, err2 := envForVersion("99.0.0")
	if err2 == nil {
		t.Fatal("expected same error on second call, got nil")
	}
	if fn2 != nil {
		t.Error("expected nil fn on second call")
	}
	if buildCalls != 1 {
		t.Errorf("build called %d times after second call, want still 1", buildCalls)
	}
}

// TestEnvForVersionBelowMinimum verifies that a version below all registry
// entries (e.g. "0.7.0") falls through to the oldest (last) entry.
func TestEnvForVersionBelowMinimum(t *testing.T) {
	// "0.7.0" is below the oldest minVersion "0.8.0"; should still return a
	// valid fn (the v0.8.x fallback), not an error.
	fn, err := envForVersion("0.7.0")
	if err != nil {
		t.Fatalf("unexpected error for version below minimum: %v", err)
	}
	if fn == nil {
		t.Fatal("expected non-nil fn for version below minimum")
	}

	// The returned fn should accept a valid base expression.
	if err := fn("schema.spec.replicas + 1", []string{}); err != nil {
		t.Errorf("base expression unexpectedly rejected: %v", err)
	}
}

// ── envForVersion: version isolation (real function-availability check) ───

// TestEnvForVersionFunctionIsolation verifies that the v0.8.x environment
// REJECTS functions introduced in later versions via type-checking (not just
// parse-phase). This is the core correctness guarantee of the whole system.
func TestEnvForVersionFunctionIsolation(t *testing.T) {
	// hash.fnv64a is registered only in v0.9.1+.
	hashExpr := `hash.fnv64a("hello")`

	// omit() is registered only in v0.9.0+.
	omitExpr := `schema.spec.val != "" ? schema.spec.val : omit()`

	tests := []struct {
		name       string
		kroVersion string
		expr       string
		wantErr    bool
	}{
		// v0.8.x must REJECT hash.fnv64a (type-check: undeclared function)
		{"hash rejected on v0.8.5", "0.8.5", hashExpr, true},
		{"hash rejected on v0.8.0", "0.8.0", hashExpr, true},
		// v0.9.1 must ACCEPT hash.fnv64a
		{"hash accepted on v0.9.1", "v0.9.1", hashExpr, false},
		// future version also accepts hash
		{"hash accepted on v1.0.0", "v1.0.0", hashExpr, false},

		// v0.8.x must REJECT omit()
		{"omit rejected on v0.8.5", "0.8.5", omitExpr, true},
		// v0.9.0 must ACCEPT omit()
		{"omit accepted on v0.9.0", "0.9.0", omitExpr, false},
		{"omit accepted on v0.9.1", "0.9.1", omitExpr, false},

		// hash must also be REJECTED on v0.9.0 (only in v0.9.1+)
		{"hash rejected on v0.9.0", "0.9.0", hashExpr, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fn, err := envForVersion(tt.kroVersion)
			if err != nil {
				t.Fatalf("envForVersion(%q): unexpected error: %v", tt.kroVersion, err)
			}
			checkErr := fn(tt.expr, []string{})
			if tt.wantErr && checkErr == nil {
				t.Errorf("expected type-check error for %q on kro %s, but expression was accepted",
					tt.expr, tt.kroVersion)
			}
			if !tt.wantErr && checkErr != nil {
				t.Errorf("expected expression %q to be accepted on kro %s, but got: %v",
					tt.expr, tt.kroVersion, checkErr)
			}
		})
	}
}

// ── sync.Once isolation between entries ──────────────────────────────────

// TestCelVersionEntryIndependence verifies each registry entry has its own
// sync.Once — a build failure in one entry does not poison another.
func TestCelVersionEntryIndependence(t *testing.T) {
	poisoned := &celVersionEntry{
		minVersion: "98.0.0",
		build: func() (func(string, []string) error, error) {
			return nil, errors.New("entry A fails")
		},
	}
	good := &celVersionEntry{
		minVersion: "97.0.0",
		once:       sync.Once{},
		build: func() (func(string, []string) error, error) {
			return func(expr string, vars []string) error { return nil }, nil
		},
	}

	orig := celVersionRegistry
	celVersionRegistry = append([]*celVersionEntry{poisoned, good}, celVersionRegistry...)
	defer func() { celVersionRegistry = orig }()

	// Poison entry A
	if _, err := envForVersion("98.0.0"); err == nil {
		t.Fatal("expected error from poisoned entry A")
	}

	// Good entry B must still work
	fn, err := envForVersion("97.0.0")
	if err != nil {
		t.Fatalf("good entry B failed unexpectedly: %v", err)
	}
	if fn == nil {
		t.Fatal("good entry B returned nil fn")
	}
}
