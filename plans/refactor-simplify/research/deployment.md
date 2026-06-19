# Deployment Topology Research

Scope: document the current 3-image container topology and exactly what must change
to ship ONE Go container that serves the built SPA (`go:embed`) + assets and exposes
only GraphQL. Read-only investigation; no code changed.

## 1. Current 3-image topology

The project ships as three independent container images, each built from its own
Dockerfile.

| Image | Dockerfile | Base | Serves | Port |
|-------|-----------|------|--------|------|
| API (Go) | `api/Dockerfile` | `golang:alpine` -> `alpine:3` | REST `/v1/*`, SSE, Swagger `/v2/docs`, `/internal/metrics` | 8081 |
| Dashboard (frontend) | `dashboard/Dockerfile` | `oven/bun:1.3-slim` -> `nginx:alpine` | Built Vite SPA static files | 3000 (nginx `listen 3000`) |
| Asset server | `asset-server/Dockerfile` | `nginx:alpine` | Map tiles + scraped item icons under `/assets/images/satisfactory/` | 80 |
| Redis (3rd-party) | `compose.yml` | `redis:7-alpine` | session store + pub/sub + state cache | 6379 |

Note: `compose.yml` (the canonical compose file; there is NO `docker-compose.yml`)
only declares **`api`** and **`redis`**. The dashboard and asset-server images are NOT
in compose — they are built/pushed by CI and presumably run elsewhere (or the dashboard
is run via `make run` in dev). So the "3 image" deployment is realized via the GitHub
Actions workflow, not compose.

### Image registry names (CI: `.github/workflows/build-push.yaml`)
- Frontend: `ghcr.io/<owner>/satisfactory-dashboard` (the bare repo name)
- API: `ghcr.io/<owner>/satisfactory-dashboard-api`
- Asset server: `ghcr.io/<owner>/satisfactory-dashboard-asset-server`

CI jobs:
- `build-frontend` — always runs; builds `dashboard/Dockerfile` with build-args
  `VITE_BUILD_VERSION=<release-timestamp-sha>` and `INCLUDE_ASSETS=false`.
- `build-api` — always runs; builds `./api` context (no build args).
- `build-asset-server` — ONLY on manual `workflow_dispatch` with
  `build_asset_server=true`. It pulls Git LFS (`git lfs pull`) first because the assets
  are LFS-tracked tarballs. This is gated/rare because the LFS assets are multi-GB.

## 2. Build args and how assets are wired in

### `dashboard/Dockerfile`
- `ARG INCLUDE_ASSETS=false` — when `true`, the build extracts the three asset tarballs
  from `assets/*.tar.gz` into `public/assets/images/satisfactory/...` BEFORE `bun run build`,
  so they get bundled into the SPA `dist/`. CI sets it to `false`, meaning the production
  frontend image does NOT contain assets; the separate asset-server serves them instead.
- `ARG VITE_BUILD_VERSION=localbuild` -> `ENV VITE_BUILD_VERSION` -> consumed by
  `vite.config.ts` as `define.__BUILD_VERSION__`.
- Build context for this Dockerfile is the repo root `.` (so it can see `assets/` and
  `dashboard/`).

### `asset-server/Dockerfile`
- Pure nginx. Extracts the same three tarballs into
  `/usr/share/nginx/html/assets/images/satisfactory/...`:
  - `map-realistic.tar.gz` and `map-game.tar.gz` -> `.../map/1763022054/{realistic,game}/{z}/{x}/{y}.png`
  - `scraped-images.tar.gz` (`--strip-components=1`) -> `.../satisfactory/{16x16,32x32,64x64,128x128,256x256}/<name>.png`
- `asset-server/nginx.conf` serves ONLY `/assets/images/satisfactory/` (1y immutable
  cache), a `/health` endpoint, and 404s everything else.

### Asset packing / LFS (`Makefile`, `.gitattributes`)
- `.gitattributes`: `assets/*.tar.gz filter=lfs` — the tarballs are Git LFS objects.
- `make unpack-assets` extracts tarballs into `dashboard/public/...` for local dev.
- `make pack-assets` repacks. `make asset-server` / `asset-server-push` build/push the
  asset image to `ghcr.io/saffronjam/satisfactory-dashboard-asset-server`.
