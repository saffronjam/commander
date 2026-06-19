# DECISIONS — The Great Simplification (locked decision log)

> The durable record of **why** the refactor plan is shaped the way it is. The planning
> workflow's critic (`99-open-questions-and-gaps.md`) found 9 cross-document contradictions
> (C1–C9) and a set of gaps (B1–B13). The user then **locked** the decisions below. This file
> is the single place that captures each choice, its rationale, the contradiction/gap it
> resolves, and the docs it touches. When a sub-plan and this log disagree, **this log wins** —
> raise it rather than diverging silently.
>
> Two tiers:
> - **Locked user decisions (D-A … D-D)** — product/operator-facing choices the user signed off on.
> - **Engineering resolutions (E-1 … E-12)** — implementation choices that match the
>   `saffron-hive` reference and make 00–08 internally consistent.
>
> Consistency rule (used everywhere): tables `history_points` / `auth_password` / `auth_tokens`
> / `sessions` / `settings`; GraphQL `<domain>History` (queries), `<domain>Changed`
> (subscriptions), `<Type>HistoryPoint` (point types); leaf packages `internal/session.ID` +
> `internal/auth.Token`. Doc **08** is the authoritative type + field catalog; the others
> conform to it.

---

## Locked user decisions

### D-A — Auth cutover = CLEAN WIPE

- **Choice.** On first SQLite boot the DB is empty; auth re-bootstraps to
  `SD_BOOTSTRAP_PASSWORD` (default `"change-me"`) with `is_default = 1`. There is **no**
  Redis→SQLite migration of the password or of access tokens. The operator must re-set their
  password after upgrade; all clients must log in again.
- **Rationale.** Migrating a hashed password and live tokens out of Redis adds a one-shot import
  path for data with a days-long TTL; a clean cutover is simpler and the operator action is a
  one-time, well-documented step.
- **Resolves.** Critic **B4** / decision **D.1**. This is an *explicit, user-approved* clean
  cutover — not an accidental "no backward compat" footgun, and it does not violate the
  "never silently weaken" rule because the user signed off and it is surfaced as a release note.
- **Docs touched.** 08 (RELEASE/UPGRADE NOTE + auth table section), 04 (no migration of auth
  data), 01/02/06 (surface the upgrade note in deployment/upgrade docs).

### D-B — Capacity = up to ~10 concurrent game sessions

- **Choice.** Target scale is **3–10 concurrent sessions**. One in-process poller, no sharding.
- **Rationale.** ~10 sessions × ~12 live data types on the fast tier (every few seconds) + ~5
  history writes/session is a bounded SQLite write rate under WAL single-writer; eventbus
  fan-out to a handful of subscribers per session is comfortable. Beyond a few dozen sessions the
  single-writer/single-poller model would need revisiting (sharded pollers, a write queue) —
  **explicitly out of scope**.
- **Resolves.** Critic **B6** (single-poller load was asserted, never analyzed). Justifies the
  removal of the distributed-lease subsystem at this scale.
- **Docs touched.** 08 (Capacity envelope), 00 (executive summary + risk note), 02 (single
  supervisor justification).

### D-C — GraphQL schema = FULLY TYPED PER-TYPE (no opaque payload)

