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

package validate

// cel_versions.go — version-scoped CEL parse environments.
//
// Each kro release may add new CEL library functions. Validating an expression
// against the wrong version gives false positives (e.g. hash.fnv64a() appears
// valid on a v0.9.1 environment but kro v0.8.5 does not know it).
//
// This file maintains one CEL environment per kro capability bucket. The
// correct environment is selected at validation time using the kro version
// string reported by the connected cluster (capabilities.Version).
//
// # Adding support for a new kro version
//
// When kro adds new CEL library functions in a release vX.Y.Z:
//  1. Import the new library package at the top of this file (if it is new).
//  2. Append one entry to celVersionRegistry:
//
//	{
//	    minVersion: "X.Y.Z",
//	    build: func() (func(string, []string) error, error) {
//	        env, err := cel.NewEnv(append(
//	            baseCELOptions(),
//	            // ── include ALL libraries from all prior versions ──
//	            library.Omit(),   // v0.9.0
//	            library.Hash(),   // v0.9.1
//	            // ── add ONLY the new libraries introduced in vX.Y.Z ──
//	            cel.Lib(library.NewThing()),
//	        )...)
//	        if err != nil { return nil, err }
//	        return checkFunc(env), nil
//	    },
//	},
//
// Entries MUST be ordered from newest to oldest. envForVersion walks the list
// and returns the first entry whose minVersion is ≤ the cluster version.
// The last entry (oldest) is the fallback for any version below its minVersion.
//
// No other file needs changing.

import (
	"fmt"
	"sync"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/ext"
	"github.com/kubernetes-sigs/kro/pkg/cel/library"
	k8scellib "k8s.io/apiserver/pkg/cel/library"
)

// celVersionEntry describes one CEL capability bucket.
// build is called at most once (guarded by once).
type celVersionEntry struct {
	// minVersion is the first kro release that introduced these CEL functions.
	// Format: "MAJOR.MINOR.PATCH" without a leading "v".
	minVersion string

	once    sync.Once
	fn      func(expr string, varNames []string) error // set by build on first use
	initErr error

	// build constructs the CEL environment for this bucket.
	// It is only invoked once; the result is cached in fn.
	build func() (func(expr string, varNames []string) error, error)
}

// checkFunc wraps a *cel.Env into the (expr, varNames) → error closure used by
// ValidateCELExpressions. It performs both syntax (Parse) and semantic
// (Check) validation so that calls to unknown functions — e.g. hash.fnv64a()
// on a v0.8.x cluster — are correctly rejected.
//
// varNames are the resource IDs visible in the current expression context
// (e.g. "schema", "vpc", "subnet"). Each is declared as cel.DynType so that
// field-access chains like schema.spec.replicas type-check without requiring
// the full OpenAPI schema.
//
// The *cel.Env type from github.com/google/cel-go is captured inside the
// closure so callers never need to import cel-go directly.
func checkFunc(env *cel.Env) func(expr string, varNames []string) error {
	return func(expr string, varNames []string) error {
		// Build a per-check extension of the base env that declares the
		// resource variables as dynamic-typed. env.Extend() is cheap —
		// it inherits all library registrations from the parent.
		vars := make([]cel.EnvOption, 0, len(varNames)+1)
		// "schema" is always in scope in kro CEL expressions.
		vars = append(vars, cel.Variable("schema", cel.DynType))
		for _, name := range varNames {
			if name != "" && name != "schema" {
				vars = append(vars, cel.Variable(name, cel.DynType))
			}
		}
		checkEnv, err := env.Extend(vars...)
		if err != nil {
			// Fallback: parse-only if the extension fails (should never happen).
			_, iss := env.Parse(expr)
			if iss != nil {
				return iss.Err()
			}
			return nil
		}

		ast, iss := checkEnv.Parse(expr)
		if iss != nil && iss.Err() != nil {
			return iss.Err()
		}
		_, iss = checkEnv.Check(ast)
		if iss != nil && iss.Err() != nil {
			return iss.Err()
		}
		return nil
	}
}

// celVersionRegistry lists every CEL capability bucket, newest-first.
//
// envForVersion walks this slice and returns the fn for the first entry
// whose minVersion is ≤ the cluster's kro version.
// The last entry acts as the catch-all fallback for oldest clusters.
//
// ── How to read the build functions ──────────────────────────────────────
// Each build func constructs a cel.Env containing EXACTLY the libraries
// that were available in kro at that version. It deliberately does NOT
// call krocel.DefaultEnvironment() (which always reflects the latest
// compiled-in version) so that newer functions are absent from older envs.
var celVersionRegistry = []*celVersionEntry{
	// ── kro v0.9.1 ────────────────────────────────────────────────────────
	// Added: library.Hash() — hash.fnv64a(), hash.sha256(), hash.md5()
	// Ref:   https://github.com/kubernetes-sigs/kro/releases/tag/v0.9.1
	{
		minVersion: "0.9.1",
		build: func() (func(expr string, varNames []string) error, error) {
			env, err := cel.NewEnv(append(
				baseCELOptions(),
				// v0.9.0 additions
				library.Omit(),
				library.Maps(),
				library.JSON(),
				library.Lists(),
				ext.Bindings(),
				ext.TwoVarComprehensions(),
				// v0.9.1 additions
				library.Hash(),
			)...)
			if err != nil {
				return nil, fmt.Errorf("build v0.9.1 CEL env: %w", err)
			}
			return checkFunc(env), nil
		},
	},

	// ── kro v0.9.0 ────────────────────────────────────────────────────────
	// Added: library.Omit(), library.Maps(), library.JSON(), library.Lists(),
	//        ext.Bindings(), ext.TwoVarComprehensions()
	// Ref:   https://github.com/kubernetes-sigs/kro/releases/tag/v0.9.0
	{
		minVersion: "0.9.0",
		build: func() (func(expr string, varNames []string) error, error) {
			env, err := cel.NewEnv(append(
				baseCELOptions(),
				// v0.9.0 additions
				library.Omit(),
				library.Maps(),
				library.JSON(),
				library.Lists(),
				ext.Bindings(),
				ext.TwoVarComprehensions(),
			)...)
			if err != nil {
				return nil, fmt.Errorf("build v0.9.0 CEL env: %w", err)
			}
			return checkFunc(env), nil
		},
	},

	// ── kro v0.8.x (baseline / oldest supported) ─────────────────────────
	// Functions available since the minimum supported kro version (v0.8.0).
	// This entry is the catch-all: any version below 0.9.0 lands here,
	// and so does "unknown" after envForVersion's fallback logic.
	{
		minVersion: "0.8.0",
		build: func() (func(expr string, varNames []string) error, error) {
			env, err := cel.NewEnv(baseCELOptions()...)
			if err != nil {
				return nil, fmt.Errorf("build v0.8.x CEL env: %w", err)
			}
			return checkFunc(env), nil
		},
	},
}

