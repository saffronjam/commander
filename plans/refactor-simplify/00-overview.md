# 00 — Overview: The Great Simplification

> **Status:** master plan / entry point. Read this first, then `DECISIONS.md` (the locked
> decision log), then the eight sub-plans (`01`–`08`) and the critic's gaps doc (`99`).
> **Planning only — no code changes.** This document rolls up the sub-plans; where a
> detail conflicts, the owning sub-plan wins (cross-referenced inline), and where a decision
> was locked, `DECISIONS.md` wins.

> **Settled decisions.** The cross-document contradictions and gaps the critic raised (C1–C9,
> B1–B13) are now resolved. The four locked user decisions (D-A … D-D) and the eleven
> engineering resolutions (E-1 … E-11) live in **`DECISIONS.md`** — that file is the durable
> record of *why* the plan is shaped this way. This overview reflects those resolutions
> throughout; the inline `[E-n]`/`[D-x]` tags point back to them.

## 1. Executive summary

The Satisfactory Dashboard works, but its deployment and data plane are far heavier than
the problem warrants. Today it ships as **three container images plus Redis** and runs an
entire **home-built distributed-polling coordination layer** that exists only to let
multiple API replicas split work between them — replicas nobody actually runs.

Concretely, the current shape is:

- **Three images + Redis.** A Go API (`golang:alpine` → `alpine:3`, REST + SSE + Swagger),
  an nginx-served SPA (`oven/bun` → `nginx:alpine`), an nginx asset-server (2.6 GB of LFS
  map tiles + item icons), and a Redis container. The split-origin topology (SPA on
  nginx:3000, API on Go:8081) is the *only* reason the API runs `corsAllowAll()` with
  credentials and the SPA needs the `window.__RUNTIME_CONFIG__.apiUrl` / `docker-entrypoint.sh`
  indirection.
- **A distributed poll-lease subsystem** (`api/service/lease/`): Redis lease keys,
  heartbeat keys, owner-checked Lua scripts, FNV-1a rendezvous hashing, a `-api` /
  `-publisher` / `-settings-listener` worker-flag split, `SD_NODE_NAME` node identity, and
  a `/v1/nodes` cluster-view endpoint. Its whole job is "exactly one replica polls each
  session" — an invariant that is satisfied for free the moment there is one process.
- **Redis as everything**: live-state cache (`state:*`), SSE-backing pub/sub
  (`satisfactory_events:*`), settings store + change broadcast, auth password + tokens,
  session config, a delete tombstone, and the history time-series (a ZSET index plus a JSON
  string per point).
- **Hand-rolled frontend networking**: no GraphQL or HTTP client library at all — five REST
  fetchers in `services/`, a single `EventSource` SSE pipe seeded by a REST snapshot,
  dispatching ~30 event payloads into a mutable ref that React snapshots on a 2-second
  `setInterval`, plus a 20-second session-status poll. Types come from tygo
  (`apiTypes.ts`), which dumps the *entire* Go models package (DTO aliases, REST envelopes,
  node/lease types, raw FRM shapes) into TS.

The refactor collapses all of this against the user's three goals:

1. **One container.** Embed the built SPA in the Go binary (`go:embed` + SPA fallback),
   serve the tiles from an `/assets` volume that a one-shot ORAS seeder fills from a registry
   artifact (the 2.6 GB tiles are *not* embedded and never bloat the app image), drop nginx and
   Redis. One long-running image, one process, one port, one origin → no CORS, no runtime-config
   indirection. (Plan **01**, decision **E-12**.)
2. **One in-process poller.** Delete the lease subsystem, the worker-flag split, node
   identity, the `/v1/nodes` cluster view, and the multi-instance Makefile targets. The
   `SessionManager` survives as a single supervisor that owns every session unconditionally.
   This is justified at the target scale — **up to ~10 concurrent sessions** [D-B]. (Plan **02**.)
3. **No Redis.** Live data flows through an in-process Go-channel eventbus (plan **05**);
   everything durable — sessions, settings, auth, and the history time-series — moves to an
   embedded SQLite database driven by sqlc + golang-migrate (plan **04**). The kill-map of
   every Redis touchpoint → its new home is plan **03**.

On top of that data-plane change, **GraphQL replaces the entire REST + SSE surface** (~39
routes + one SSE stream). gqlgen serves typed snapshot queries, per-type history queries,
mutations (sessions/settings/auth), and **per-domain typed subscriptions** bridged from the
eventbus (plan **06**). The schema is **fully typed per-type with no opaque payload** [D-C]:
no `liveState` sparse object, no `HistoryChunk`, no `JSON`/`Any`/`Int64` scalar on the wire.
The React app becomes GraphQL-native: urql + `@graphql-codegen/client-preset` + `graphql-ws`,
with per-page "smart" queries/subscriptions that fetch exactly what each route renders
(plan **07**). Plan **08** is the authoritative model → GraphQL type → sqlc table catalog
that 04/06/07 all conform to, and it retires tygo.

