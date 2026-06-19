# 01 — Deployment Consolidation: One Go Container + ORAS Assets

## Context

The project ships as **three container images plus Redis**:

| Image | Dockerfile | Base | Serves | Port |
|-------|-----------|------|--------|------|
| API (Go) | `api/Dockerfile` | `golang:alpine` → `alpine:3` | REST `/v1/*`, SSE, Swagger, metrics | 8081 |
| Dashboard (SPA) | `dashboard/Dockerfile` | `oven/bun:1.3-slim` → `nginx:alpine` | built Vite `dist/` static files | 3000 |
| Asset server | `asset-server/Dockerfile` | `nginx:alpine` | map tiles + item icons under `/assets/images/satisfactory/` | 80 |
| Redis | `compose.yml` | `redis:7-alpine` | session store + pub/sub + state cache | 6379 |

`compose.yml` only declares `api` + `redis`; the SPA and asset-server images are built and
pushed independently by `.github/workflows/build-push.yaml`. The split-origin topology
(SPA on nginx:3000, API on Go:8081) is the *only* reason the API runs `corsAllowAll()` with
`AllowCredentials=true` and a mirror-any-origin function, and the only reason the SPA needs
the `runtime-config.js` / `window.__RUNTIME_CONFIG__.apiUrl` indirection
(`dashboard/docker-entrypoint.sh` → `dashboard/src/config.ts`).

The map tiles are large: the LFS-tracked tarballs are **`map-realistic.tar.gz` = 1.4 GB,
`map-game.tar.gz` = 1.1 GB, `scraped-images.tar.gz` = 81 MB** (≈2.6 GB compressed, more
uncompressed). All tile/icon references in the SPA are **relative**
(`assets/images/satisfactory/...`, no leading slash — see
`dashboard/src/sections/map/view/map-view.tsx`), so they resolve against whatever origin
serves the SPA.

This plan collapses serving into **one `CGO_ENABLED=0` Go binary** that embeds the built SPA
(`go:embed`, SPA-fallback routing on a **stdlib `net/http` mux**), serves the map/icon assets
from a volume, and exposes a single same-origin GraphQL endpoint (`/graphql` HTTP + graphql-ws).
The tiles are delivered out-of-band as a **versioned OCI artifact pulled with ORAS** by a
one-shot seeder, so they never bloat the app image and never require the operator to handle
LFS or local tarballs. Redis, nginx, the runtime-config indirection, CORS, **and Gin** all
disappear.

This plan owns **deployment/packaging only**. It depends on the GraphQL server existing
(plan 06) and SQLite replacing Redis (plans 03/04), but it does not design those — it assumes
the binary builds an `*http.Server` around a stdlib `http.ServeMux` (plan 02), exposes
`/graphql` (plan 06), and opens a SQLite file at a configured path (plan 04).

## Settled design decisions

1. **One app image, one process, one port.** The Go binary serves SPA + assets + GraphQL on a
   single configurable port (keep `8081`). No nginx, no asset-server process, no Redis container.

2. **stdlib `net/http`, NOT Gin (decision E-1).** Gin is removed entirely from the project.
   The serving stack is a stdlib `http.ServeMux` wrapped in an `*http.Server` (the mux itself
   is assembled in plan 02/06). Static + SPA serving (`RegisterStatic`, below) is a plain
   `http.Handler` registered on that mux — no `gin.Engine`, no `r.StaticFS`, no `r.NoRoute`,
   no `gin.Dir`. There is no `GIN_MODE` anywhere (dropped from the Dockerfile).

3. **SPA is embedded via `go:embed`.** The Vite `dist/` (a few MB of JS/CSS/HTML) is compiled
   into the binary. A stdlib SPA-fallback handler serves embedded `index.html` for any
   non-`/graphql`, non-asset, non-existent-file path (the `try_files $uri /index.html`
   equivalent). This makes the binary fully self-contained for the application code.