- **Choice.** No `JSON`/`Any`/`Map` scalar ever crosses the GraphQL boundary. Resolvers decode
  stored JSON into typed structs server-side. Concretely:
  - **History:** one query **per data type**, returning concrete typed point arrays. Naming
    `<domain>History`; signature
    `<domain>History(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [<Type>HistoryPoint!]!`.
    Anchor set: `circuitsHistory`, `factoryStatsHistory`, `prodStatsHistory`,
    `generatorStatsHistory`, `sinkStatsHistory` (the complete retained set per
    `research/history-persistence.md` §1 — exactly five). `historySaves(sessionId: ID!): [String!]!`
    is kept. Each `<Type>HistoryPoint = { gameTimeId: Int!, <typed fields of that domain> }`.
  - **Live:** per-domain **subscriptions** with typed payloads, naming `<domain>Changed` (e.g.
    `circuitsChanged: [Circuit!]!`, `factoryStatsChanged: FactoryStats!`, `playersChanged`,
    `dronesChanged`, `trainsChanged`, `satisfactoryApiStatusChanged`,
    `connectivityChanged(sessionId): ConnectivityStatus!`, `sessionUpdated: Session!`). The full
    set is enumerated in 08's Subscription block, derived from the SSE event inventory.
  - **Snapshot (point-in-time) queries** read the poller's in-memory `LatestStore` and are typed,
    mirroring the live domains (`state`-equivalent fanned out to `circuits`, `players`, `drones`,
    `trains`, etc.).
- **Forbidden.** The single `liveState` sparse object; the `HistoryChunk` envelope and the opaque
  `data` field; any `JSON`/`Any`/`Map`/`Int64` scalar on the wire; GraphQL `union`/`__typename`
  narrowing for history/live.
- **Rationale.** Full typing makes `@graphql-codegen/client-preset` produce concrete TS types per
  field with no client-side decoding/narrowing. The cost — one query/subscription per data type —
  is accepted deliberately.
- **Resolves.** **C2** (one history query vs five), **C3** (subscription shape), **C9** (history
  point field naming). Doc **08** is the authoritative catalog the others conform to.
- **Docs touched.** 08 (catalog — authoritative), 06 (SDL + resolvers), 07 (per-page documents),
  04 (the JSON blob stays *only* in SQLite, decoded by resolvers).

### D-D — Mock mode = DROPPED

- **Choice.** Mock mode is removed from the plans entirely. No mock poller is built.
- **Rationale.** Verified: there is **no** `Config.Mock` field, **no** `service/mock_client/`
  directory, and **no** `mock:` key in config. The only references are stale lines in root
  `CLAUDE.md` ("Set `mock: true`") and `api/CLAUDE.md` (`service/mock_client`, `Config.Mock`) —
  they describe code that does not exist. Building a mock poller was never in scope.
- **Resolves.** Critic **B1** (mock mode assumed-present but absent from the code).
- **Docs touched.** 08 (no-mock note), 06 (drop the "mock poller emits canned models" path),
  and the CLAUDE.md doc sweep deletes the stale references (root `CLAUDE.md` + `api/CLAUDE.md`).

---

## Engineering resolutions

### E-1 — Router = stdlib `net/http` ServeMux + the gqlgen handler (Gin removed entirely)

- **Choice.** Drop Gin completely.
  - **01:** `RegisterStatic` is a stdlib `http.Handler` — `http.FileServer` over the
    `go:embed`'d `dist` + a `StaticFS`-equivalent for the mounted assets volume + an
    `index.html` SPA fallback for unknown non-asset, non-`/graphql` paths. No `gin.Engine`,
    `r.StaticFS`, `r.NoRoute`, `gin.Dir`. Drop `GIN_MODE` from the Dockerfile.
  - **02:** `app.go` builds an `*http.Server` around the stdlib mux; no `gin.SetMode` /
    `routers.NewRouter()` Gin calls.
  - **06:** `mux.Handle("/graphql", gqlgenHandler)` (POST/GET + Websocket transport); plus
    `/healthz` + `/internal/metrics`; SPA fallback registered last.
- **Rationale.** Matches the `saffron-hive` reference; with REST gone the only HTTP surfaces are
  `/graphql`, `/healthz`, `/internal/metrics`, and static — stdlib mux covers all of them.
- **Resolves.** **C5** (Gin retained in 01/02 vs removed in 00/06), **B10** (SPA deep-link
  handler existed in two contradictory forms).
- **Docs touched.** 01, 02, 06, 00 (component inventory + Dockerfile/`GIN_MODE`).

### E-2 — Integers = keep built-in GraphQL `Int`; delete the `Int64` scalar