The router is **stdlib `net/http` ServeMux + the gqlgen handler — Gin is removed entirely**
[E-1]. There is **no mock mode** — it never existed in code; the stale `CLAUDE.md` references
are deleted [D-D].

The reference for every pattern is **saffron-hive** (`/Users/emikar/repos/saffron-hive`):
its stdlib-mux/gqlgen/eventbus/sqlc/migrate recipes are copied where they fit; its SvelteKit +
urql data layer is translated to React (urql React bindings). We do **not** switch UI frameworks.

**Clean breaks, not dual paths** (per `CLAUDE.md`): Redis code paths, REST handlers, SSE, the
lease subsystem, Gin, and tygo are deleted outright — never feature-flagged or kept as a dual
path. The one operator-facing consequence is the **auth clean wipe** [D-A]: this is an
explicit, user-approved cutover (re-set your password after upgrade), surfaced as a release
note — not an accidental loss of backward compatibility.

---

## 2. Architecture: before → after

### BEFORE — 3 images + Redis, distributed poller, REST + SSE

```
                              ┌──────────────────────────────────────┐
   Browser (SPA on nginx)     │  GitHub Actions builds & pushes:      │
   ┌───────────────────┐      │   - satisfactory-dashboard      (SPA) │
   │ React app         │      │   - satisfactory-dashboard-api  (Go)  │
   │ services/*Api.ts  │      │   - satisfactory-dashboard-           │
   │ EventSource (SSE) │      │       asset-server  (manual dispatch) │
   │ __RUNTIME_CONFIG__│      └──────────────────────────────────────┘
   └─────────┬─────────┘
             │ cross-origin (CORS, credentials)
   ┌─────────┼───────────────────────────────────────────────────────────────┐
   │         │                                                                 │
   ▼ :3000   ▼ :8081 (REST /v1/* + SSE /v1/sessions/:id/events)        ▼ :80   │
 ┌──────────────┐   ┌──────────────────────────────────────────┐   ┌────────────────┐
 │ nginx        │   │ Go API  (golang:alpine -> alpine:3)        │   │ nginx          │
 │  SPA dist/   │   │  Gin router, REST handlers, SSE multiplexer│   │  asset-server  │
 │  try_files   │   │  ┌──────────────────────────────────────┐ │   │  2.6 GB tiles  │
 └──────────────┘   │  │ worker-flag split:                   │ │   │  + item icons  │
                    │  │  -api / -publisher / -settings-listen│ │   └────────────────┘
 relative asset ───────────────────────────────────────────────────────▲
 URLs resolve to    │  │ SessionManager (poller)              │ │
 whatever origin    │  │   lease-gated: IsOwned/IsOwnedStrict │ │
 serves the SPA     │  │ lease/: rendezvous hash, heartbeat,  │ │
                    │  │   Lua renew/release, SD_NODE_NAME    │ │
                    │  │ /v1/nodes cluster view               │ │
                    │  └───────────────────┬──────────────────┘ │
                    └──────────────────────┼────────────────────┘
                                           │  ALL state via Redis
                                           ▼ :6379
                              ┌──────────────────────────────┐
                              │ Redis                         │
                              │  state:*          (live cache)│
                              │  satisfactory_events:* (pub/sub→SSE)
                              │  settings_changed (pub/sub)   │
                              │  global:settings  auth:*      │
                              │  session:*  deleted-session:* │
                              │  history:* (ZSET idx + JSON)  │
                              │  poll:lease:*  poll:node:*    │
                              └──────────────────────────────┘
```

Data flows, before:
- **Live:** FRM game server → poller (lease-gated) → `kvClient.Set(state:*)` +
  `kvClient.Publish(satisfactory_events:*)` → Redis pub/sub → per-connection Redis SUBSCRIBE
  in `events_sse.go` → `CoalescingQueue` → `gin.Stream` (SSE) → browser `EventSource` → ref →
  2s `setInterval` → React state.
- **Historical:** poller → Redis ZSET (`history:*` index + JSON-per-point) → REST
  `GET /v1/sessions/:id/history/:dataType` → `historyApi.ts` → client-side downsample.

### AFTER — 1 image, 1 process, 1 origin; GraphQL only; channels + SQLite

