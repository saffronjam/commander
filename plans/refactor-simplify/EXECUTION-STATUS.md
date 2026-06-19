# Execution status — refactor-simplify migration

Live progress tracker for the migration (plans 00–08). Updated as milestones land.
Everything below is in the working tree (no git commits, per the operator's choice).

## Build state (current)

`cd api && CGO_ENABLED=0 go build ./...` → **GREEN**. `go vet ./...` → clean.
`go test ./internal/store/... ./pkg/eventbus/...` → pass. **The app now SERVES GraphQL**:
`cmd/app.go` builds a stdlib `http.ServeMux` + gqlgen handler (`cmd/server.go`) at `/graphql`
(+ `/healthz`); Gin is out of the serve path. The poller implements `graph.Snapshotter` +
`graph.Poller` and dual-writes live data to the eventbus/LatestStore/SQLite (the Redis
SSE/cache path is still present for now and gets deleted in M5). The old REST/Gin files under
`routers/` + `middleware/` are now DEAD CODE (compiled, not served) — deleted in M5.

## Milestones

- **M1 — SQLite + sqlc + golang-migrate store** ✅ DONE
  `api/internal/store` (migrations, queries, generated `sqlite/`, domain wrappers, retention),
  `api/internal/migrate`, `api/internal/session` + `api/internal/auth` leaf packages. 9/9 tests.
  - Known fix applied: migration seed `log_level` value normalized to `Info` (matches `models.LogLevel`).

- **M2 — Eventbus + single in-process poller** ✅ DONE
  `api/pkg/eventbus` (channel bus + `LatestStore`, race-tested). Lease subsystem deleted,
  `session_manager.go` de-leased (WaitGroup drain, R3 ctx fix), `cmd` collapsed to one flagless
  process owning the poller, `/v1/nodes` + `SD_NODE_NAME` removed, Makefile de-flagged.
  - DEFERRED into M3: the poller's Redis→bus *producer rewire* + Gin→stdlib-mux swap.

- **M3 — gqlgen GraphQL backend** ✅ CORE DONE (app serves GraphQL; build/vet/tests green)
  Cutover landed: stdlib mux + gqlgen handler in `cmd/app.go`/`cmd/server.go`, `@auth` directive
  + cookie auth middleware, poller implements `Snapshotter`/`Poller` + dual-writes to the bus.
  Deferred to M5 (coupled with the Redis cut): delete dead REST/SSE/Gin files + auth→SQLite.
  DONE: gqlgen toolchain (`tool` directive); `api/schema.graphql` (~30 typed domains, ~24 enums,
  all root ops, per-type history + per-domain subscriptions) generating cleanly; `internal/graph`
  generated.go + models_gen.go; ~130 hand mappers (`mappers_*.go`); `StoreAdapter` (GraphStore over
  SQLite); `Resolver` DI struct + interfaces; **all 85 resolvers implemented** (`resolvers_*.go`):
  71 data resolvers (snapshot/history/subscription) + 14 config/auth/session; `@auth` directive;
  error presenter; auth caller context (`internal/auth/context.go`); cookie/clientIP helpers
  (`httpcontext.go`); additive SQLite boot in `pkg/db` (`Setup()` opens+migrates+`store.New`,
  `Config.DBPath`/`SD_DB_PATH`).
  - NOTE: this project does NOT use gqlgen follow-schema single-file layout — resolvers live in
    `resolvers_*.go`; `schema.resolvers.go` is root-wiring-only. Do NOT run `gqlgen generate`
    blindly (it re-stubs into `schema.resolvers.go` and collides). Regenerate generated.go/models
    only, or hand-add new resolvers.

  REMAINING M3 (the "wire + delete" cutover — an atomic change; build will break mid-cutover):
  1. **Poller rewire (M2-deferred):** implement `graph.Snapshotter` + `graph.Poller` on
     `worker.SessionManager` (`Latest`/`CurrentSaveName`/`Stage`/`Connectivity`,
     `PreviewSession`/`ValidateSession`/`StartSession`/`StopSession`); publish to the eventbus +
     update `LatestStore` in the poll handler (replace `kvClient.Set`/`Publish`); fire
     `KindConnectivity`; implement `store.HistoryFrontier`. Payload contract (from agents):
     single values are pointers (`*models.FactoryStats`); drones/trains/trucks ride
     `models.Vehicles` (value), stations ride `models.VehicleStations`; belts/pipes/hypertubes are
     bundled structs (`models.Belts`/`Pipes`/`Hypertubes`).
  2. **Auth → SQLite + middleware:** refactor `service/auth` (or new) to the M1 store
     (`auth_password`/`auth_tokens`); HTTP middleware reads `sd_access_token` cookie → validates →
     `auth.WithUser` + `WithResponseWriter` + `WithClientIP`; gqlgen `wsInitFunc` reads cookie off
     the upgrade request (E-3).
  3. **stdlib mux + gqlgen handler in `app.go`** (decision E-1): replace `routers.NewRouter()` (Gin)
     with `http.ServeMux` + `handler.New(graph.NewExecutableSchema(...))` (POST/GET/Websocket
     transports, `AuthDirective`, `ErrorPresenter`), `/healthz` + `/internal/metrics`, dev Playground;
     wire `Resolver{Store: db.DB.Store-adapter, Snapshot/Poller: poller, EventBus: bus, Auth, Config}`.
  4. **Delete REST/SSE/DTO/Swagger/CORS/Gin:** `routers/api/v1/*`, `routers/routes/*`,
     `events_sse.go`, `middleware/*`, `models/models/{dto,error,state,history_chunk}.go`,
     `status_codes`, swagger `/v2/docs`; drop gin/gin-contrib from go.mod.

- **M4 — GraphQL frontend** ✅ DONE (frontend `tsc`, `lint`, `codegen`, `vite build` all green)
  DONE: deps (urql 5, graphql 17, graphql-ws 6, codegen client-preset 6); `codegen.ts`
  (schema `../api/schema.graphql`) + `bun run codegen` → `src/gql/`; `src/gql/client.ts` (urql HTTP +
  graphql-ws, same-origin `/graphql`, `credentials: include` cookie auth, `mapExchange` dispatching
  `dispatchAuthExpired` on `UNAUTHENTICATED`/401); `GraphQLClientProvider` mounted in `main.tsx`.
  ALL FOUR services migrated to GraphQL (typed docs, mapped to apiTypes shapes incl. enum case
  READY→ready, INFO→Info, SessionStage): `authApi`, `sessionApi`, `settingsApi`, `historyApi`
  (per-type `<domain>History` queries → `HistoryChunk { points: DataPoint[] }`; `generatorStats`
  reshaped via `mapGeneratorStats_world`; `listSaves` via `historySaves`).
  ApiProvider live-layer COMPLETE: all 32 domains stream via `useSubscription` (graphql-ws), paused
  when no sessionId; isOnline from `satisfactoryApiStatusChanged.running`; onSessionUpdate from
  `sessionUpdated`. Subscription docs (`live.ts`, `live_vehicles.ts`, `live_infra.ts`, `live_world.ts`)
  use GraphQL SCHEMA field names; per-domain mappers import the GENERATED gql result types →
  apiTypes shapes (enum case + `name`→`Name`, generatorStats array→map).
  CLEANUP DONE: deleted dead lease/distributed-poll feature — `services/nodesApi.ts`,
  `pages/debug-nodes.tsx`, `sections/debug/view/debug-nodes-view.tsx`, the `/debug/nodes` route +
  nav entry, and the `NodeInfo`/`SessionLease`/`NodesResponse` types in `apiTypes.ts`. Deleted
  `src/config.ts` (runtime REST base URL) + the now-dead `Settings.apiUrl` field. No raw `fetch()`
  REST calls remain in `src/`.
  >> LIVE-LAYER RECIPE (for reference): write each `<domain>Changed` subscription doc using GraphQL
  SCHEMA field names (lowercase), run `bun run codegen` (validates against schema, fails loudly),
  THEN write mappers importing the GENERATED gql result types → apiTypes shapes.
  NOTE: `apiTypes.ts` is RETAINED — it remains the app's domain-type vocabulary that the live mappers
  target; a future pass could collapse it onto generated gql types but that is out of M4 scope.
- **M5 — Redis removal (the cut)** ✅ DONE (build/vet/tests green; grep-gated empty)
  Auth re-homed to SQLite: `service/auth/auth.go` rewritten as a thin wrapper over `db.DB.Store`
  (bcrypt password + `auth_password`/`auth_tokens` tables, sliding-expiry on `ValidateToken` via
  `TouchToken`); public surface preserved so resolvers/middleware/cmd are unchanged.
  Settings re-homed: GraphQL `UpdateSettings` resolver applies the log level in-process after
  persisting; `applyLogLevel` init task seeds the level from SQLite at boot. Redis settings
  pub/sub + `service/settings` + `worker/settings_listener.go` deleted.
  Poller (`worker/session_manager.go`) rewritten: sessions sourced from `db.DB.Store.ListSessions/
  GetSession`; Redis cache `Set` + pub/sub `Publish` removed; Redis history (`StoreHistoryPoint`/
  `PruneOldHistory`) removed — only `UpsertHistoryPoint` (SQLite) + eventbus + LatestStore remain;
  `IsSessionDeleted` guard replaced with `ctx.Err()`; connectivity is in-memory (`sm.conn`,
  `state.isDisconnected`) per the M1 schema design (no online/disconnected columns). Implements
  `store.HistoryFrontier` (`Series`/`CurrentGameTime`); `RunTokenPrune` + `RunHistoryRetention`
  wired as background workers in `cmd/app.go` (slog.Default logger).
  Deleted: `routers/` (all REST/Gin/SSE/middleware), `docs/` (swagger), `pkg/metrics/` (ginmetrics),
  `service/settings/`, `service/session/{cache,store}.go` (kept `game_time.go`), `pkg/db/redis.go`,
  `pkg/db/key_value/`, dead models (`history_chunk.go`, `status_codes/`, settings-diff machinery).
  `pkg/db/db.go` + `pkg/config` de-Redis'd; `go.mod` tidied (go-redis/gin/ginmetrics gone).
  Infra: `redis` service + volume + `depends_on` removed from `compose.yml`; `make deps`/`deps-down`
  + Redis config blocks removed. Grep gate `redis|key_value|gin-gonic|ginmetrics` over Go/yml/Makefile
  is empty (only accurate "replaces Redis" doc comments in `pkg/eventbus` remain).
- **M6 — Deployment consolidation + ORAS** ✅ DONE (backend+frontend build green; both compose files validate)
  Single self-contained Go binary now embeds the SPA: `api/web/embed.go` (`//go:embed all:dist`) +
  `api/web/dist/.gitkeep` + `api/.gitignore` (`web/dist/`); Vite `build.outDir` → `../api/web/dist`;
  `cmd/static.go` `registerStatic` (stdlib SPA fallback + `/assets/images/satisfactory/` FileServer)
  wired LAST in `buildHandler` so `/graphql`+`/healthz` win. Confirmed: full binary (25 MB) embeds
  index.html end-to-end.
  Config: `AssetsDir` (`SD_ASSETS_DIR`, default `/assets`) + `SD_EXTERNAL_URL` env overrides added;
  `config.local.yml`/`config.docker.yml` `externalUrl` defaulted to "" (permissive WS origin, lockable
  via `SD_EXTERNAL_URL`). Dev: Vite proxies `/graphql` (http+ws) → `:8081` so the same-origin client
  works across the two dev ports.
  ADDED: root `Dockerfile` (bun web stage → go build stage embedding dist → alpine, no GIN_MODE/docs);
  `deploy/Dockerfile.seed` (alpine + pinned ORAS CLI); `deploy/seed-assets.sh` (idempotent `oras pull`
  + extract + version marker); `compose.yml` rewritten (one-shot `seed-assets` + long-running `app`,
  `app-data`/`assets` volumes, `service_completed_successfully` gate); `compose.dev.yml` (contributor
  override: no-op seeder + bind-mount local tiles).
  CHANGED: CI `build-push.yaml` → one app `build` (no LFS), `build-seed`, manual `publish-assets`
  (LFS + ORAS push); `Makefile` (`build: frontend-build backend-build` for embed ordering, `clean`
  wipes `web/dist` keeping `.gitkeep`, `docker-build` builds app+seed, `assets-publish` ORAS target,
  asset-server targets + var removed, help rewritten); `dashboard/index.html` runtime-config script
  tag removed.
  DELETED: `api/Dockerfile`, `dashboard/Dockerfile`, `dashboard/nginx.conf`,
  `dashboard/docker-entrypoint.sh`, `asset-server/`, `scripts/flush-instances.sh` (dead Redis-lease
  tool).
  DOCS SWEEP: root `CLAUDE.md` (overview/quick-start/API/workflow/docker/important-notes →
  GraphQL/SQLite/single-container + auth clean-wipe note), `api/CLAUDE.md` + `dashboard/CLAUDE.md`
  (architecture notes flagging the Gin/REST/SSE/Redis sections as historical), `README.md`
  (architecture diagram, quick start, tech stack, deployment + ORAS topology).

## CI/deploy audit (post-M6) — 3 blockers found & fixed, empirically verified
An adversarial audit + real local image builds caught three blockers that a dirty-working-tree
build masked:
- **B1 (gitignore gotcha):** root `.gitignore`'s global `dist/` excluded `api/web/dist`, so
  `!web/dist/.gitkeep` couldn't re-include the placeholder → a clean checkout / backend-only
  `go build` would fail `//go:embed all:dist`. Fixed with a root-level carve-out
  (`!api/web/dist/` + `api/web/dist/*` + `!api/web/dist/.gitkeep`); `git add --dry-run` now tracks
  `embed.go` + `.gitkeep` while built SPA files stay ignored. `make frontend-build` re-`touch`es
  `.gitkeep` (Vite `emptyOutDir` wipes it). NOTE: the whole migration is still uncommitted (in-tree,
  per the operator's choice) — committing must include `api/web/embed.go`.
- **B2 (asset path too deep):** the handler stripped the full `/assets/images/satisfactory/` prefix
  but served `http.Dir(/assets)`, while the seeder writes under `/assets/images/satisfactory/` →
  100% of tiles/icons 404 in prod. Fixed `cmd/static.go` to serve
  `http.Dir(filepath.Join(assetsDir, "images", "satisfactory"))` (keeps the URL prefix distinct
  from the SPA's own `/assets/` bundle); verified a real tile resolves in the on-disk layout.
- **B3 (oras path mismatch):** `oras push assets/<f>.tar.gz` made path-qualified titles, so
  `oras pull -o $tmp` restored to `$tmp/assets/<f>` while the seeder reads `$tmp/<f>` → seeder
  aborts under `set -eu` → app never starts. Fixed both the CI job (`working-directory: assets`)
  and the Makefile (`cd $(ASSETS_DIR) && oras push <basename>`); proven with a real local oras
  oci-layout round-trip (old → MISSING/abort, new → FOUND/works).
Also fixed earlier in this pass: `Dockerfile.seed` `ARG TARGETARCH=amd64` hardcoded amd64 (arm64
images got an amd64 oras) → now `ARG TARGETARCH` + `${TARGETARCH:-amd64}` (verified native arm64
oras runs); `.dockerignore` now excludes `assets/` (2.6 GB) + `api/web/dist`.
Empirical verification this pass: both images `docker build` exit 0 (app 52 MB, embeds index.html;
seed runs oras 1.2.0 + fails fast without SD_ASSETS_REF); B2 tile path resolves on disk; B3 oras
round-trip; backend build/vet/test green; frontend tsc/lint green.

## Migration complete
All six milestones (M1–M6) are landed. Backend: `CGO_ENABLED=0 go build ./...`, `go vet ./...`,
`go test ./...` all green; `go.mod` free of redis/gin. Frontend: `bun run codegen`, `bun x tsc
--noEmit`, `bun run lint`, `bun run build` all green; SPA embeds into the binary. Both compose
files validate. The repo-wide grep gate for `redis|key_value|gin-gonic|ginmetrics|SSE|nginx|
asset-server|runtime-config|GIN_MODE|/v2/docs` over live code/config is empty (only historical
plans/specs and intentional "replaces Redis" doc comments remain).

## Resume tips
- `go.mod` `go` directive was bumped to 1.25.0 by `go get`.
- The eventbus `Subscriber` API: `Subscribe(kinds...)`, `SubscribeSession(sid, kinds...)`,
  `SubscribeDomain(sid, save, dataType)`, `Unsubscribe(ch)`.
- Snapshotter.Latest returns the poller's decoded payload as `any` (same value the FRM client
  endpoint returns) — resolvers type-assert per `resolvers_*.go`.