- **Choice.** `gameTimeId`, `Hub.shipReturnTime`, and `since` stay GraphQL `Int`. Delete the
  `Int64` scalar from 06's SDL and `gqlgen.yml`.
- **Rationale.** Game-time seconds stay under 2^53 for decades; JS `number` (float64) represents
  them exactly. No custom scalar needed.
- **Resolves.** **C4** (Int64 declared+used in 06 vs forbidden in 08), risk **R14**.
- **Docs touched.** 06 (delete scalar + binding), 08 (Int is final), 00 (mark R14 resolved).

### E-3 — WS auth = same-origin cookie only

- **Choice.** The gqlgen `wsInitFunc` reads the auth cookie off the upgrade `http.Request`. There
  is **no** `connectionParams.authToken` path; the client (07) sends **no** `connectionParams`.
- **Rationale.** Same-origin browsers attach the HTTP-only cookie to the WS upgrade request, so
  cookie-only is sufficient and avoids handing the token to JS.
- **Resolves.** **B3** (cookie-only vs cookie+token contradiction), risk **R2**.
- **Docs touched.** 06 (`wsInitFunc` reads cookie off upgrade request), 07 (client sends no
  `connectionParams`), 00 (mark R2 resolved).

### E-4 — CORS = removed entirely (same-origin)

- **Choice.** Delete all CORS machinery (01). The only origin check that remains is the WS
  `Upgrader.CheckOrigin`, validated against `config.ExternalURL` (same-origin) — **not** a
  non-existent `AllowedOrigins` field. 06 sources `CheckOrigin` from `ExternalURL`.
- **Rationale.** SPA, assets, and `/graphql` share one origin/port after consolidation, so
  cross-origin support is dead weight. The WS upgrader still needs a `CheckOrigin` (gorilla
  rejects cross-origin by default) but keyed to the single external URL.
- **Resolves.** **C6** (CORS deleted in 01/07 but still referenced via `AllowedOrigins` in 06).
- **Docs touched.** 01 (delete CORS), 06 (`CheckOrigin` from `ExternalURL`), 07 (assumes no CORS).

### E-5 — sqlc overrides = leaf packages only; `data_type` stays TEXT

- **Choice.** Override only `sessions.id` / `history_points.session_id` → `internal/session.ID`
  and `auth_tokens.token` → `internal/auth.Token` — both dependency-free `type X string` aliases
  in leaf packages. Do **not** override `data_type` to a typed enum at the sqlc layer; store the
  discriminator as `TEXT` and map it to the GraphQL `HistoryDataType` enum in the resolver. Drop
  08's old `models.*` override table.
- **Rationale.** Leaf packages avoid the import cycle that a `models.*` override would create
  (the generated store would import `models`, which may import back). Keeping `data_type` as TEXT
  keeps the store dumb and puts the enum mapping where the typing matters (the resolver).
- **Resolves.** **C7** (override type homes: leaf packages vs `models.*`), risk **R17**.
- **Docs touched.** 04 (`sqlc.yaml` + leaf packages), 08 (override table — authoritative).

### E-6 — History storage table = `history_points`

- **Choice.** Table `history_points` (not `history_samples`). Composite PK
  `(session_id, save_name, data_type, game_time_id)`; a JSON `data TEXT` column holds the per-type
  payload; one range index. Queries `UpsertHistoryPoint` (upsert on same game-time),
  `QueryHistoryRaw`, `QueryHistoryBucketed` (keep-last bucketing). **No** surrogate `id`, **no**
  `recorded_at`. The typed per-type GraphQL history queries (D-C) are served by resolvers that
  `json.Unmarshal` the `data` column per `data_type` into the typed point structs.
- **Rationale.** The composite PK replicates the Redis "member = game-time, overwrite on same
  game-time" dedup; game-time is the only time axis (retention is game-time based), so a wall-clock
  column is dead weight. Keep-last bucketing matches today's client-side downsampler exactly
  (averaging heterogeneous JSON is impossible).