4. **Map/icon assets are delivered as an OCI artifact via ORAS, served from a volume
   (decision E-12).** The ~2.6 GB of tiles/icons live in the container registry as a versioned
   OCI artifact — `ghcr.io/<owner>/satisfactory-dashboard-assets:<tiles-version>`, pushed with
   `oras`. A **one-shot seeder** container (`deploy/Dockerfile.seed`: `alpine` + the `oras`
   CLI + an extract script) runs before the app, `oras pull`s the artifact, extracts the
   tarballs into a shared `assets` volume, and writes a version marker so it is a no-op on
   subsequent starts. The Go binary then serves that volume read-only at
   `/assets/images/satisfactory/` via a stdlib `http.FileServer` over `http.Dir(assetsDir)`
   (`SD_ASSETS_DIR`, default `/assets`).

   This keeps the app image at tens of MB, lets the operator deploy **by pulling images only**
   (no git-lfs, no local tarballs, no host directory to hand-populate), and decouples lifecycles:
   the app image is rebuilt on every code change; the asset artifact is pushed **rarely** —
   only when tiles change. The SPA's relative URL contract is unchanged: it keeps requesting
   `assets/images/satisfactory/...` and the Go server answers at exactly that prefix on the same
   origin, so **no SPA source changes are needed** for asset URLs.

5. **Same-origin ⇒ no CORS, no base-URL juggling (decision E-4).** Because the SPA, assets, and
   GraphQL are one origin, the urql HTTP client and graphql-ws client target relative URLs
   (`/graphql`, `/graphql` upgraded to ws). **All CORS machinery is removed:** `corsAllowAll()`
   and the `gin-contrib/cors` middleware go away with Gin (decision E-1). There is no
   `AllowedOrigins` config field (it never existed) — the *only* origin check that remains is the
   websocket `Upgrader.CheckOrigin`, and that lives in plan 06's GraphQL transport wiring, sourced
   from `config.ExternalURL` (same-origin). This plan deletes the CORS code and the
   `runtime-config.js` / `__RUNTIME_CONFIG__` / `docker-entrypoint.sh` indirection plus
   `dashboard/src/config.ts`. Auth cookies become same-origin (simpler + more secure;
   WS auth reads the cookie off the upgrade request per decision E-3). The exact GraphQL client
   config is owned by plan 07; this plan only guarantees the single origin and deletes the old
   indirection.

6. **Migrations run inside the binary at startup.** Before opening the serve-path `*sql.DB`, the
   binary runs the embedded golang-migrate iofs chain to `Up()` (idempotent;
   `migrate.ErrNoChange` is success). This keeps "single self-contained binary" true — no
   separate `migrate up` entrypoint step. (Plan 04 owns the migration code; this plan only states
   *where* it is invoked in the deploy path and that the DB file lives on a mounted volume.)

7. **`CGO_ENABLED=0` holds.** `modernc.org/sqlite` is pure Go (plan 04), so the static-binary
   build is preserved and the final image can be `alpine:3` (or `scratch` + ca-certs).

8. **Build version is kept; asset-inclusion arg is dropped.** `VITE_BUILD_VERSION` still feeds
   `vite.config.ts`'s `__BUILD_VERSION__`. `INCLUDE_ASSETS` is deleted (assets are never baked
   into the SPA build; they arrive via the seeder).

9. **Auth re-bootstraps on first SQLite boot — clean wipe (decision D-A).** The image carries
   `SD_BOOTSTRAP_PASSWORD` (default `"change-me"`); on first boot against an empty SQLite DB the
   auth subsystem re-bootstraps the password (`is_default=1`). There is NO Redis→SQLite migration
   of password/tokens, so this is a deliberate, user-approved clean cutover — see the prominent
   upgrade note below. Deployment-wise this means: drop Redis from compose/config, keep
   `SD_BOOTSTRAP_PASSWORD` in the env, and document that the operator must re-set their password
   after upgrade.

## Target topology (before → after)

- **Before:** 4 containers — SPA nginx:3000, asset nginx:80, API Go:8081, Redis:6379. Cross-origin
  CORS, runtime-config indirection, manual asset-server builds, Gin router.
- **After:** **1 long-running container** — Go:8081 (stdlib `net/http`) serving SPA + assets +
  GraphQL, reading SQLite from a `/data` volume and tiles from an `/assets` volume — preceded by
  a **one-shot seeder** (its only job: `oras pull` the tiles artifact into the `/assets` volume,
  then exit). No Redis, no nginx, no Gin, one origin. Two published images (the tiny app, the tiny
  seeder) plus one rarely-pushed asset artifact; operators pull, never build or fetch LFS.