- **Asset sizes (the size concern):** `assets/map-realistic.tar.gz` = **1.4 GB**,
  `assets/map-game.tar.gz` = **1.1 GB**, `assets/scraped-images.tar.gz` = **81 MB**.
  Total ~2.6 GB compressed. This is why `INCLUDE_ASSETS=false` by default and the
  asset-server is built only on manual dispatch — embedding all of this into a single
  Go binary via `go:embed` would produce a >2.6 GB binary, which is impractical.

## 3. Runtime env vars and ports

### API container (`compose.yml` + `api/pkg/config/environment.go`)
- `SD_BOOTSTRAP_PASSWORD` (default `change-me`) — initial dashboard auth password.
- `SD_MAX_SAMPLE_GAME_DURATION` (required, seconds) — history retention window.
- `SD_NODE_NAME` — instance ID for distributed polling (set in Makefile dev targets;
  goes away in the single-process refactor, see plan 02).
- `SD_API_PORT` — port override (default from config `port: 8081`).
- `SATISFACTORY_DASHBOARD_API_CONFIG_FILE` — config path; defaults to `config.local.yml`.
- `GIN_MODE=release` (set in `api/Dockerfile`).
- Config file `api/config.docker.yml` is copied into the image AS `config.local.yml`
  and contains: `port: 8081`, `mode: dev`, `externalUrl`, `satisfactoryApi.url`,
  `redis.url: redis:6379`. (Redis URL/password go away in plan 03.)

### Dashboard container (`dashboard/docker-entrypoint.sh`)
- `API_URL` (optional) — written at container start into
  `/usr/share/nginx/html/runtime-config.js` as `window.__RUNTIME_CONFIG__.apiUrl`.
  This is the runtime-config indirection that lets one nginx image point at different
  API hosts without rebuild.
- nginx listens on **3000** (`dashboard/nginx.conf`), SPA fallback to `index.html`.

## 4. How the dashboard reaches the API today (CORS / cross-origin)

Resolution chain in `dashboard/src/config.ts`:
1. `window.__RUNTIME_CONFIG__.apiUrl` (from `runtime-config.js`, injected at container
   start; `index.html` loads `<script src="/runtime-config.js">`).
2. `import.meta.env.VITE_API_URL` (build-time, dev).
3. Default `http://localhost:8081/v1`.

All data access uses this base URL with `credentials: 'include'`:
- SSE: `new EventSource(`${API_URL}/sessions/${id}/events`)` in
  `dashboard/src/contexts/api/ApiProvider.tsx`.
- REST services: `dashboard/src/services/{authApi,sessionApi,settingsApi,historyApi,nodesApi}.ts`
  all do `fetch(`${API_URL}/...`, { credentials: 'include' })`.

Because the SPA (nginx:3000) and the API (Go:8081) are on **different origins**, the API
must allow cross-origin credentialed requests. `api/routers/router.go` `corsAllowAll()`
sets `AllowCredentials=true` and an `AllowOriginFunc` that mirrors back ANY origin
(effectively allow-all-with-credentials). This is needed today purely because of the
split-origin topology.

### Asset references (relative — important for consolidation)
All map tiles and item icons are referenced with **relative** paths (no leading slash),
e.g. in `dashboard/src/sections/map/view/map-view.tsx`:
`url={`assets/images/satisfactory/map/1763022054/${style}/{z}/{x}/{y}.png`}` and icons
like `src={`assets/images/satisfactory/64x64/${name}.png`}` across many `sections/map/*`,
`sections/overview/*`, `sections/production/*`, `sections/trains/*`, `milestones`, and
`components/popover-map/PopoverMap.tsx`. Because they are relative, they resolve against
whatever origin serves the SPA. Today that means the SPA's own nginx must ALSO have the
assets present (hence `INCLUDE_ASSETS=true` for an all-in-one frontend image) OR a
deploy-time reverse proxy maps `/assets/...` to the asset-server. The asset-server's
`/assets/images/satisfactory/` path prefix exactly matches these relative references,
implying a fronting proxy/path-routing in the real deployment. There is no separate
asset base-URL env var; the icon/tile paths are hardcoded relative.