- **Resolves.** **C1** (`history_points` vs `history_samples`, composite PK vs surrogate id).
- **Docs touched.** 04 (migrations + queries), 08 (SQLite schema — authoritative), 00 (data flow).

### E-7 — Auth tables = `auth_password` + `auth_tokens` (superset columns)

- **Choice.** `auth_password` (single row: `id PK CHECK(id=1)`, `hash`, `is_default`,
  `updated_at`) + `auth_tokens` (`token PK`, `created_at`, `last_used`, `expires_at`,
  `client_ip`). Lazy `expires_at > now` check on read + a periodic `RunTokenPrune` (~1 h). Drop
  the `auth_credentials` / `used_default` naming and the minimal-token-column variant.
- **Rationale.** SQLite does not auto-evict like Redis TTL, so the read-time check + prune are
  required (risk R4). `last_used` supports sliding expiration; `client_ip` gives the login
  rate-limiter context. The superset is exactly what the queries (`RefreshToken`/`InsertToken`/
  `GetValidToken`) read and write.
- **Resolves.** **C8** (table name/columns), **B5** (column set the queries need), risk **R4**.
- **Docs touched.** 04 (queries + prune ticker), 08 (auth tables — authoritative).

### E-8 — `make generate` recipe = one canonical pipeline, owned by doc 08

- **Choice.** A single `make generate` with fixed ordering:
  1. `cd api && go tool gqlgen generate` — emits resolver stubs + the `schema.graphql` the
     frontend codegen consumes.
  2. `cd api && sqlc generate` — regenerates `internal/store/sqlite/*` from queries + migrations.
  3. `cd dashboard && bun run codegen` — `@graphql-codegen/client-preset` reads gqlgen's
     `schema.graphql`.
  tygo, `api/export/tygo.yml`, and `dashboard/src/apiTypes.ts` are **deleted**. The CLAUDE.md rule
  "run `make generate` after Go model changes" is restated to mean: run this pipeline after any
  change to `api/schema.graphql` or to `internal/store/queries|migrations/*.sql`.
- **Rationale.** Step (1) before (3) because the frontend codegen consumes gqlgen's SDL; (2) is
  independent but folded in so one command re-syncs every generated surface.