```
   registry (ghcr.io)
     satisfactory-dashboard:<ver>          (app — tens of MB, code only)
     satisfactory-dashboard-seed:<ver>     (seeder — alpine + oras + script)
     satisfactory-dashboard-assets:<tiles> (OCI artifact — 3 tarball blobs, ~2.6 GB, pushed rarely)
            │ oras pull                                   │ docker pull
            ▼                                             ▼
   ┌─────────────────────┐  writes   ┌──────────┐  reads  ┌───────────────────────────┐
   │ seed (one-shot)     │──────────►│ /assets  │◄────────│ app  (Go, :8081)          │
   │ oras pull + extract │           │ (volume) │   RO    │  SPA(go:embed)+FileServer  │
   │ + version marker    │           └──────────┘         │  + /graphql               │
   └─────────────────────┘                                │  /data volume → SQLite     │
       runs to completion, then app starts                └───────────────────────────┘
       (depends_on: service_completed_successfully)
```

---

## Files to ADD

### `Dockerfile` (repo root — single multi-stage app build replacing the SPA + API images)

```dockerfile
FROM oven/bun:1.3-slim AS web
WORKDIR /web
COPY dashboard/package.json dashboard/bun.lock* ./
RUN bun install --frozen-lockfile
COPY dashboard/ .
ARG VITE_BUILD_VERSION=localbuild
ENV VITE_BUILD_VERSION=${VITE_BUILD_VERSION}
RUN bun run build

FROM --platform=$BUILDPLATFORM golang:alpine AS build
RUN apk add --no-cache git
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ .
COPY --from=web /web/dist ./web/dist
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -o /out/satisfactory-dashboard .

FROM alpine:3
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/satisfactory-dashboard .
COPY api/config.docker.yml config.local.yml
ENV SD_ASSETS_DIR=/assets
VOLUME ["/data", "/assets"]
EXPOSE 8081
ENTRYPOINT ["./satisfactory-dashboard"]
```

Notes:
- The web stage builds the SPA; its `dist/` is copied into the Go build context at `api/web/dist`
  so the new `api/web/embed.go` (below) can `//go:embed dist/*`.
- The app image carries **no tiles** — `/assets` is an empty mount point the seeder populates.
- **`GIN_MODE` is gone** (decision E-1 — Gin is removed; nothing reads it).
- `/data` holds the SQLite file (`SD_DB_PATH=/data/satisfactory-dashboard.db`, owned by plan 04);
  `/assets` is the shared volume the seeder fills (`SD_ASSETS_DIR=/assets`).
- `SD_BOOTSTRAP_PASSWORD` is not baked into the image; it is supplied at runtime via compose/env
  (default `"change-me"`, decision D-A). No Redis env of any kind remains.
- `docs/` is no longer copied (Swagger is REST-era; GraphQL ships its own playground per plan 06).

### `deploy/Dockerfile.seed` (new — the one-shot ORAS asset seeder image)

```dockerfile
FROM alpine:3
ARG ORAS_VERSION=1.2.0
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates tar curl \
 && curl -fsSL "https://github.com/oras-project/oras/releases/download/v${ORAS_VERSION}/oras_${ORAS_VERSION}_linux_${TARGETARCH}.tar.gz" \
    | tar -xzf - -C /usr/local/bin oras
COPY deploy/seed-assets.sh /seed.sh
RUN chmod +x /seed.sh
ENTRYPOINT ["/seed.sh"]
```

A tiny (~10 MB) purpose-built image: the pinned `oras` CLI + BusyBox `tar` + the seed script. It
is published like the app image, so operators pull it; in Kubernetes the same image is the
Pod's `initContainer`.

### `deploy/seed-assets.sh` (new — pull the artifact into the volume, idempotently)

```sh
#!/bin/sh
set -eu
: "${SD_ASSETS_REF:?SD_ASSETS_REF must be set (e.g. ghcr.io/<owner>/satisfactory-dashboard-assets:tiles-YYYYMMDD)}"

dest="/assets/images/satisfactory"
marker="/assets/.assets-ref"

if [ -f "$marker" ] && [ "$(cat "$marker")" = "$SD_ASSETS_REF" ]; then
	echo "assets already present for $SD_ASSETS_REF — skipping"
	exit 0
fi

tmp="$(mktemp -d)"
oras pull "$SD_ASSETS_REF" -o "$tmp"

mkdir -p "$dest/map/1763022054"
tar -xzf "$tmp/map-realistic.tar.gz" -C "$dest/map/1763022054"
tar -xzf "$tmp/map-game.tar.gz" -C "$dest/map/1763022054"
tar -xzf "$tmp/scraped-images.tar.gz" --strip-components=1 -C "$dest"

rm -rf "$tmp"
printf '%s' "$SD_ASSETS_REF" > "$marker"
echo "seeded assets from $SD_ASSETS_REF"
```