```
   Browser (same-origin SPA served by the Go binary)
   ┌─────────────────────────────────────────────────────────┐
   │ React app                                                 │
   │  urql Client  (relative /graphql)                         │
   │  graphql-ws   (relative /graphql upgraded to ws;          │
   │                same-origin cookie carries auth [E-3])     │
   │  @graphql-codegen/client-preset  (src/gql/)               │
   │  per-page useQuery / useMutation / useSubscription        │
   │   • snapshot query  <domain>(sessionId)        [first paint]
   │   • live subscription  <domain>Changed(sessionId)         │
   │   • history query  <domain>History(sessionId, saveName…)  │
   └───────────────────────────┬─────────────────────────────┘
                               │ same origin — no CORS, no runtime-config
                               ▼ :8081
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ ONE Go binary  (CGO_ENABLED=0, alpine:3)                                    │
 │                                                                             │
 │  stdlib net/http ServeMux  (Gin removed entirely [E-1])                     │
 │   /graphql ──► gqlgen handler (POST/GET + Websocket transport;              │
 │                wsInitFunc reads auth cookie off the upgrade request [E-3];  │
 │                Upgrader.CheckOrigin from config.ExternalURL [E-4])          │
 │   /assets/images/satisfactory/* ──► FileServer over /assets vol (ORAS-fed)  │
 │   /healthz, /internal/metrics ──► plain HTTP                                │
 │   <SPA fallback> ──► go:embed dist/ (index.html for unknown non-asset,      │
 │                       non-/graphql paths) — registered LAST                 │
 │                                                                             │
 │  ┌─────────────────────────────────────────────────────────────────────┐  │
 │  │ gqlgen resolvers  (fully typed, no opaque payload [D-C])             │  │
 │  │   Query (snapshot)  : sessions/settings/auth + per-domain typed      │  │
 │  │                       reads (circuits/players/drones/trains/…)        │  │
 │  │   Query (history)   : <domain>History → [<Type>HistoryPoint!]!        │  │
 │  │                       (5 types) + historySaves                       │  │
 │  │   Mutation          : login/changePassword/sessions CRUD/settings    │  │
 │  │   Subscription      : <domain>Changed (per domain) +                 │  │
 │  │                       connectivityChanged + sessionUpdated           │  │
 │  │     @auth directive (default-deny) · ErrorPresenter                  │  │
 │  └───────────▲───────────────────────▲──────────────────▲──────────────┘  │
 │              │ Snapshot() reads       │ Subscribe()      │ store reads      │
 │  ┌───────────┴───────────┐   ┌────────┴─────────┐  ┌─────┴───────────────┐ │
 │  │ SessionManager (poller)│  │ eventbus.ChannelBus│ │ store.DB (sqlc)     │ │
 │  │  one supervisor, ALL   │  │  topic = (sid,save,│ │  sessions/settings/ │ │
 │  │  sessions, no leases   │──►│        dataType)   │ │  auth_password/     │ │
 │  │  LatestStore (in-mem   │  │  drop-on-full      │ │  auth_tokens/       │ │
 │  │  state: per (sid,save))│  │  coalesce-per-type │ │  history_points     │ │
 │  │  history.Record() ─────────────────────────────► │  golang-migrate iofs│ │
 │  └───────────┬────────────┘                         │  modernc.org/sqlite │ │
 │              │                                       │  (WAL)              │ │
 └──────────────┼────────────────────────────────────────────┼────────────────┘
                │ FRM poll                                     │
                ▼                                              ▼ /data volume
        FRM game server                              SQLite file + -wal/-shm
                                                  /assets volume (filled by the
                                                   one-shot ORAS seeder)
```

Data flows, after:
- **Live:** FRM → poller (unconditional) → `LatestStore.Put((sid, save), …)` (in-memory
  snapshot) + `bus.Publish(topic=(sid,save,dataType))` → `ChannelBus` fan-out (drop-on-full,
  coalesce-per-type) → the matching `<domain>Changed` subscription resolver (subscribe-first,
  then snapshot, then drain) → graphql-ws frame → urql `useSubscription` → React state
  (`use-context-selector`). Offline/online rides `connectivityChanged`; save-name/config
  change rides `sessionUpdated`.
- **Historical:** poller → `history.Record` → `UpsertHistoryPoint` (SQLite `history_points`,
  composite PK `(session_id, save_name, data_type, game_time_id)`, JSON `data`, upsert on
  same game-time) → one **typed** `<domain>History(sessionId, saveName, since, maxPoints)`
  query per data type (resolver `json.Unmarshal`s `data` into `[<Type>HistoryPoint!]!`; raw or
  server-side keep-last bucketed) → urql `useQuery(since: cursor)` → chart. Live points are
  stitched on by the `<domain>Changed` subscription's `gameTimeId` — there is no dedicated
  `historyAppended` subscription [E-9].

There is **no** single `liveState`/`State` subscription and **no** `HistoryChunk`/opaque `data`
field anywhere on the wire [D-C]. `gameTimeId` / `shipReturnTime` / `since` stay GraphQL `Int`
(no `Int64` scalar) [E-2].

---

## 3. Component inventory (rolled up from `filesAddChangeDelete`)

### DELETED (clean break, no replacement or replaced wholesale)

Backend:
- `api/service/lease/` — entire distributed-lock package (manager, instance, rendezvous,
  types, lua_scripts, tests). *(02)*
- `api/routers/api/v1/nodes.go`, `api/routers/routes/nodes.go`, `api/models/models/nodes.go`
  — cluster view + `NodeInfo`/`SessionLease`/`NodesResponse`. *(02)*
- `api/pkg/db/redis.go`, the whole `api/pkg/db/key_value/` package — Redis client +
  wrapper; the `go-redis/v9` go.mod dependency. *(03)*
