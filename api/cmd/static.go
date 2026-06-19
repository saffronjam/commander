package cmd

import (
	"io"
	"io/fs"
	"net/http"
	"path/filepath"
	"strings"

	"api/web"
)

// registerStatic mounts the seeded assets directory and the embedded SPA (with
// index.html fallback) onto mux. It must be registered last so the exact paths
// already on the mux (/graphql, /healthz) win over the SPA "/" catch-all via
// ServeMux longest-prefix matching.
func registerStatic(mux *http.ServeMux, assetsDir string) {
	// The seeder (and the dev bind-mount) lay tiles/icons out under
	// <assetsDir>/images/satisfactory/...; the URL prefix is the full
	// /assets/images/satisfactory/ (kept distinct from the SPA's own /assets/
	// bundle dir), so the FileServer root must be that same nested directory.
	assetFS := http.FileServer(http.Dir(filepath.Join(assetsDir, "images", "satisfactory")))
	mux.Handle(
		"/assets/images/satisfactory/",
		http.StripPrefix("/assets/images/satisfactory/", assetFS),
	)

	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		return
	}
	fileServer := http.FileServer(http.FS(dist))
	mux.Handle("/", spaFallback(dist, fileServer))
}

// spaFallback serves embedded static files, falling back to index.html for any
// path that does not resolve to a real file (the try_files $uri /index.html
// equivalent for client-side routing).
func spaFallback(dist fs.FS, fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(dist, p); err != nil {
			index, err := dist.Open("index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			defer index.Close()
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = io.Copy(w, index)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