The marker (the resolved ref/tag) makes the seeder a no-op once the volume is populated, so a
restart does not re-pull 2.6 GB. Pulling a *new* `SD_ASSETS_REF` re-extracts and updates the
marker. The extraction layout matches the tiles' on-disk cache-dir hash (`1763022054`) the SPA
requests; `scraped-images.tar.gz` strips its top component into `images/satisfactory/`.

### `api/web/embed.go` (new — embeds the built SPA)

```go
package web

import "embed"

//go:embed dist/*
var Dist embed.FS
```

`api/web/dist` is a build artifact: gitignored, created by the web stage in Docker and by
`make build` locally. A `.gitignore` entry `api/web/dist/` is added. A committed placeholder
`api/web/dist/.gitkeep` keeps `go build` working for pure-backend dev before a frontend build.

### `api/routers/spa.go` (new — SPA fallback + asset serving, stdlib `http.Handler`)

`RegisterStatic` is a **stdlib `http.Handler`** registration (decision E-1) — no Gin. It takes the
mux that plan 02/06 builds and the assets directory, and wires two handlers:

```go
package routers

import (
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/.../api/web"
)

// RegisterStatic mounts the embedded SPA (with index.html fallback) and the
// mounted assets directory onto mux. It MUST be registered last so /graphql,
// /healthz, and /internal/metrics (already registered on mux) win over the
// SPA "/" catch-all.
func RegisterStatic(mux *http.ServeMux, assetsDir string) {
	assetFS := http.FileServer(http.Dir(assetsDir))
	mux.Handle(
		"/assets/images/satisfactory/",
		http.StripPrefix("/assets/images/satisfactory/", assetFS),
	)

	dist, _ := fs.Sub(web.Dist, "dist")
	fileServer := http.FileServer(http.FS(dist))
	mux.Handle("/", spaFallback(dist, fileServer))
}

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
			io.Copy(w, index)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
```

`mux.Handle("/assets/images/satisfactory/", …)` serves the seeded volume; the `spaFallback`
handler on `"/"` is the dashboard nginx's `try_files $uri /index.html`. The real routes —
`/graphql` (plan 06), `/healthz`, `/internal/metrics` — are registered on the same mux **before**
`RegisterStatic`, and stdlib `ServeMux` longest-prefix matching means those exact paths beat the
`"/"` catch-all. The `assetsDir` comes from config `SD_ASSETS_DIR`. (This matches the saffron-hive
`mux.Handle("/", spaFallbackHandler(staticFS))` reference, `research/ref-graphql.md` §6.)

### `compose.yml` (replaced — see DELETE/CHANGE)

Single long-running service, preceded by the one-shot seeder:

```yaml
services:
  seed-assets:
    image: ghcr.io/saffronjam/satisfactory-dashboard-seed:latest
    environment:
      - SD_ASSETS_REF=${SD_ASSETS_REF:-ghcr.io/saffronjam/satisfactory-dashboard-assets:latest}
    volumes:
      - assets:/assets
    restart: "no"

  app:
    image: ghcr.io/saffronjam/satisfactory-dashboard:latest
    container_name: satisfactory-dashboard
    depends_on:
      seed-assets:
        condition: service_completed_successfully
    ports:
      - "8081:8081"
    environment:
      - SD_BOOTSTRAP_PASSWORD=${SD_BOOTSTRAP_PASSWORD:-change-me}
      - SD_MAX_SAMPLE_GAME_DURATION=${SD_MAX_SAMPLE_GAME_DURATION}
      - SD_DB_PATH=/data/satisfactory-dashboard.db
      - SD_ASSETS_DIR=/assets
    volumes:
      - app-data:/data
      - assets:/assets:ro
    restart: unless-stopped

volumes:
  app-data:
  assets:
```

`app-data` is the SQLite volume; `assets` is the tiles volume the seeder fills and the app mounts
read-only. `depends_on … condition: service_completed_successfully` guarantees the app never
starts before the tiles are in place. No `redis` service. On first boot the empty SQLite DB
triggers the auth clean-wipe re-bootstrap to `SD_BOOTSTRAP_PASSWORD` (decision D-A).

A contributor running the stack from a checkout can skip the seeder and bind-mount their locally
unpacked tiles instead via a `compose.override.yml`:

```yaml
services:
  seed-assets:
    profiles: ["never"]
  app:
    depends_on: []
    volumes:
      - ./dashboard/public/assets:/assets:ro
```

