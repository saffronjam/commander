// Package version exposes the application version.
package version

// Version is the application version. Defaults to "localbuild" and is
// overridden at build time via:
//
//	-ldflags "-X api/internal/version.Version=<value>"
var Version = "localbuild"