## 5. What must change to ship ONE Go container (GraphQL-only)

Target: a single `CGO_ENABLED=0` Go binary that (a) serves the built SPA via `go:embed`,
(b) serves assets, (c) exposes only a GraphQL endpoint (+ subscriptions over graphql-ws),
with NO Redis, NO REST, NO SSE, NO separate nginx images.

### Backend Dockerfile (replaces all three)
- Single multi-stage build: stage 1 build SPA with bun (move `dashboard/` build here or
  add a frontend build stage), stage 2 `go build` embedding `dist/` + serving assets,
  final `alpine:3` (or `scratch`) image. Keep `CGO_ENABLED=0` (modernc.org/sqlite is
  pure-Go per plan 04, so this holds).
- The Go binary must:
  - `go:embed` the Vite `dist/` (SPA) and serve it with an SPA fallback to `index.html`
    (Gin `NoRoute` -> serve embedded `index.html`); equivalent of `try_files $uri /index.html`.
  - Serve `/assets/images/satisfactory/...` (the relative-path contract above must hold).
  - Expose ONE GraphQL HTTP endpoint (e.g. `/graphql`) + the graphql-ws subscription
    endpoint. Remove all `/v1/*` REST routes, the SSE route, and (decide) the Swagger/
    metrics routes. No `runtime-config.js` / `__RUNTIME_CONFIG__` indirection is needed
    anymore — the SPA points at its own origin.
- Gin currently has NO static/embed serving and NO `NoRoute` handler (grep found none in
  `main.go`/`routers/`/`cmd/`). This must be added new.

### Asset handling decision (THE open size problem)
Embedding 2.6 GB of map tiles via `go:embed` is not viable. Options for the plan author
to resolve (flag to plan 01):
- (a) Keep map tiles OUT of the binary; serve them from a host-mounted volume / object
  store that the single Go container reads from a configured directory; only embed the
  ~81 MB scraped icons (still large for a binary but possible).
- (b) Keep a thin assets sidecar/volume but drop the nginx asset *image* in favor of the
  Go binary serving a mounted assets dir.
- (c) Build-arg gated embed (small "icons-only" default; full-map opt-in) mirroring
  today's `INCLUDE_ASSETS`. Note `go:embed` cannot be conditional at build time without
  build tags / separate embed files, so this needs build-tag plumbing.
This decision is load-bearing for the Dockerfile and must be settled before plan 01
finalizes. The current split exists SPECIFICALLY to avoid shipping multi-GB images.

### CORS / same-origin
Once the SPA, assets, and GraphQL are all served by the same Go process on one origin,
the cross-origin `corsAllowAll()` (mirror-any-origin + credentials) can be removed
entirely. Auth cookies become same-origin (simpler, more secure); `credentials: 'include'`
on the urql client / graphql-ws is still fine same-origin. Remove `gin-contrib/cors`
unless an explicit external origin is still required.

### Things to delete in this consolidation (clean break, no back-compat)
- `dashboard/Dockerfile`, `dashboard/nginx.conf`, `dashboard/docker-entrypoint.sh`,
  `dashboard/src/config.ts` runtime-config indirection + `index.html` `runtime-config.js` script.
- `asset-server/` (Dockerfile + nginx.conf) entirely; the Go binary serves assets.
- `redis` service in `compose.yml`; `redis.*` config in `config.{docker,local}.yml`;
  `make deps`/`deps-down` Redis targets (plan 03).
- `build-frontend`, `build-asset-server` jobs in CI; collapse to a single
  `build` job producing one image. Drop `INCLUDE_ASSETS`; reconsider `VITE_BUILD_VERSION`
  (keep, fed into the unified build).
- `SD_NODE_NAME` / `SD_API_PORT` multi-instance Makefile targets (plan 02).

## 6. Port summary (before -> after)
- Before: 3000 (SPA nginx), 80 (asset nginx), 8081 (API), 6379 (Redis).
- After: ONE listening port (single Go server) serving SPA + assets + GraphQL; no Redis.