(`make unpack-assets` populates `dashboard/public/assets`.)

### Kubernetes (documented, no manifest committed here)

The seeder is the Pod's `initContainer` (same `…-seed` image, same `SD_ASSETS_REF`), writing into
a volume the app container mounts at `/assets`. Use a **PVC** (not `emptyDir`) so the marker
persists and pods don't re-pull 2.6 GB on every restart; the app container mounts it read-only.

## Files to CHANGE

### `.github/workflows/build-push.yaml`

Replace `build-frontend` + `build-api` + `build-asset-server` with:

- **`build` (always):** one `docker/build-push-action`, `context: .`, `file: ./Dockerfile`,
  build-arg `VITE_BUILD_VERSION=${{ steps.version.outputs.version }}`, tags
  `ghcr.io/${{ owner }}/satisfactory-dashboard` (branch/pr/semver/sha/latest). **No LFS** — the
  app image never contains tiles.
- **`build-seed` (always, cheap):** one `docker/build-push-action`, `file: ./deploy/Dockerfile.seed`,
  tags `ghcr.io/${{ owner }}/satisfactory-dashboard-seed`. Tiny; changes rarely but builds fast.
- **`publish-assets` (manual, rare):** gated on `workflow_dispatch` with inputs
  `publish_assets: true` and `assets_tag`. Checks out with LFS (`git lfs pull`), `oras login`s to
  ghcr, then:
  ```
  oras push ghcr.io/${{ owner }}/satisfactory-dashboard-assets:${{ inputs.assets_tag }} \
    --artifact-type application/vnd.satisfactory-dashboard.assets \
    assets/map-realistic.tar.gz:application/gzip \
    assets/map-game.tar.gz:application/gzip \
    assets/scraped-images.tar.gz:application/gzip
  ```
  This is the **only** job that touches LFS, and it runs only when tiles change.

### `Makefile`

- **`run` / `backend` / `backend-live` (dev):** unchanged in spirit. The dev backend serves tiles
  from `dashboard/public/assets`, so set `SD_ASSETS_DIR=../dashboard/public/assets` (populated by
  `make unpack-assets`) and `SD_DB_PATH=./dev.db`. Drop `SD_NODE_NAME` (plan 02). Dev never uses
  ORAS — local tarballs are simplest.
- **Delete** the multi-instance targets `backend-2`, `backend-api`, `backend-poller`,
  `backend-api-2`, `backend-poller-2` and their `.PHONY` entries (plan 02 — no distributed polling).
- **`build`:** `frontend-build` must output into the embed path — set Vite `build.outDir` to
  `../api/web/dist` (or copy `dashboard/dist` → `api/web/dist` after `bun run build`); `backend-build`
  then `go build` picks up the embed. Order `build: frontend-build backend-build`.
- **`deps` / `deps-down`:** delete (they start/stop Redis — plan 03).
- **`asset-server` / `asset-server-push`:** delete, plus the `ASSET_SERVER_IMAGE` var and the
  "Asset Server" help section.
- **Add `assets-publish`** (maintainer-only): `git lfs pull` + `oras push` the three tarballs to
  `…/satisfactory-dashboard-assets:$(ASSETS_TAG)` — the local twin of the CI `publish-assets` job,
  for pushing a new tiles version by hand. Requires `oras` + registry login.
- Update the `help` text: remove the multi-instance, `deps`, and asset-server sections; add
  `assets-publish`.
- `generate`: the single canonical `make generate` recipe (gqlgen → sqlc → client-preset) is
  **owned by plan 08, decision E-8** — not redefined here. The SPA embed step is driven by
  `make build` (`frontend-build`), not by `generate`. (The old tygo `generate` target is retired
  by plan 08.)

### `api/config.docker.yml` and `api/config.local.yml`

- Remove the `redis:` block (plan 03).
- Rely on `SD_ASSETS_DIR` / `SD_DB_PATH` env (env-only, matching plan 04). The `externalUrl` key
  is the single same-origin URL and the source for the WS `Upgrader.CheckOrigin` (plan 06,
  decision E-4), so it must be set correctly per deployment.

### `api/pkg/config` (config struct + env binding)

- Add `AssetsDir` (env `SD_ASSETS_DIR`, default `/assets`) consumed by `RegisterStatic`.
- Drop the `Redis` struct (plan 03) and `NodeName`/`SD_NODE_NAME` (plan 02). `SD_API_PORT`
  remains the single listen port; `SD_MAX_SAMPLE_GAME_DURATION` remains; `SD_BOOTSTRAP_PASSWORD`
  remains. `ExternalURL` remains (WS `CheckOrigin`, plan 06). There is **no `AllowedOrigins`
  field** — CORS is gone (decision E-4).