- `api/routers/api/v1/events_sse.go` — SSE endpoint + `CoalescingQueue` + per-client map. *(05/06)*
- All `api/routers/api/v1/*.go` REST handlers + `api/routers/routes/*.go` route groups. *(06)*
- **Gin entirely** — the `gin.Engine` router, `gin-contrib/cors`, `corsAllowAll()`, `gin.SetMode`,
  `r.StaticFS`/`r.NoRoute`, `ginmetrics` wiring, and the `gin`/`gin-contrib` go.mod deps
  [E-1/E-4]. *(01/02/06)*
- `api/middleware/auth.go` (`RequireAuth`) + `api/middleware/session_stage.go` (425 gate)
  — replaced by the `@auth` directive + `Session.stage` resolver field. *(06)*
- `api/models/models/dto.go` (DTO aliases + REST composites), `error.go` (REST envelopes),
  the `status_codes` package, `SseSatisfactoryEvent`, `SatisfactoryEventKey`. *(06/08)*
- Swagger: `swag`-generated docs + `/v2/docs` handler (incl. the stale mock reference). *(06)*
- `api/export/tygo.yml` + `api/export/` — tygo config [E-8]. *(08)*
- The old worker store packages superseded by `internal/store`:
  `api/service/session/cache.go`, `api/service/session/store.go`,
  `api/service/settings/service.go`, `api/service/auth/auth.go` (Redis impl). *(03/04)*
- `specs/002-redis-poll-lease/` — historical spec, archived. *(02)*

Deployment / dev:
- `dashboard/Dockerfile`, `dashboard/nginx.conf`, `dashboard/docker-entrypoint.sh`. *(01)*
- `asset-server/` (entire dir). *(01)*
- `redis` service + `redis-data` volume in `compose.yml`; `make deps`/`deps-down`. *(01/03)*
- Makefile multi-instance targets: `backend-2`, `backend-api`, `backend-poller`,
  `backend-api-2`, `backend-poller-2`. *(02)*
- `GIN_MODE` env in the Dockerfile [E-1]. *(01)*

Frontend:
- `dashboard/src/services/` (all five `*Api.ts`). *(07)*
- `dashboard/src/contexts/api/ApiProvider.tsx`, `SessionAwareApiProvider.tsx`, `useApi.ts`. *(07)*
- `dashboard/src/hooks/useHistoryData.ts`. *(07)*
- `dashboard/src/apiTypes.ts` (tygo output) [E-8]. *(07/08)*
- `dashboard/src/config.ts` (runtime-config / `apiUrl` indirection). *(01/07)*
- `dashboard/src/pages/debug-nodes.tsx` + `debug-nodes-view.tsx` + the `/debug/nodes` route. *(02/07)*

### ADDED

Backend store (04):
- `api/sqlc.yaml`; `api/internal/store/` (`migrations/00N_*.{up,down}.sql`, `queries/*.sql`,
  generated `sqlite/`, `migrations.go`, `db.go`, `store.go`, `mapper.go`,
  `sessions.go`/`settings.go`/`auth.go`/`history.go`, `retention.go`, tests);
  `api/internal/migrate/migrate.go`; `api/internal/session` + `api/internal/auth`
  (dependency-free typed string aliases `ID` / `Token`, leaf packages) [E-5].

Backend eventbus (05):
- `api/pkg/eventbus/` (`eventbus.go`, `channel.go`, `channel_test.go`, `snapshot.go`).

Backend GraphQL (06):
- `api/gqlgen.yml`; `api/schema.graphql`; `api/internal/graph/` (`resolver.go`,
  `*.resolvers.go`, generated `generated.go` + `model/models_gen.go`, `mappers.go`,
  `enums.go`, `directive.go`, `error_presenter.go`); `api/internal/auth/middleware.go` +
  `wsInitFunc` (reads the cookie off the upgrade request) [E-3].

Deployment (01, E-12):
- root `Dockerfile` (multi-stage web + go + alpine app image, no `GIN_MODE`); `api/web/embed.go` +
  `api/web/dist/.gitkeep`; `api/routers/spa.go` (`RegisterStatic` as a stdlib `http.Handler`) [E-1];
  `deploy/Dockerfile.seed` + `deploy/seed-assets.sh` (one-shot ORAS asset seeder); `make assets-publish`.

Frontend (07):
- `dashboard/codegen.ts`; `dashboard/src/gql/` (generated + `client.ts` + `GraphQLClientProvider.tsx`);
  `dashboard/src/contexts/live/LiveStateProvider.tsx` + `LiveStateContext.ts`;
  `dashboard/src/contexts/auth/AuthDataLoader.tsx`.

### REWRITTEN (changed substantially in place)

