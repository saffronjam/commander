// Package web embeds the built single-page-application bundle so the Go binary
// is self-contained. The dist tree is produced by the frontend build (Vite
// build.outDir -> ../api/web/dist) and is gitignored; a committed .gitkeep
// keeps backend-only builds compiling before any frontend build has run.
package web

import "embed"

//go:embed all:dist
var Dist embed.FS