- **Resolves.** **B2** (`make generate` described three incompatible ways).
- **Docs touched.** 08 (recipe — owner), 01/02/04/07 (point at 08's recipe), CLAUDE.md sweep.

### E-9 — History live-append = no dedicated subscription

- **Choice.** No `historyAppended` subscription. Live points arrive via the per-domain
  `<domain>Changed` subscriptions (whose payload already corresponds to the latest `gameTimeId`);
  charts stitch live points by `gameTimeId`. On WS reconnect the client re-runs each
  `<domain>History` query with `since=<latest gameTimeId>` **and** re-snapshots live state via the
  snapshot queries.
- **Rationale.** The five history-enabled domains already have a `<domain>Changed` subscription;
  a separate history-append stream would duplicate it. The reconnect gap is closed by the
  `since`-cursor re-query + snapshot re-execute.
- **Resolves.** **B7** (reconnect/replay seam under-specified; history-append mechanism was
  "decided in 99").
- **Docs touched.** 08 (history/subscription notes), 06 (no extra subscription), 07 (reconnect
  re-query + re-snapshot).

### E-10 — Tests = keep planned Go unit tests + add a minimal e2e smoke (recommended light scope)

- **Choice.** Keep the planned Go unit tests (migrations up/down, eventbus fan-out/teardown,
  subscription teardown) and **add** a minimal automated e2e smoke (boot → one typed query + one
  mutation + one subscription round-trip) plus a CI migration up/down check. This is the
  RECOMMENDED light scope; the manual two-session run remains the functional gate.
- **Rationale.** The repo has ~zero tests today; for a refactor this large a tiny automated
  safety net is cheap insurance without mandating heavy testing.
- **Resolves.** **B8** (no automated-test/e2e strategy survives the rewrite).
- **Docs touched.** 08 (Tests section), 04/05/06 (unit tests), 00 (DoD note).

### E-11 — Save-name isolation = `save_name` is a mandatory key segment everywhere

- **Choice.** `save_name` stays a mandatory key segment in the in-memory `LatestStore` key, in the
  `history_points` composite PK, and in the per-`(session, save, dataType)` eventbus topic.
- **Rationale.** Preserves commit `0a12da81` ("include save name in state cache keys for proper
  data isolation"); dropping the dimension reintroduces cross-save bleed.
- **Resolves.** Risk **R5**.
- **Docs touched.** 04 (PK), 05 (topic), 08 (catalog notes), 00 (risk register).

### E-12 — Asset delivery = ORAS artifact + one-shot seeder into a volume

- **Choice.** Ship the ~2.6 GB map tiles/icons as a **versioned OCI artifact** in the registry
  (`ghcr.io/<owner>/satisfactory-dashboard-assets:<tiles-version>`), pushed with `oras` by a
  manual, rarely-run CI job (`publish-assets`) / `make assets-publish`. A small published
  **one-shot seeder** image (`…-seed`: alpine + `oras` + extract script; also usable as a k8s
  `initContainer`) `oras pull`s the artifact, extracts the tarballs into a shared `assets` volume
  in the `1763022054` cache-dir layout, and writes a version marker so it is a no-op on restart.
  The app serves that volume read-only via stdlib `http.FileServer`; the app image carries no
  tiles. `SD_ASSETS_REF` (seeder-only env, not Go config) pins the version; the app's
  `depends_on … service_completed_successfully` (compose) / initContainer (k8s) gates startup on
  a successful seed. Tiles volume must be persistent (named volume / PVC, not `emptyDir`).
- **Rationale.** Keeps the app image at tens of MB and frequently rebuildable while the tiles are
  pushed rarely; operators deploy by **pulling images only** — no git-lfs, no local tarballs, no
  hand-populated host directory; same registry + auth as the app image (no separate object store).
  Restores the "just pull it" property of the old asset-server without a running asset server or a
  multi-GB app image.
- **Resolves.** The operator-asset-sourcing gap (the volume-seed approach would have required
  operators to source 2.6 GB out-of-band); reframes residual **B9** (verify the seed extraction
  layout vs the SPA's tile paths).
- **Docs touched.** 01 (compose `seed-assets` + `deploy/Dockerfile.seed` + `deploy/seed-assets.sh`,
  CI `publish-assets`, `make assets-publish`), 00 (after-architecture + inventory + risk).

---

## Cross-reference: critic items → resolution

| Critic item | Resolved by | Critic item | Resolved by |
|---|---|---|---|
| C1 history table | E-6 | B1 mock mode | D-D |
| C2 history query shape | D-C | B2 `make generate` | E-8 |
| C3 subscription shape | D-C | B3 WS auth | E-3 |
| C4 Int64 scalar | E-2 | B4 auth wipe | D-A |
| C5 router framework | E-1 | B5 token columns | E-7 |
| C6 CORS leak | E-4 | B6 capacity | D-B |
| C7 sqlc overrides | E-5 | B7 reconnect/replay | E-9 |
| C8 auth tables | E-7 | B8 tests | E-10 |
| C9 history point fields | D-C | B10 SPA fallback host | E-1 |
| R2 WS auth (risk) | E-3 | R4 token TTL (risk) | E-7 |
| R5 save-name (risk) | E-11 | R14 Int64 (risk) | E-2 |
| R17 sqlc cycle (risk) | E-5 | Asset delivery / operator sourcing | E-12 |

Residual minor items still open after these decisions are tracked in
`99-open-questions-and-gaps.md` Section "Residual open items" (B9 asset-path verify, B11
reseed footgun, B12 regression spot-checks, B13 rate-limiter wiring).