- **`SD_ASSETS_REF` is NOT app config** — it is consumed only by the seeder script
  (`deploy/seed-assets.sh`). The Go binary never reads it; it only reads `SD_ASSETS_DIR`.

### `api/routers/router.go` (or wherever the mux is assembled)

- **Remove all CORS machinery** — `corsAllowAll()` and `gin-contrib/cors` are deleted with Gin
  (decisions E-1, E-4). No `AllowedOrigins`, no `AllowCredentials`, no mirror-any-origin function.
- This file no longer builds a `gin.Engine`. The serving stack is the stdlib `http.ServeMux`
  assembled in plan 02 (`app.go` builds the `*http.Server` around it). After the GraphQL handler,
  `/healthz`, and `/internal/metrics` are registered, call
  `RegisterStatic(mux, config.Config.AssetsDir)` **last** so the SPA `"/"` catch-all is lowest
  priority. (If this file is subsumed by plan 02's `app.go`/plan 06's transport wiring, the CORS
  deletion still applies wherever that code lived.)

### `dashboard/index.html`

- Remove the `<script src="/runtime-config.js">` tag (the runtime-config indirection is gone).

## Files to DELETE

- `dashboard/Dockerfile` — superseded by the root `Dockerfile`'s `web` stage.
- `dashboard/nginx.conf` — SPA fallback now in `api/routers/spa.go` (stdlib handler).
- `dashboard/docker-entrypoint.sh` — runtime-config indirection gone.
- `dashboard/src/config.ts` — same-origin; no base-URL resolution.
- `asset-server/` (entire dir: `Dockerfile` + `nginx.conf`) — the seeder + Go `FileServer`
  replace the running nginx asset server; the tiles now ship as the ORAS artifact.
- The `redis` service in `compose.yml`, `redis:` config blocks, and `make deps`/`deps-down`
  (plan 03 also tracks these).
- All Gin/CORS code: `corsAllowAll()`, the `gin-contrib/cors` import, and any `gin.Engine` /
  `r.StaticFS` / `r.NoRoute` / `gin.Dir` usage in the routing layer (decision E-1). The `gin` and
  `gin-contrib/cors` module dependencies are dropped from `api/go.mod` (full Gin removal shared
  with plan 02).

---

## Asset delivery (ORAS) — end to end

The LFS tarballs stay exactly as they are in the repo: `assets/*.tar.gz` tracked by
`.gitattributes` (`filter=lfs`), repacked by `make pack-assets`. They are the *source*; the
registry artifact is the *distribution channel*.

- **Publish (maintainer, rare).** When tiles change, `make assets-publish ASSETS_TAG=tiles-YYYYMMDD`
  (or the CI `publish-assets` job) does `git lfs pull` + `oras push` of the three tarballs as a
  single tagged OCI artifact (three `application/gzip` blobs). The `assets` package is **public**
  on ghcr, so the seeder pulls it anonymously — no registry credentials in the deployment.
- **Seed (per deploy, one-shot).** The `seed-assets` container/initContainer runs
  `deploy/seed-assets.sh`: `oras pull` the artifact named by `SD_ASSETS_REF`, extract the tarballs
  into the `/assets` volume in the `1763022054` cache-dir layout, write the version marker, exit.
  Idempotent via the marker; pinned by `SD_ASSETS_REF`.
- **Serve (app).** The Go binary serves the `/assets` volume read-only at
  `/assets/images/satisfactory/` via stdlib `http.FileServer`. The SPA's relative tile URLs are
  unchanged.

**Version pinning.** `SD_ASSETS_REF` selects the tiles version. Each app release names the
matching `tiles-*` tag in its notes; the compose default is `:latest` for convenience, and
operators should pin to the release's tag (or a digest) in production. Bumping the tiles version
is just changing `SD_ASSETS_REF` and re-running the seeder — the marker triggers a re-extract.

- **Local dev / contributor:** `make unpack-assets` extracts into
  `dashboard/public/assets/images/satisfactory/...`; the dev backend reads it via `SD_ASSETS_DIR`,
  and the compose override bind-mounts it (no seeder, no ORAS).

---

## RELEASE / UPGRADE NOTE — auth clean wipe (decision D-A)