// baseCELOptions returns the CEL environment options that have been present
// in kro since v0.8.0. This is the common foundation shared by all buckets.
// Version-specific libraries are layered on top in each celVersionEntry.build.
//
// Derived from krocel.BaseDeclarations() at kro v0.8.x — the subset that
// existed before v0.9.0 added the richer libraries.
func baseCELOptions() []cel.EnvOption {
	return []cel.EnvOption{
		ext.Lists(),
		ext.Strings(),
		cel.OptionalTypes(),
		ext.Encoders(),
		k8scellib.Lists(),
		k8scellib.URLs(),
		k8scellib.Regex(),
		k8scellib.Quantity(),
		k8scellib.IP(),
		k8scellib.CIDR(),
		k8scellib.SemverLib(),
		library.Random(),
	}
}

// envForVersion returns the check function for the given kro version string.
// It selects the newest registry entry whose minVersion is ≤ kroVersion.
// When kroVersion is empty or "unknown", the oldest (most conservative) entry
// is returned so validation never produces false positives.
//
// The selected entry's build func is called at most once (sync.Once).
func envForVersion(kroVersion string) (func(expr string, varNames []string) error, error) {
	// Determine which entry to use.
	selected := celVersionRegistry[len(celVersionRegistry)-1] // oldest = safest default

	if kroVersion != "" && kroVersion != "unknown" {
		for _, entry := range celVersionRegistry {
			if compareVersionStrings(kroVersion, entry.minVersion) >= 0 {
				selected = entry
				break // celVersionRegistry is newest-first; first match wins
			}
		}
	}

	// Initialise the selected entry exactly once.
	selected.once.Do(func() {
		selected.fn, selected.initErr = selected.build()
	})
	if selected.initErr != nil {
		return nil, selected.initErr
	}
	return selected.fn, nil
}

// compareVersionStrings compares two "MAJOR.MINOR.PATCH" strings (no leading v).
// Returns -1, 0, or +1. Unparseable segments are treated as 0.
// This is intentionally a package-private copy so the validate package has no
// import cycle with internal/k8s (which owns CompareKroVersions).
func compareVersionStrings(a, b string) int {
	aMaj, aMin, aPatch := parseVersionTriple(a)
	bMaj, bMin, bPatch := parseVersionTriple(b)
	switch {
	case aMaj != bMaj:
		if aMaj < bMaj {
			return -1
		}
		return 1
	case aMin != bMin:
		if aMin < bMin {
			return -1
		}
		return 1
	case aPatch != bPatch:
		if aPatch < bPatch {
			return -1
		}
		return 1
	default:
		return 0
	}
}

// parseVersionTriple parses "vMAJOR.MINOR.PATCH" or "MAJOR.MINOR.PATCH[-pre]"
// into three integers. Unparseable parts return 0.
func parseVersionTriple(v string) (major, minor, patch int) {
	// Strip leading "v"/"V"
	if len(v) > 0 && (v[0] == 'v' || v[0] == 'V') {
		v = v[1:]
	}
	// Strip pre-release suffix
	if idx := indexByte(v, '-'); idx >= 0 {
		v = v[:idx]
	}
	parts := splitN(v, ".", 3)
	if len(parts) < 3 {
		return 0, 0, 0
	}
	_, _ = fmt.Sscanf(parts[0], "%d", &major)
	_, _ = fmt.Sscanf(parts[1], "%d", &minor)
	_, _ = fmt.Sscanf(parts[2], "%d", &patch)
	return
}

// indexByte returns the index of the first occurrence of b in s, or -1.
func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// splitN splits s by sep up to n parts (mirrors strings.SplitN without the import).
func splitN(s, sep string, n int) []string {
	var parts []string
	for len(parts) < n-1 {
		idx := -1
		for i := 0; i <= len(s)-len(sep); i++ {
			if s[i:i+len(sep)] == sep {
				idx = i
				break
			}
		}
		if idx < 0 {
			break
		}
		parts = append(parts, s[:idx])
		s = s[idx+len(sep):]
	}
	return append(parts, s)
}
