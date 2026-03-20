// Package version holds build-time version information.
package version

import "fmt"

// These are set at build time via -ldflags.
var (
	Version   = "dev"
	Commit    = "none"
	BuildDate = "unknown"
)

// String returns a human-readable version string.
func String() string {
	return fmt.Sprintf("kro-ui %s (commit: %s, built: %s)", Version, Commit, BuildDate)
}