This refactor replaces Redis with SQLite as the auth store. **There is NO migration of the
existing password or access tokens.** On first boot against an empty SQLite DB:

- auth re-bootstraps to `SD_BOOTSTRAP_PASSWORD` (default `"change-me"`) with `is_default = 1`;
- all previously issued access tokens are gone (every client must log in again);
- **the operator MUST re-set their password after upgrade.**

This is an EXPLICIT, user-approved clean cutover (closes critic B4 / decision D.1), not an
accidental loss of backward compatibility. Surface it prominently in the deployment/upgrade docs
alongside the "no Redis, single image" change (plan 08 owns the canonical wording; plans 02/06
also reference it). Deployment-side, the only knob is `SD_BOOTSTRAP_PASSWORD` in the compose/env.

---

## Migration sequence (ordered, executable)

1. **Add the embed scaffold.** Create `api/web/embed.go`, `api/web/dist/.gitkeep`, and the
   `.gitignore` entry `api/web/dist/`. Verify `go build .` in `api/` still compiles with an empty
   `dist`.
2. **Point the frontend build at the embed path.** Set Vite `build.outDir` to `../api/web/dist`
   (or add the copy step in `make frontend-build`). Run `make frontend-build` and confirm
   `api/web/dist/index.html` exists.
3. **Add `RegisterStatic`** (`api/routers/spa.go`, the stdlib `http.Handler` above) and call it
   from the mux assembly **after** the GraphQL handler, `/healthz`, and `/internal/metrics` are
   registered. Add `AssetsDir` to config + `SD_ASSETS_DIR` env binding. (Requires plan 06's
   GraphQL handler; if sequencing this plan first, temporarily register only the static handler
   and a stub `/graphql` 404 on a bare `http.ServeMux`.)