- `api/cmd/flag.go` — worker-flag machinery → flat `Options`/`ParseFlags`. *(02)*
- `api/cmd/app.go` — unconditional startup; `App` builds an `*http.Server` around the stdlib
  mux (no `gin.SetMode`/`routers.NewRouter()`) [E-1]; `App` owns the poller; ctx-driven shutdown;
  boot wires migrate-up + `store.New` + eventbus + GraphQL. *(02/04/06)*
- `api/worker/session_manager.go` — de-leased; publishes to bus keyed on `(sid, save, dataType)`
  [E-11]; writes `LatestStore`; fires `connectivityChanged`; `sync.WaitGroup` drain. *(02/05)*
- `api/service/frm_client/client.go` — `onDisconnected`/recovery drive connectivity events. *(05)*
- `api/pkg/config/` — drop `Redis`/`NodeName`; add `AssetsDir`/`DBPath`; `ExternalURL` is the
  single origin source for the WS `CheckOrigin` [E-4]. *(01/02/03/04/06)*
- `api/routers/router.go` → stdlib mux + gqlgen handler; remove Gin + CORS [E-1/E-4]. *(01/06)*
- `api/go.mod` — add gqlgen tool + gorilla/websocket + golang-migrate + modernc; drop gin,
  gin-contrib, redis, tygo. *(03/04/06/08)*
- `compose.yml` — single `app` service + `db-data`/`assets` volumes. *(01/03/04)*
- `.github/workflows/build-push.yaml` — collapse three jobs into one `build`. *(01)*
- root `Makefile` / `api/.air.toml` — flagless run; `make generate` = gqlgen → sqlc → bun
  codegen (the one canonical recipe owned by 08) [E-8]; add migrate targets; drop tygo. *(01/02/04/07/08)*
- `dashboard/package.json` — add urql/graphql/graphql-ws + codegen; codegen scripts. *(07)*
- `dashboard/src/main.tsx` — provider tree (Urql/Live/Auth). *(07)*
- `dashboard/src/contexts/auth/AuthContext.tsx`, `contexts/sessions/SessionProvider.tsx`,
  `contexts/api/ConnectionChecker.tsx`, `hooks/use-unlockables.ts`, every
  `sections/*/view/*-view.tsx`, all `@/apiTypes` importers → `@/gql/graphql`. *(07)*
- root `CLAUDE.md` + `api/CLAUDE.md` + `dashboard/CLAUDE.md` — restate the `make generate` rule
  to the three-step pipeline [E-8]; **delete the stale mock-mode references** ("Set `mock: true`",
  `service/mock_client`, `Config.Mock`) [D-D]; add the auth clean-wipe upgrade note [D-A]. *(08/01)*

---

## 4. Milestone sequencing

### Dependency graph between the sub-plans

```
        04 (sqlite/sqlc store) ────┐         08 (data model & schema)
        05 (eventbus channels) ────┤              is the shared
                                   ▼              contract for 04/06/07
        06 (graphql backend) ◄─────┤              (authored/agreed up front,
                │                  │               not a runtime dependency)
                ▼                  │
        07 (graphql frontend)      │
                                   ▼
        02 (single-process poller) ── reshapes the poller that 04/05/06 plug into
                                   ▼
        03 (redis removal)  ── the CUT: deletes Redis only after every caller is re-homed
                                   ▼
        01 (deployment consolidation) ── needs 06's /graphql + 04's SQLite/migrate + 07's relative URLs
```

Key edges and why:
- **08 first, as a document.** It fixes naming, the type↔table↔GraphQL mapping, the enum
  list, and the JSON-blob history typing so 04, 06, and 07 do not each invent their own and
  drift. It is the authoritative catalog — agree it before writing 04/06. The contradictions
  the critic found in this contract (C1–C9) are resolved in `DECISIONS.md`; 08 now matches 04/06/07.