4. **Remove CORS + Gin + runtime-config.** Delete `corsAllowAll()` and the `gin-contrib/cors`
   import; drop any remaining `gin.Engine`/`r.StaticFS`/`r.NoRoute`/`gin.Dir` usage (coordinated
   with plan 02's Gin removal). Delete `dashboard/src/config.ts`, the `runtime-config.js` script
   tag in `dashboard/index.html`, and `dashboard/docker-entrypoint.sh`. (The SPA's data layer must
   already be on relative same-origin URLs — coordinate with plan 07.)
5. **Write the app `Dockerfile`** (web + go + alpine stages, no `GIN_MODE`). Build locally:
   `docker build --build-arg VITE_BUILD_VERSION=test -t sd:test .` and confirm a small image
   (tens of MB, not GB).
6. **Add the seeder.** Write `deploy/seed-assets.sh` + `deploy/Dockerfile.seed`; build it
   (`docker build -f deploy/Dockerfile.seed -t sd-seed:test .`).
7. **Publish a tiles artifact.** `make assets-publish ASSETS_TAG=tiles-<date>` (or the CI job):
   `git lfs pull` then `oras push` the three tarballs. Confirm `oras manifest fetch` shows the
   three blobs.
8. **Replace `compose.yml`** with the `seed-assets` one-shot + `app` service + `app-data`/`assets`
   volumes. `docker compose up`; confirm the seeder runs to completion, then the SPA, map tiles,
   icons, and `/graphql` are all reachable on `:8081`, and that first boot re-bootstraps auth to
   `SD_BOOTSTRAP_PASSWORD`. Restart and confirm the seeder is a no-op (marker hit).
9. **Update CI** (`build-push.yaml`): one `build` job (no LFS), one `build-seed` job, one manual
   `publish-assets` ORAS job; drop the asset-server job, `INCLUDE_ASSETS`, and the SPA/API split.
10. **Update the `Makefile`**: rewrite `build`/`frontend-build`/`backend`/`run`, delete
    multi-instance + `deps` + asset-server targets, add `assets-publish`, fix `help`. (Leave the
    `generate` recipe to plan 08.)
11. **Delete** `dashboard/Dockerfile`, `dashboard/nginx.conf`, `dashboard/docker-entrypoint.sh`,
    `asset-server/`.
12. **Docs sweep:** update root `CLAUDE.md` Quick Start / Docker Deployment, `api/CLAUDE.md`,
    `dashboard/CLAUDE.md` to describe the single app image, the ORAS seeder + `/assets` volume, the
    `SD_ASSETS_REF` pin, and the auth clean-wipe upgrade note. (Coordinate the Redis/REST/Gin/
    mock-mode removals with plans 02/03/06/08 so docs are edited once.)

---

## Risks

- **Seeder fails ⇒ no tiles.** If `oras pull` fails (registry unreachable, wrong `SD_ASSETS_REF`,
  private package without creds) the volume stays empty and tiles 404. Mitigation: the app's
  `depends_on: { seed-assets: { condition: service_completed_successfully } }` means a failed seed
  blocks app start (visible failure, not silent 404s); the seeder verifies the pulled artifact;
  the binary additionally logs a warning at startup if `SD_ASSETS_DIR` is empty. Keep the `assets`
  package public so anonymous pull works.
- **Re-pull on every restart.** Without a persistent volume + marker, the seeder would re-download
  2.6 GB each start. Mitigation: the `assets` named volume (compose) / PVC (k8s) persists and the
  `.assets-ref` marker short-circuits an already-seeded volume; `emptyDir` in k8s is explicitly
  rejected for this reason.
- **Tiles/app version skew.** A `SD_ASSETS_REF` that predates a tile-layout change could mismatch
  the SPA's expected paths. Mitigation: app releases name the matching `tiles-*` tag; pin
  `SD_ASSETS_REF` (tag or digest) rather than relying on `:latest` in production.
- **`go:embed` needs a non-empty `dist/`.** A `go build` without a prior frontend build fails the
  embed directive unless the `.gitkeep` placeholder exists. The Dockerfile always builds the web
  stage first; only local pure-backend builds need the placeholder.
- **stdlib `ServeMux` route precedence.** The SPA `"/"` catch-all must be registered LAST and the
  real handlers (`/graphql`, `/healthz`, `/internal/metrics`) must be exact-path registrations;
  a stray trailing-slash mismatch would let the SPA swallow them. Mitigation: the smoke test in
  step 8 hits `/graphql` and `/healthz` explicitly. (Low risk — documented saffron-hive pattern.)
- **Sequencing coupling.** This plan's CORS/Gin/runtime-config deletions assume plan 02 moved
  serving to the stdlib `*http.Server`/mux and plan 07 moved the SPA to relative same-origin
  GraphQL URLs; the Dockerfile assumes plan 06's `/graphql` handler and plan 04's SQLite/migrations
  exist. Out-of-order execution needs the step 3 stubs. Milestone order: 04 → 02 → 06/07 → 01.
- **Auth clean wipe surprises operators.** Upgraders lose their password/tokens (decision D-A).
  Mitigation: the prominent upgrade note above + the startup log line indicating the default
  password is in effect (`is_default=1`).
- **Multi-arch seeder.** `deploy/Dockerfile.seed` curls the `oras` binary by `TARGETARCH`; ensure
  the build sets it (buildx provides it) so arm64 hosts get the arm64 `oras`.

---

## How this satisfies the done-criteria

- **No nginx, no separate SPA/asset images, no Gin:** the SPA is `go:embed`-ed and served by the Go
  binary's stdlib `http.Handler`; tiles are served by the same binary's stdlib `http.FileServer`
  from a volume the ORAS seeder fills; both nginx Dockerfiles and the asset-server image/CI job are
  deleted; Gin and `gin-contrib/cors` are removed entirely (decision E-1). One long-running image,
  one stdlib `*http.Server`.
- **No Redis container:** the `redis` service, `depends_on`, config blocks, and `make deps`
  targets are removed (storage moves to SQLite per plans 03/04, mounted at `/data`); auth
  re-bootstraps from `SD_BOOTSTRAP_PASSWORD` on first boot (decision D-A).
- **GraphQL is same-origin (no CORS/base-URL juggling):** SPA + assets + `/graphql` share one
  origin/port, so all CORS machinery, `runtime-config.js`, and `dashboard/src/config.ts` are
  deleted; the client uses relative URLs; the only origin check left is the WS
  `Upgrader.CheckOrigin` sourced from `config.ExternalURL` in plan 06 (decision E-4).
- **`CGO_ENABLED=0` static build preserved:** the Dockerfile keeps `CGO_ENABLED=0` (valid because
  `modernc.org/sqlite` is pure Go), so the app image stays small and static.
- **Asset size handled by ORAS (decision E-12):** the 2.6 GB tiles ship as a versioned OCI artifact
  pulled once by a one-shot seeder into a volume, so the app image stays tens of MB, operators pull
  from the registry only (no LFS, no local tarballs, no hand-populated host dir), and the SPA's
  relative asset URLs are unchanged.