- **04 and 05 are the additive foundation.** Both can be built with Redis still running
  (03's step 1: "land the new homes, no deletions yet"). They have no dependency on each
  other and can proceed **in parallel**.
- **02 reshapes the poller** the data plane plugs into (de-leasing, single supervisor,
  `LatestStore` accessor, `HistoryFrontier`). 05's producer side and 04's history recorder
  attach to the post-02 `SessionManager`, so 02's structural subtraction should land before
  (or alongside) wiring the bus/store into the poll handler.
- **06 depends on 04 (store), 05 (bus), 02 (poller snapshot/stage).** Resolvers consume the
  narrow `GraphStore`/`Snapshotter`/`Poller`/`EventBus` interfaces those plans satisfy.
- **07 depends on 06's SDL** (codegen reads `api/schema.graphql`) and on 01's single-origin
  fact (relative `/graphql`, cookie auth on HTTP + WS [E-3]).
- **03 is the cut point**, gated on `grep -rn "key_value|go-redis|RedisClient" api/` being
  empty — i.e. *after* 02/04/05/06 have re-homed every caller. Deleting earlier breaks the
  build.
- **01 last** — the consolidated `Dockerfile` assumes `/graphql` exists (06), SQLite +
  migrate-on-boot exist (04), and the SPA uses relative same-origin URLs (07). Its
  CORS/runtime-config deletions are only safe once 07 has moved off `config.ts`.

### Ordered milestones

| M | Name | Plans | Depends on | Parallelizable |
|---|------|-------|------------|----------------|
| **M0** | Schema contract | 08 (doc) | — | author up front; pairs with M1 |
| **M1** | Store foundation | 04 | 08 | parallel with M2 |
| **M2** | Eventbus + poller foundation | 05, 02 | 08 (02 also unblocks the bus wiring) | 05 parallel with M1; 02 structural subtraction can start anytime |
| **M3** | GraphQL backend | 06 | 04, 05, 02 | resolver families (config vs live vs history) can be split |
| **M4** | GraphQL frontend | 07 | 06 (SDL) | per-route views migrate independently once the client + auth/session contexts land |
| **M5** | Redis removal (the cut) | 03 | 02, 04, 05, 06 (all callers re-homed) | no — single gating step |
| **M6** | Deployment consolidation + cleanup | 01 | 06, 04, 07 | docs sweep parallel |

What can run in parallel:
- **M1 (04) and the 05 half of M2** are fully independent additive packages.
- **02's deletions** (lease package, `/v1/nodes`, worker-flag split, Gin) are pure subtractions
  that can land early and independently of the data-plane wiring; only the poll-handler
  re-pointing to bus/store couples to M1/M2.
- **M3 resolver families**: config/auth/settings/sessions resolvers (no eventbus dependency)
  can be built before the live snapshot/`<domain>Changed` subscription resolvers (06 step 2
  starts there).
- **M4 per-route views** migrate route-by-route after the client + auth/session/live
  contexts exist; `/map` (the heaviest, infra-snapshot-query-vs-vehicle-subscription split) goes last.
- **M5 must be a single atomic cut** — re-home everything, then delete the wrapper +
  dependency + compose service in one sequence; no interim "Redis optional" mode.

---

## 5. Risk register

| # | Risk | Source | Likelihood | Impact | Mitigation |
|---|------|--------|-----------|--------|------------|
| R1 | **Caller-count drift blocks the Redis cut** — ~30 `GetCachedState` resolvers across a dozen files; one missed leaves a dangling `key_value` import. | 03 | Med | High | M5 is gated on `grep -rn "key_value" api/` being empty, not a manual checklist. |
| R2 | **WS auth** — subscriptions must authorize off the same-origin cookie on the upgrade request, or they silently fail to authenticate. | 06/07 | Low | High | **RESOLVED by [E-3]:** cookie-only on the upgrade `http.Request`; no `connectionParams.authToken` path; the client (07) sends no `connectionParams`. 06 wires `wsInitFunc` to read the cookie; validate the path early (07 step 3). |
| R3 | **Shutdown ordering / leaked goroutines** — new `Stop(timeout)` must account for every poller goroutine (`publishLoop`, `monitorSessionInfo`, `watchForNewSessions`); `restartPublisherLocked` uses a detached `context.Background()` (pre-existing latent bug). | 02 | Med | Med | `wg.Add/Done` every spawned goroutine; derive the restart ctx from the supervisor ctx — flagged for owner sign-off, not silently changed. |
| R4 | **Auth-token TTL regression** — Redis auto-evicted expired tokens; SQLite does not, so a forgotten lazy `expires_at` check + prune means tokens validate forever. | 03/04 | Low | High | **RESOLVED by [E-7]:** read-time `expires_at > now` check + periodic `RunTokenPrune` (~1h) against the `auth_tokens` superset; the only TTL that needs porting. |
| R5 | **Save-name isolation regression** — dropping the `save_name` dimension reintroduces cross-save bleed (commit `0a12da81`). | 03/04/05/08 | Low | High | **RESOLVED by [E-11]:** `save_name` is a mandatory map-key segment, `history_points` PK column, and eventbus-topic segment across 04/05/08. |
| R6 | **Lost coalescing / backpressure semantics** — SSE used a 1000-buffered subscription + per-type latest-wins coalescing; a naive unbuffered channel changes drop/latency behavior. | 03/05/06 | Med | Med | 05 preserves buffered (256) drop-on-full fan-out; 06 relocates the coalescing (latest-per-`dataType`) into the `<domain>Changed` subscription resolver. The two plans must agree it coalesces, not just drops. |
| R7 | **Snapshot/publish ordering race** — a subscriber reading the snapshot then subscribing could miss an in-between event. | 05 | Low | Med | Resolver subscribes **first**, then forwards the snapshot, then drains live; duplicates are harmless (latest-wins), a gap is impossible. |
| R8 | **Seeder fails → broken map/icons** — `oras pull` fails (registry unreachable, wrong `SD_ASSETS_REF`, private package) so the `/assets` volume is empty/stale. | 01 [E-12] | Med | Med | App `depends_on: seed-assets condition: service_completed_successfully` blocks startup on a failed seed (visible failure, not silent 404s); `.assets-ref` marker makes restarts no-ops; binary warns if `SD_ASSETS_DIR` is empty; assets package kept public for anonymous pull; pin `SD_ASSETS_REF` per release. |
| R9 | **`go:embed` needs a non-empty `dist/`** — a pure-backend `go build` without a prior frontend build fails the embed directive. | 01 | Low | Low | Committed `api/web/dist/.gitkeep` placeholder; the Docker web stage always builds first. |
| R10 | **Subscription shape** — earlier drafts disagreed on a wide sparse `liveState` object vs per-domain fields. | 06/07/08 | Low | Low | **RESOLVED by [D-C]:** per-domain typed `<domain>Changed` subscriptions, no sparse `liveState`, no union. 08 is the authoritative field set; 06/07 conform. |
| R11 | **Document cache vs mutations** — urql document cache won't auto-update the `Sessions` query after `createSession`/`deleteSession`. | 07 | Med | Low | Views `reexecuteQuery` after mutations (or issue with cache-invalidation awareness). |
| R12 | **JSON-blob history can't AVG** — bucketed query can only keep-last, not average heterogeneous JSON. | 04/08 | Low | Low | Keep-last [E-6] matches today's client downsampler exactly; a `json_extract` AVG variant is a later add if a chart needs it. |
| R13 | **Game-time retention is poller-coupled** — `RunHistoryRetention` needs a `HistoryFrontier`; a paused/offline poller stalls pruning (acceptable — game time isn't advancing). | 04/05 | Low | Low | Wire `HistoryFrontier` to the poller's `GameTimeTracker`; documented behavior (and in the upgrade notes per B11). |
| R14 | **`gameTimeId` over the wire** — JS float64 precision + the `Int` vs `Int64` scalar choice. | 06/08 | Low | Low | **RESOLVED by [E-2]:** keep built-in `Int` (game-time seconds stay < 2^53 for decades); the `Int64` scalar is deleted from 06's SDL + `gqlgen.yml`. |
| R15 | **Tombstone race re-emergence** — dropping the delete tombstone assumes session-delete *synchronously* cancels the poll goroutine before returning. | 02/03 | Low | Med | 02's delete joins the cancelled goroutine; FK `ON DELETE CASCADE` makes a late write a no-op. |
| R16 | **Sequencing coupling on 01** — its CORS/runtime-config/Dockerfile deletions assume 06/07/04 already landed; out-of-order execution needs temporary stubs. | 01 | Med | Med | Enforce the milestone order (04 → 06/07 → 01); inline stubs noted in 01 if 01 is attempted earlier. |
| R17 | **sqlc override import cycle** — the typed-ID leaf packages must not import `internal/store`. | 04 | Low | Med | **RESOLVED by [E-5]:** keep `internal/session`/`internal/auth` as dependency-free string aliases; `data_type` stays TEXT (no override). |
| R18 | **`db.go` ownership overlap** — both 03 (strip Redis) and 04 (add SQLite) edit `api/pkg/db/db.go`. | 03/04 | Med | Low | 04 owns the final shape; 03's only invariant is "no `go-redis` symbol remains." Coordinate so edits don't clobber. |
| R19 | **Capacity ceiling assumed, not enforced** — one in-process poller owns all sessions; growth beyond a few dozen sessions saturates the single SQLite writer + poller. | 02/04/08 | Low | Med | **Bounded by [D-B]:** target is ~10 sessions; the back-of-envelope (08 Capacity envelope) shows the write rate + fan-out are comfortable. Sharding is explicitly out of scope; revisit only if scale grows. |

---

## 6. Definition of Done

Each of the user's explicit acceptance criteria, mapped to the delivering plan(s) and a
verifiable check. (These map to the critic's coverage rows DW1–DW10 in `99`; DW6/DW7/DW8/DW10
are now executable because the contracts they ride on are reconciled.)

| # | "Done when" criterion | Delivered by | Verifiable check |
|---|----------------------|--------------|------------------|
| **D1** | **No Redis** (db/stream). | 03 (kill map), 04 (SQLite homes), 05 (channel homes), 01 (drop container) | `grep -rn "go-redis\|key_value\|RedisClient\|notify-keyspace" api/` returns nothing; `docker compose config` has no `redis` service; `cd api && CGO_ENABLED=0 go build ./...` passes with nothing listening on 6379; binary boots, migrates SQLite, serves GraphQL with no connection-refused on 6379. |
| **D2** | **No REST.** | 06 (REST→GraphQL op map), 07 (delete `services/*Api.ts`) | Every row of 06's mapping table is a Query/Mutation/Subscription; `api/routers/api/v1/*.go` and route groups deleted; **Gin is gone** (no `gin.Engine`/`gin.SetMode`, no gin go.mod dep) [E-1]; only non-GraphQL HTTP left is `/healthz` + `/internal/metrics`; no `services/*Api.ts` and no `fetch('/v1/...')` in `dashboard/src`. |
| **D3** | **No WSS** — meaning **no SSE and no home-rolled socket stream**. | 05 (delete `events_sse.go` + `CoalescingQueue`), 06 (subscriptions), 07 (delete `EventSource`) | `events_sse.go` deleted; no `gin.Stream`/`EventSource` anywhere; the **only** websocket is the gqlgen `transport.Websocket` (graphql-ws) — the *sanctioned* transport, not a home-built one; subscription tests assert delivery + teardown. (Confirmed scope: "No WSS" means no home-rolled stream, not "no websockets at all" — graphql-ws is an unavoidable, sanctioned WS upgrade.) |
| **D4** | **No home-built distributed polling solution.** | 02 (delete lease/worker-flag/node identity/`/v1/nodes`) | `api/service/lease/` deleted; no `SD_NODE_NAME`/`NodeName`; no `-api`/`-publisher`/`-settings-listener` flags; `/v1/nodes` + cluster view gone; `go run main.go` (no flags) runs API + poller + settings in one process and polls every session. Justified at ~10 sessions [D-B]. |
| **D5** | **sqlc + migration files are used.** | 04 (sqlc.yaml + golang-migrate iofs), 08 (table/column/override contract) | `api/sqlc.yaml` + `queries/*.sql` generate `internal/store/sqlite/`; `make sqlc-check` shows no drift; numbered `00N_*.{up,down}.sql` run via iofs + `migrate.NewWithInstance` on boot; `TestMigrateUp/UpDown/Idempotent` pass; tables are `sessions`/`settings`/`auth_password`/`auth_tokens`/`history_points` [E-6/E-7]. |
| **D6** | **GraphQL replaces API polling entirely — history.** | 04 (`history_points` + raw/bucketed queries), 06 (five `<domain>History` resolvers + `historySaves`), 08 (typed history catalog) | History reads come only from the five typed `<domain>History` GraphQL queries (returning `[<Type>HistoryPoint!]!`) backed by SQLite [D-C/E-6]; the `since` cursor + `maxPoints` server-side keep-last bucketing work; **no** `HistoryChunk`, **no** opaque `data` on the wire; no Redis ZSET, no REST history route. |
| **D7** | **GraphQL replaces API polling entirely — live streams.** | 05 (eventbus + snapshot), 06 (per-domain `<domain>Changed` + `connectivityChanged` + `sessionUpdated`), 02 (poller producer) | Live state streams through graphql-ws **per-domain typed** subscriptions bridged from the in-process `ChannelBus` [D-C]; the initial paint reads the poller's in-memory `LatestStore` via typed snapshot queries; offline/online arrives as `connectivityChanged`; the 2s SSE-ref tick is gone; **no** `liveState` sparse object. |
| **D8** | **UI data fetching is GraphQL-native.** | 07 (urql + graphql-ws + per-page queries), 08 (retire tygo) | Every view consumes typed `graphql()` documents via `useQuery`/`useMutation`/`useSubscription`; `apiTypes.ts`/tygo deleted [E-8]; `make generate` (gqlgen → sqlc → bun codegen) produces `src/gql/`; zero `@/apiTypes` imports; the only transport is the urql `Client` against relative `/graphql`. |
| **D9** | **One container (deployment is no longer "quite crazy").** | 01 (embed SPA; ORAS-seeded assets volume; single app image) [E-12] | One `Dockerfile` builds one `CGO_ENABLED=0` app image (tens of MB, not GB); SPA `go:embed`-ed; the 2.6 GB tiles ship as an ORAS artifact pulled by a one-shot seeder into an `/assets` volume the binary serves via stdlib `FileServer` [E-12]; `dashboard/Dockerfile`, `dashboard/nginx.conf`, `asset-server/` deleted; `compose.yml` is one `seed-assets` one-shot + one long-running `app`; CI is one `build` job (+ tiny seed image, + manual ORAS push); no `GIN_MODE`. |
| **D10** | **Single same-origin (the simplification payoff).** | 01 (drop CORS + runtime-config), 07 (relative `/graphql`) | SPA + assets + `/graphql` share one origin/port; `corsAllowAll()`/`gin-contrib/cors`, `runtime-config.js`, `docker-entrypoint.sh`, `dashboard/src/config.ts` deleted; cookie auth works on both HTTP and the WS upgrade [E-3]; the only origin check is the WS `Upgrader.CheckOrigin` sourced from `config.ExternalURL` [E-4]. |

**Overall DoD:** all ten rows verified, `make lint` + `make build` green with no Redis
reachable, `make generate` (gqlgen → sqlc → bun codegen) clean, the recommended light test
gate green (Go unit tests for migrations/eventbus/subscription teardown + a minimal e2e smoke:
boot → one typed query + one mutation + one `<domain>Changed` subscription round-trip + a CI
migration up/down check) [E-10], and a manual two-session run that confirms both sessions poll,
transition offline/online over `connectivityChanged`, persist + serve history, and shut down
draining cleanly within the timeout. Operators are told about the **auth clean wipe** [D-A] in
the upgrade notes. (Per project rules, only the user starts services.)
