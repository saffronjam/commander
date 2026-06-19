# 06 — GraphQL Backend (gqlgen) replacing ALL REST + SSE

## Context

Today the backend (`api/`) exposes ~39 Gin routes plus one SSE stream
(`GET /v1/sessions/:id/events`). Every data GET reads a Redis-cached projection of one
big `models.State` object; the single SSE stream multiplexes ~26 live event types over a
Redis pub/sub channel `satisfactory_events:{sessionID}`; history is read from Redis
sorted-sets via two routes; auth is a cookie-validated token in Redis; sessions/settings
are stored in Redis. The full inventory is in `research/rest-surface.md`,
`research/live-dataflow.md`, `research/domain-models.md`, `research/history-persistence.md`.

This document specifies the gqlgen GraphQL server that replaces that entire surface. It
depends on, and must be read alongside:

- **04 — sqlite-sqlc-store**: provides the `store.DB` (sqlc-generated) that the
  resolvers read/write for history, sessions, settings, and auth. Resolvers consume a
  narrow `GraphStore` interface satisfied by `*store.DB`.
- **05 — eventbus-channels**: provides the in-process `eventbus.EventBus` (topic-filtered,
  drop-on-full fan-out) that replaces the SSE multiplexer + `CoalescingQueue`.
  Subscription resolvers bridge that bus to graphql-ws.
- **02 — single-process-poller**: provides the in-process `poller` (one goroutine-group
  per session, lease/NodeName removed). The poller is the producer on the eventbus and
  owns the in-memory `LatestStore` ("latest value per `(session, save, dataType)`") the
  snapshot queries read.
- **08 — data-model-and-schema** (THE AUTHORITATIVE CONTRACT): owns the per-type GraphQL
  type ⇄ Go model ⇄ sqlc table catalog, the enum table, the table/column set, and the
  `make generate` pipeline. **This doc conforms to 08 exactly** for every object type,
  enum, query, subscription, and mutation field. Where 08 enumerates a type or field, 08
  wins; this doc owns only the *server wiring* (router, auth, errors, the eventbus bridge,
  the REST/SSE → GraphQL op map). The schema reproduced below is a transcription of 08's
  catalog so the two read as one — if they ever diverge, 08 is correct.

The reference implementation is saffron-hive (`research/ref-graphql.md`): gqlgen v0.17.x,
gorilla/websocket, a single SDL file, `autobind: []` (GraphQL types are their own shape,
mapped from domain structs by hand), an `@auth` directive, an `ErrorPresenter`, HTTP auth
middleware + a websocket `InitFunc`, and the one-goroutine-per-subscription bridge. We copy
that recipe and translate the client side (plan 07) to urql React + graphql-ws.

## Settled design decisions

1. **gqlgen, single SDL file, `autobind: []`.** SDL lives at `api/schema.graphql` (the
   path the frontend `client-preset` codegen reads — see 08's `make generate` recipe).
   Generated code lands under `api/internal/graph`. GraphQL types are generated models in
   `internal/graph/model`; resolvers map `models.*` domain structs → generated models by
   hand (helpers in `internal/graph/mappers.go`). No autobinding of the internal structs —
   this is the clean-break stance (no REST DTOs, no tygo).

2. **Fully-typed per-type, no opaque payload, no sparse aggregate (decision D-C).** There
   is **no single `liveState`/`State` sparse object** and **no `HistoryChunk`/opaque
   `data`** on the wire. Each domain has its own typed snapshot query, its own typed
   `<domain>Changed` subscription, and (for the five history-enabled domains) its own typed
   `<domain>History` query returning concrete `[<Type>HistoryPoint!]!`. Resolvers decode
   the stored `history_points.data` JSON into typed structs server-side. The FORBIDDEN
   constructs (sparse `liveState`, `HistoryChunk`, opaque `data`, any `JSON`/`Any`/`Map`
   scalar, history union/interface) are listed in 08 and must not reappear here. (Resolves
   C2, C3, C9.)

3. **Per-domain typed subscriptions, naming `<domain>Changed` (decision D-C, E-9).** The
   SSE multiplexer (one channel, ~26 event types, `CoalescingQueue`) becomes one typed
   subscription field per live domain, each parameterized by `sessionId: ID!` and filtered
   server-side. No GraphQL union over the payloads, no `domains: [LiveDomain!]` filter
   argument, no `LiveDomain` enum. A page opens exactly the `<domain>Changed`
   subscriptions it renders (urql multiplexes them over one websocket). There is no
   dedicated `historyAppended` subscription: live history points arrive on the five
   `<domain>Changed` subscriptions (whose payload already corresponds to the latest
   `gameTimeId`) and the client stitches them by `gameTimeId` (decision E-9).

4. **Built-in `Int`, no `Int64` scalar (decision E-2).** `gameTimeId`, the `since` cursor,
   and `Hub.shipReturnTime` are GraphQL built-in `Int`. Game-time seconds stay well under
   2^53 for decades. There is **no `Int64` scalar** in the SDL or `gqlgen.yml`. (Resolves
   C4, R14.)

5. **`@auth` directive replaces `RequireAuth` middleware; default-deny.** Every
   Query/Mutation/Subscription field carries `@auth` except the explicitly public ones
   (`login`, `authStatus`). The directive reads the caller from context; HTTP middleware
   (for POST/GET) and the websocket `InitFunc` (for subscriptions) both inject the caller —
   the directive enforces uniformly. The `RequireSessionReady` 425 gate is **not** a
   middleware; it becomes the `Session.stage` field (and the `connectivityChanged.stage`
   field) that clients read before opening live queries (decision 7).

6. **WS auth = same-origin cookie only (decision E-3).** `login` sets the `sd_access_token`
   HTTP-only cookie on the GraphQL POST response; `logout`/`changePassword` clear/rotate it.
   The graphql-ws transport authenticates from that **same cookie**: the `wsInitFunc` reads
   the auth cookie off the upgrade `http.Request`. There is **no `connectionParams.authToken`
   path**; the client (plan 07) sends **no `connectionParams`**. Same-origin deployment
   (single container, plan 01) makes the cookie reliable on the WS upgrade. (Resolves B3,
   R2.)

7. **Session readiness is a schema field, not an error.** `Session.stage: SessionStage!`
   (`INIT | READY`) is resolver-computed from which `RequiredEventTypes` the poller has
   observed for that session. Live queries/subscriptions return empty/partial data while
   `INIT`; the frontend gates on `stage` (and on `connectivityChanged`).

8. **History `since` cursor preserved; server-side keep-last bucketing (decision E-6).**
   The `gameTimeId` incremental cursor (`since: Int`) is kept verbatim. The per-type history
   queries take `maxPoints: Int` which triggers server-side **keep-last bucketing** (08 §
   "Per-type history queries"; NOT `AVG` — the JSON payloads are heterogeneous structs).
   This replaces today's client-side `downsampleDataPoints`. New history points also arrive
   on the matching `<domain>Changed` subscription, so the frontend stitches subscription
   deltas onto the queried window by `gameTimeId` (decision E-9).

9. **No mock mode (decision D-D).** `Config.Mock` never existed in code; there is no mock
   poller and no mock store. The graph package has no mock awareness. The stale
   mock-mode references in root `CLAUDE.md` ("Set `mock: true`") and `api/CLAUDE.md`
   (`service/mock_client`, `Config.Mock`) are deleted (the `make generate` wording edit in
   08 carries the same removal). (Resolves B1.)

10. **No CORS; single origin (decision E-4).** The frontend and API are served from the
    same origin (single container, plan 01), so all CORS machinery is removed (plan 01
    deletes it). The only origin check that remains is the WS `Upgrader.CheckOrigin`,
    validated against `config.ExternalURL` (same-origin). There is **no `AllowedOrigins`
    config field**. (Resolves C6.)

11. **`/healthz` and `/internal/metrics` stay plain HTTP.** Everything else is GraphQL.
    `/v2/docs` (Swagger) is deleted; GraphQL introspection + the gqlgen Playground (dev
    only) replace it.

12. **The router is stdlib `net/http` `ServeMux`; Gin is removed entirely (decision E-1).**
    `app.go` (plan 02) builds an `*http.Server` around the mux; there is no `gin.Engine`,
    `gin.SetMode`, `routers.NewRouter()`, or `GIN_MODE`. The gqlgen handler is mounted at
    `/graphql`; the SPA fallback is registered last (see "Server wiring"). (Resolves C5,
    B10.)

---

## gqlgen.yml

`api/gqlgen.yml` (copied from saffron-hive, paths adapted):

```yaml
schema:
  - schema.graphql

exec:
  filename: internal/graph/generated.go
  package: graph

model:
  filename: internal/graph/model/models_gen.go
  package: model

resolver:
  layout: follow-schema
  dir: internal/graph
  package: graph
  filename_template: "{name}.resolvers.go"

autobind: []

nullable_input_omittable: true

omit_complexity: false

models:
  DateTime:
    model:
      - github.com/99designs/gqlgen/graphql.Time
```

Notes:
- **No `Int64` entry** (decision E-2): `gameTimeId` / `since` / `shipReturnTime` use the
  built-in `Int`. The old draft's `Int64: graphql.Int64` block is deleted.
- The only custom scalar is `DateTime → graphql.Time` (the single `time.Time` reaching the
  client is `Session.createdAt`; 08 § "Naming conventions").
- The 24 SDL enums (08 § "Enum mapping") whose values are human strings with spaces/hyphens
  bind their SCREAMING_SNAKE GraphQL names to the existing Go string constants via the
  `models:` enum-binding block; 08 owns the exact name↔value table. The binding lives in
  `gqlgen.yml` `models:` entries (and/or `internal/graph/enums.go` for any hand-written
  `MarshalGQL`/`UnmarshalGQL`).
- `gqlgen` is wired as a go.mod `tool` directive (`tool github.com/99designs/gqlgen`).
  Codegen runs as **step (1) of the single `make generate` pipeline owned by 08**
  (decision E-8): `cd api && go tool gqlgen generate` → `cd api && sqlc generate` →
  `cd dashboard && bun run codegen`. The deleted tygo target (`api/export/tygo.yml`,
  `dashboard/src/apiTypes.ts`) is gone; 08 owns that retirement and the CLAUDE.md rewording.

---

## SDL location and shared declarations

Single file `api/schema.graphql`. Header:

```graphql
scalar DateTime

directive @auth on FIELD_DEFINITION

type Query
type Mutation
type Subscription
```

There is **no `scalar Int64`** (decision E-2) and **no opaque scalar of any kind** (decision
D-C). Every root field below is tagged `@auth` unless noted `# public`.

08 § "The fully-typed GraphQL catalog" is the authoritative declaration of every object
type, enum, input, and payload. This doc reproduces the **root operations** (Query /
Mutation / Subscription) verbatim from 08 and does not re-declare object-type fields here.

---

## The schema (root operations — transcribed from 08)

### Query — typed snapshots + per-type history (no `state`, no `HistoryChunk`)

```graphql
type Query {
  # sessions / config
  sessions: [Session!]! @auth
  session(id: ID!): Session @auth
  previewSession(address: String!): SessionInfo! @auth
  settings: Settings! @auth
  authStatus: AuthStatus!                     # public
  clientIp: String! @auth

  # live snapshots (mirror the <domain>Changed subscriptions; read the poller LatestStore)
  satisfactoryApiStatus(sessionId: ID!): SatisfactoryApiStatus! @auth
  connectivity(sessionId: ID!): ConnectivityStatus! @auth
  factoryStats(sessionId: ID!): FactoryStats! @auth
  prodStats(sessionId: ID!): ProdStats! @auth
  generatorStats(sessionId: ID!): GeneratorStats! @auth
  sinkStats(sessionId: ID!): SinkStats! @auth
  circuits(sessionId: ID!): [Circuit!]! @auth
  players(sessionId: ID!): [Player!]! @auth
  drones(sessionId: ID!): [Drone!]! @auth
  droneStations(sessionId: ID!): [DroneStation!]! @auth
  trains(sessionId: ID!): [Train!]! @auth
  trainStations(sessionId: ID!): [TrainStation!]! @auth
  trucks(sessionId: ID!): [Truck!]! @auth
  truckStations(sessionId: ID!): [TruckStation!]! @auth
  tractors(sessionId: ID!): [Tractor!]! @auth
  explorers(sessionId: ID!): [Explorer!]! @auth
  vehiclePaths(sessionId: ID!): [VehiclePath!]! @auth
  machines(sessionId: ID!): [Machine!]! @auth
  storages(sessionId: ID!): [Storage!]! @auth
  belts(sessionId: ID!): [Belt!]! @auth
  splitterMergers(sessionId: ID!): [SplitterMerger!]! @auth
  pipes(sessionId: ID!): [Pipe!]! @auth
  pipeJunctions(sessionId: ID!): [PipeJunction!]! @auth
  cables(sessionId: ID!): [Cable!]! @auth
  trainRails(sessionId: ID!): [TrainRail!]! @auth
  hypertubes(sessionId: ID!): [Hypertube!]! @auth
  hypertubeEntrances(sessionId: ID!): [HypertubeEntrance!]! @auth
  spaceElevator(sessionId: ID!): SpaceElevator @auth
  hub(sessionId: ID!): Hub @auth
  radarTowers(sessionId: ID!): [RadarTower!]! @auth
  resourceNodes(sessionId: ID!): [ResourceNode!]! @auth
  schematics(sessionId: ID!): [Schematic!]! @auth

  # history — one query PER data type, concrete typed point arrays (decision D-C)
  historySaves(sessionId: ID!): [String!]! @auth
  circuitsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [CircuitsHistoryPoint!]! @auth
  factoryStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [FactoryStatsHistoryPoint!]! @auth
  prodStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [ProdStatsHistoryPoint!]! @auth
  generatorStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [GeneratorStatsHistoryPoint!]! @auth
  sinkStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [SinkStatsHistoryPoint!]! @auth
}
```

Notes:

- **No `state(sessionId): State` query and no `State` GraphQL type.** Every domain has its
  own typed snapshot query reading the poller's in-memory `LatestStore`; the previous
  `state{...}` projection and the slow-poll/static convenience fields collapse into this flat
  per-domain list. A per-page query selects the snapshot queries it needs in one document.
- Snapshot queries are resolver-driven off the poller's `LatestStore` (no DB round-trip for
  live data). They take `sessionId: ID!` only; the live tier is not save-name-parameterized
  on the wire — the poller already knows the session's active save (08 § "Snapshot queries").
- **History point types** (08 § "Per-type history queries + point types"), each carrying
  `gameTimeId: Int!` plus the typed payload of that domain:

  ```graphql
  type CircuitsHistoryPoint        { gameTimeId: Int!  circuits: [Circuit!]! }
  type FactoryStatsHistoryPoint    { gameTimeId: Int!  factoryStats: FactoryStats! }
  type ProdStatsHistoryPoint       { gameTimeId: Int!  prodStats: ProdStats! }
  type GeneratorStatsHistoryPoint  { gameTimeId: Int!  generatorStats: GeneratorStats! }
  type SinkStatsHistoryPoint       { gameTimeId: Int!  sinkStats: SinkStats! }
  ```

  There is **no `HistoryData` interface and no union** — each point type is standalone and
  concrete (resolves C9).
- History argument semantics (08): `saveName: String!` is **mandatory** (decision E-11;
  history is partitioned per save). `since: Int` is the `gameTimeId` cursor
  (`game_time_id > since`, ascending). `maxPoints: Int` triggers server-side **keep-last
  bucketing** (decision E-6). `historySaves(sessionId): [String!]!` returns the distinct
  save names (the old `HistorySaves { saveNames currentSave }` envelope is dropped — the
  client reads the current save from the session's live state).
- The `HistoryDataType` enum (`CIRCUITS FACTORY_STATS PROD_STATS GENERATOR_STATS SINK_STATS`)
  is declared in the SDL but is **not** an argument on any history query (each query is
  already concrete). It exists only for the resolver's internal `data_type` → typed-point
  discrimination (08 § "Enum mapping").

### Mutation

```graphql
type Mutation {
  login(input: LoginInput!): LoginResult!                         # public, rate-limited per IP
  logout: LogoutResult! @auth
  changePassword(input: ChangePasswordInput!): ChangePasswordResult! @auth
  createSession(input: CreateSessionInput!): Session! @auth
  updateSession(id: ID!, input: UpdateSessionInput!): Session! @auth
  deleteSession(id: ID!): Boolean! @auth
  validateSession(id: ID!): SessionInfo! @auth
  updateSettings(input: UpdateSettingsInput!): Settings! @auth
}

input LoginInput { password: String! }
input ChangePasswordInput { currentPassword: String!  newPassword: String! }
input CreateSessionInput { name: String!  address: String! }
input UpdateSessionInput { name: String  isPaused: Boolean  address: String }
input UpdateSettingsInput { logLevel: LogLevel! }

type LoginResult { success: Boolean!  usedDefaultPassword: Boolean! }
type LogoutResult { success: Boolean! }
type ChangePasswordResult { success: Boolean!  message: String! }
type AuthStatus { authenticated: Boolean!  usedDefaultPassword: Boolean! }
```

- `UpdateSessionInput` uses nullable fields = patch semantics (only set fields change),
  matching `models.UpdateSessionRequest`.
- **`UpdateSettingsInput` is `{ logLevel: LogLevel! }` only.** The old draft's
  `historyDataRange` / `historyWindowSize` fields are removed: per 08, those are **client-only
  UI preferences** (browser localStorage) that drive the `since`/`maxPoints` query arguments;
  they are NOT backend `Settings` and NOT in the `settings` table.
- `validateSession` is a mutation because it has side effects (live-probes the game server and
  writes back `sessionName`/`isOnline`). It returns the `SessionInfo` probe result.
- `deleteSession` cascades: deletes the SQLite session row + its `history_points` rows (FK
  `ON DELETE CASCADE`, plan 04), tells the poller to stop, and publishes a removal event.
- There is **no `settingsChanged` subscription** (08): settings changes are surfaced by
  refetch after `updateSettings`.

### Subscription — per-domain typed `<domain>Changed` (no `liveState`, no `LiveDomain`)

```graphql
type Subscription {
  satisfactoryApiStatusChanged(sessionId: ID!): SatisfactoryApiStatus! @auth
  connectivityChanged(sessionId: ID!): ConnectivityStatus! @auth
  sessionUpdated(sessionId: ID!): Session! @auth

  circuitsChanged(sessionId: ID!): [Circuit!]! @auth
  factoryStatsChanged(sessionId: ID!): FactoryStats! @auth
  prodStatsChanged(sessionId: ID!): ProdStats! @auth
  generatorStatsChanged(sessionId: ID!): GeneratorStats! @auth
  sinkStatsChanged(sessionId: ID!): SinkStats! @auth

  playersChanged(sessionId: ID!): [Player!]! @auth
  dronesChanged(sessionId: ID!): [Drone!]! @auth
  droneStationsChanged(sessionId: ID!): [DroneStation!]! @auth
  trainsChanged(sessionId: ID!): [Train!]! @auth
  trainStationsChanged(sessionId: ID!): [TrainStation!]! @auth
  trucksChanged(sessionId: ID!): [Truck!]! @auth
  truckStationsChanged(sessionId: ID!): [TruckStation!]! @auth
  tractorsChanged(sessionId: ID!): [Tractor!]! @auth
  explorersChanged(sessionId: ID!): [Explorer!]! @auth
  vehiclePathsChanged(sessionId: ID!): [VehiclePath!]! @auth
  machinesChanged(sessionId: ID!): [Machine!]! @auth
  storagesChanged(sessionId: ID!): [Storage!]! @auth

  beltsChanged(sessionId: ID!): [Belt!]! @auth
  splitterMergersChanged(sessionId: ID!): [SplitterMerger!]! @auth
  pipesChanged(sessionId: ID!): [Pipe!]! @auth
  pipeJunctionsChanged(sessionId: ID!): [PipeJunction!]! @auth
  cablesChanged(sessionId: ID!): [Cable!]! @auth
  trainRailsChanged(sessionId: ID!): [TrainRail!]! @auth
  hypertubesChanged(sessionId: ID!): [Hypertube!]! @auth
  hypertubeEntrancesChanged(sessionId: ID!): [HypertubeEntrance!]! @auth

  spaceElevatorChanged(sessionId: ID!): SpaceElevator! @auth
  hubChanged(sessionId: ID!): Hub! @auth
  radarTowersChanged(sessionId: ID!): [RadarTower!]! @auth
  resourceNodesChanged(sessionId: ID!): [ResourceNode!]! @auth
  schematicsChanged(sessionId: ID!): [Schematic!]! @auth
}
```

Design rationale (decision D-C, E-9; resolves C2):

- **One typed subscription per live domain.** Each returns exactly one concrete type — no
  `liveState` sparse object, no `LiveStateEvent`, no `LiveDomain` enum, no union. This is the
  explicit cost we accept (more subscription fields) to keep every delivered frame strongly
  typed and avoid `client-preset` union narrowing. A page opens only the `<domain>Changed`
  fields it renders; urql multiplexes them over the one websocket connection.
- Each subscription takes a **mandatory `sessionId: ID!`** filter applied server-side
  (saffron-hive pattern, `research/ref-graphql.md` §5). The eventbus topic is
  per-`(session, save, dataType)` (decision E-11), so `save_name` isolation (commit
  `0a12da8`) is preserved end-to-end.
- `connectivityChanged` carries the offline/disconnect/readiness signal — `ConnectivityStatus
  { isOnline isDisconnected stage }` — replacing the SSE `sessionUpdate` control event's
  status fields and the poller's full↔light tier flip trigger. `sessionUpdated` carries the
  full `Session` on save-name change / config change (08; `research/rest-surface.md` obs. 6).
- **History live-append (decision E-9):** the five history-enabled domains (`circuits`,
  `factoryStats`, `prodStats`, `generatorStats`, `sinkStats`) each have BOTH a
  `<domain>Changed` subscription and a `<domain>History` query. There is **no dedicated
  `historyAppended` subscription** — the `<domain>Changed` payload already corresponds to the
  latest `gameTimeId`, and charts stitch live points by `gameTimeId`. On WS reconnect the
  client re-runs each `<domain>History` query with `since=<latest gameTimeId>` AND re-snapshots
  live state via the snapshot queries.
- The coalescing/drop-stale behavior the SSE `CoalescingQueue` provided now lives in the
  eventbus fan-out (plan 05's drop-on-full `ChannelBus`); it is not re-implemented in the
  bridge.

---

## REST + SSE → GraphQL operation map

Every row from `rest-surface.md` mapped to the typed operations above. This is the acceptance
checklist for "REST + SSE gone".

| Current endpoint | GraphQL op |
|---|---|
| POST `/v1/auth/login` | `mutation login(input)` (sets cookie on response) |
| GET `/v1/auth/status` | `query authStatus` (public) |
| POST `/v1/auth/change-password` | `mutation changePassword(input)` |
| POST `/v1/auth/logout` | `mutation logout` (clears cookie) |
| GET `/v1/sessions` | `query sessions` |
| POST `/v1/sessions` | `mutation createSession(input)` |
| GET `/v1/sessions/preview` | `query previewSession(address)` |
| GET `/v1/sessions/:id` | `query session(id)` |
| PATCH `/v1/sessions/:id` | `mutation updateSession(id, input)` |
| DELETE `/v1/sessions/:id` | `mutation deleteSession(id)` |
| GET `/v1/sessions/:id/validate` | `mutation validateSession(id)` |
| GET `/v1/sessions/:id/events` (SSE) | the per-domain `<domain>Changed` subscriptions + `sessionUpdated` + `connectivityChanged` |
| GET `/v1/sessions/:id/state` | the per-domain snapshot queries (e.g. `circuits` + `players` + … selected per page) |
| GET `/v1/settings` | `query settings` |
| PUT `/v1/settings` | `mutation updateSettings(input)` |
| GET `/v1/satisfactoryApiStatus` | `query satisfactoryApiStatus(sessionId)` + `subscription satisfactoryApiStatusChanged(sessionId)` |
| GET `/v1/client-ip` | `query clientIp` |
| GET `/v1/factoryStats` | `query factoryStats(sessionId)` + `subscription factoryStatsChanged(sessionId)` + `query factoryStatsHistory(...)` |
| GET `/v1/generatorStats` | `query generatorStats(sessionId)` + `subscription generatorStatsChanged(sessionId)` + `query generatorStatsHistory(...)` |
| GET `/v1/prodStats` | `query prodStats(sessionId)` + `subscription prodStatsChanged(sessionId)` + `query prodStatsHistory(...)` |
| GET `/v1/sinkStats` | `query sinkStats(sessionId)` + `subscription sinkStatsChanged(sessionId)` + `query sinkStatsHistory(...)` |
| GET `/v1/circuits` | `query circuits(sessionId)` + `subscription circuitsChanged(sessionId)` + `query circuitsHistory(...)` |
| GET `/v1/players` | `query players(sessionId)` + `subscription playersChanged(sessionId)` |
| GET `/v1/machines` | `query machines(sessionId)` + `subscription machinesChanged(sessionId)` |
| GET `/v1/trains` | `query trains(sessionId)` + `subscription trainsChanged(sessionId)` |
| GET `/v1/trainStations` | `query trainStations(sessionId)` + `subscription trainStationsChanged(sessionId)` |
| GET `/v1/trainSetup` | `query trains(sessionId) trainStations(sessionId)` (composite dropped) |
| GET `/v1/drones` | `query drones(sessionId)` + `subscription dronesChanged(sessionId)` |
| GET `/v1/droneStations` | `query droneStations(sessionId)` + `subscription droneStationsChanged(sessionId)` |
| GET `/v1/droneSetup` | `query drones(sessionId) droneStations(sessionId)` (composite dropped) |
| GET `/v1/belts` | `query belts(sessionId) splitterMergers(sessionId)` + `subscription beltsChanged / splitterMergersChanged` (the `Belts` bundle dropped) |
| GET `/v1/pipes` | `query pipes(sessionId) pipeJunctions(sessionId)` + `subscription pipesChanged / pipeJunctionsChanged` (the `Pipes` bundle dropped) |
| GET `/v1/cables` | `query cables(sessionId)` + `subscription cablesChanged(sessionId)` |
| GET `/v1/trainRails` | `query trainRails(sessionId)` + `subscription trainRailsChanged(sessionId)` |
| GET `/v1/hypertubes` | `query hypertubes(sessionId) hypertubeEntrances(sessionId)` + `subscription hypertubesChanged / hypertubeEntrancesChanged` (the `Hypertubes` bundle dropped) |
| GET `/v1/resourceNodes` | `query resourceNodes(sessionId)` + `subscription resourceNodesChanged(sessionId)` |
| GET `/v1/schematics` | `query schematics(sessionId)` + `subscription schematicsChanged(sessionId)` |
| GET `/v1/storages` | `query storages(sessionId)` + `subscription storagesChanged(sessionId)` |
| GET `/v1/tractors` | `query tractors(sessionId)` + `subscription tractorsChanged(sessionId)` |
| GET `/v1/explorers` | `query explorers(sessionId)` + `subscription explorersChanged(sessionId)` |
| GET `/v1/vehiclePaths` | `query vehiclePaths(sessionId)` + `subscription vehiclePathsChanged(sessionId)` |
| GET `/v1/spaceElevator` | `query spaceElevator(sessionId)` + `subscription spaceElevatorChanged(sessionId)` |
| GET `/v1/hub` | `query hub(sessionId)` + `subscription hubChanged(sessionId)` |
| GET `/v1/radarTowers` | `query radarTowers(sessionId)` + `subscription radarTowersChanged(sessionId)` |
| GET `/v1/sessions/:id/history` | `query historySaves(sessionId)` |
| GET `/v1/sessions/:id/history/:dataType` | the matching `<domain>History(sessionId, saveName, since, maxPoints)` query |
| GET `/v1/nodes` | **DELETED** (distributed-polling artifact, no equivalent) |
| ANY `/healthz` | kept as plain HTTP |
| GET `/v2/docs/*` | **DELETED** → GraphQL introspection / Playground |
| GET `/internal/metrics` | kept as plain HTTP |

---

## Resolver struct + dependency injection

`api/internal/graph/resolver.go`. Root `Resolver` holds every dependency as a narrow
interface defined in this package (the DI seam), satisfied structurally by the real
implementations:

```go
package graph

type GraphStore interface {
	ListSessions(ctx context.Context) ([]models.Session, error)
	GetSession(ctx context.Context, id session.ID) (*models.Session, error)
	CreateSession(ctx context.Context, in models.CreateSessionRequest) (*models.Session, error)
	UpdateSession(ctx context.Context, id session.ID, in models.UpdateSessionRequest) (*models.Session, error)
	DeleteSession(ctx context.Context, id session.ID) error

	GetSettings(ctx context.Context) (*models.Settings, error)
	UpdateSettings(ctx context.Context, s models.Settings) (*models.Settings, error)

	ListHistorySaves(ctx context.Context, sessionID session.ID) ([]string, error)
	QueryHistory(ctx context.Context, q store.HistoryQuery) ([]store.HistoryPoint, error)
}

type Snapshotter interface {
	// Latest reads the poller's in-memory LatestStore for one (session, dataType);
	// the poller keys internally by (session, save, dataType) — decision E-11.
	Latest(sessionID session.ID, dataType string) (any, bool)
	CurrentSaveName(sessionID session.ID) string
	Stage(sessionID session.ID) models.SessionStage
	Connectivity(sessionID session.ID) models.ConnectivityStatus
}

type Poller interface {
	PreviewSession(ctx context.Context, address string) (models.SessionInfo, error)
	ValidateSession(ctx context.Context, id session.ID) (models.SessionInfo, error)
	StartSession(id session.ID)
	StopSession(id session.ID)
}

type Resolver struct {
	Store    GraphStore
	Snapshot Snapshotter
	Poller   Poller
	EventBus eventbus.Subscriber
	Auth     *auth.Service
	Config   *config.Config
}
```

- `GraphStore` = only the sqlc store methods resolvers call (plan 04 `*store.DB` satisfies
  it). `store.HistoryQuery` carries `{sessionID, saveName, dataType, since, maxPoints}`
  (decision E-6); `store.HistoryPoint` is the raw row `{gameTimeId int, data []byte}` the
  resolver decodes per `data_type` into the typed `<Type>HistoryPoint`. Session IDs use
  `session.ID` (decision E-5 leaf-package alias), matching the sqlc override.
- `Snapshotter` = the poller's in-memory `LatestStore` plus the derived `stage` and
  `connectivity` (plan 02). The per-domain snapshot query resolvers call `Latest` and map the
  result; `Stage` backs `Session.stage` and `connectivity` backs the `connectivity` query +
  `connectivityChanged` subscription. **There is no `Snapshot(sessionID) *models.State`** —
  the single-`State` aggregate is gone (decision D-C).
- `Poller` = lifecycle + live-probe operations (preview/validate hit the game server,
  start/stop on session create/delete).
- `EventBus` = subscribe side only (resolvers never publish; the poller publishes).
- `Auth` = login/changePassword/logout, cookie issue, token parse (plan 04 store-backed; the
  token store is the SQLite `auth_tokens` table — decision E-7).

The generated `generated.go` declares `QueryResolver`/`MutationResolver`/
`SubscriptionResolver`; the resolver tail wires them via embedding:

```go
func (r *Resolver) Mutation() MutationResolver         { return &mutationResolver{r} }
func (r *Resolver) Query() QueryResolver               { return &queryResolver{r} }
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
```

Domain-struct → generated-model mapping is hand-written in `internal/graph/mappers.go`
(e.g. `mapCircuit`, `mapGeneratorStats` — the latter turns the Go
`map[PowerType]PowerSource` into a `[PowerSource!]!` list via the ONE shared mapper both the
live path and the history-decode path use, per 08 fit-note 4 and decision E-2/D-C). No
dataloaders (matching saffron-hive; the snapshot is already in memory and history is a single
ranged query).

### History resolver — decode JSON → typed points (decision E-6, D-C)

Each `<domain>History` resolver runs the same shape:

1. Build `store.HistoryQuery{sessionID, saveName, dataType: "<domain>", since, maxPoints}`.
   `dataType` is the plain TEXT discriminator (decision E-5 — NOT a typed enum at the sqlc
   layer); the resolver knows the concrete type from which field it implements.
2. Call `GraphStore.QueryHistory`. The store runs `QueryHistoryRaw` (no `maxPoints`) or
   `QueryHistoryBucketed` (keep-last bucketing, decision E-6) — plan 04.
3. For each returned `store.HistoryPoint`, `json.Unmarshal(point.Data, &typed)` into the
   concrete Go struct for that data type, then map it through the same `mappers.go` helper
   the live path uses, returning the matching `<Type>HistoryPoint{ gameTimeId, <field> }`.

The opaque JSON never crosses the GraphQL boundary (decision D-C); it lives only in
`history_points.data` and is decoded server-side here.

---

## Subscription resolvers (the eventbus → graphql-ws bridge)

Every subscription follows the saffron-hive recipe (`research/ref-graphql.md` §5): subscribe
to the bus, spawn one goroutine per client, `select` on `ctx.Done()` + the bus channel, filter
server-side, forward with a `ctx.Done()`-guarded send, `defer close(out)` + `defer
Unsubscribe`. The `ctx` is the per-subscription context gqlgen derives from the websocket
connection; when graphql-ws sends `complete` or the socket drops, gqlgen cancels it, the
goroutine returns, `out` closes (gqlgen ends the stream), and the bus subscription is torn
down.

Every `<domain>Changed` resolver is the same shape, differing only in the eventbus
`EventType` it subscribes to and the typed model it maps to. Example for `circuitsChanged`:

```go
func (r *subscriptionResolver) CircuitsChanged(ctx context.Context, sessionID string) (<-chan []*model.Circuit, error) {
	sid := session.ID(sessionID)
	saveName := r.Snapshot.CurrentSaveName(sid)
	ch := r.EventBus.SubscribeDomain(sessionID, saveName, string(models.SatisfactoryEventCircuits))
	out := make(chan []*model.Circuit, 1)

	go func() {
		defer close(out)
		defer r.EventBus.Unsubscribe(ch)

		if snap, ok := r.Snapshot.Latest(sid, string(models.SatisfactoryEventCircuits)); ok {
			select {
			case out <- toCircuitModels(snap):
			case <-ctx.Done():
				return
			}
		}

		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				se, ok := evt.Payload.(eventbus.SatisfactoryEvent)
				if !ok {
					continue
				}
				select {
				case out <- toCircuitModels(se):
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return out, nil
}
```

- The bus event carries `{Type, SessionID, SaveName, GameTimeID, Payload any}` (plan 05).
  `SubscribeDomain(sessionID, saveName, dataType)` pins the `(session, save, dataType)` topic
  the poller publishes on (decision E-11), so the channel already delivers only the active
  save's data for that session — no server-side `sessionID` filter is needed. This is the
  consumer side of plan 05's `Subscriber` interface; the snapshot is forwarded first
  (subscribe-then-snapshot, R7), then live frames drain.
- The `Payload` is type-asserted to `eventbus.SatisfactoryEvent` and mapped to the generated
  model via `mappers.go` (`toCircuitModels`); on mismatch it `continue`s.
- The eventbus fan-out (plan 05) performs drop-on-full per subscriber, so a slow browser tab
  never stalls the poller — the SSE `CoalescingQueue` behavior is preserved at the bus, not
  re-implemented here.
- `satisfactoryApiStatusChanged`, `connectivityChanged`, and `sessionUpdated` are the same
  shape against the control event types; `connectivityChanged` maps to `ConnectivityStatus
  { isOnline isDisconnected stage }` and `sessionUpdated` to the full `Session`.

The five history-enabled `<domain>Changed` resolvers are identical to the live ones — they do
NOT write history (that is the recorder's job, a separate bus subscriber per
`research/ref-graphql.md` §7 and plan 05); they only forward the live frame. The client
stitches it onto the queried history window by `gameTimeId` (decision E-9).

---

## Auth directive, context injection, error presenter

`internal/graph/directive.go`:

```go
func AuthDirective(ctx context.Context, _ any, next graphql.Resolver) (any, error) {
	if _, ok := auth.UserFromContext(ctx); !ok {
		return nil, &gqlerror.Error{
			Message:    "authentication required",
			Extensions: map[string]any{"code": "UNAUTHENTICATED"},
		}
	}
	return next(ctx)
}
```

Wired via `graph.Config{Directives: graph.DirectiveRoot{Auth: graph.AuthDirective}}`.
Because it reads the caller from context, the same directive enforces auth for queries,
mutations, AND subscriptions — only the injection point differs.

**HTTP path** (`internal/auth/middleware.go`): read the `sd_access_token` cookie, validate it
against the SQLite `auth_tokens` store (sliding expiration: bump `last_used`, lazy
`expires_at > now` check — decision E-7), and `next.ServeHTTP(w, r.WithContext(auth.WithUser(ctx, u)))`.
It does NOT reject unauthenticated requests — it only attaches the caller if present; the
`@auth` directive rejects. It skips websocket upgrades (`if isWebSocketUpgrade(r) { next; return }`)
so the WS `InitFunc` owns socket auth.

**Websocket path** (`wsInitFunc`) — **same-origin cookie only (decision E-3):**

```go
func wsInitFunc(svc *auth.Service) transport.WebsocketInitFunc {
	return func(ctx context.Context, init transport.InitPayload) (context.Context, *transport.InitPayload, error) {
		req := transport.WsRequestFromContext(ctx) // the upgrade *http.Request
		c, err := req.Cookie("sd_access_token")
		if err != nil {
			return ctx, nil, errors.New("missing auth cookie")
		}
		u, err := svc.ValidateToken(ctx, auth.Token(c.Value))
		if err != nil {
			return ctx, nil, errors.New("invalid or expired token")
		}
		return auth.WithUser(ctx, u), nil, nil
	}
}
```

- The init func reads the auth cookie off the **upgrade `http.Request`** (gqlgen exposes it on
  the WS context). There is **no `connectionParams.authToken` path**, and the client (plan 07)
  sends **no `connectionParams`** (decision E-3). On a missing/invalid cookie the func returns
  an error so the socket is refused before any subscription runs.
- Same-origin deployment (single container, plan 01) makes the cookie reliable on the WS
  upgrade, which is why the cross-origin `connectionParams` fallback the old draft carried is
  removed.

Since auth is single-shared-password (no `User` model, per `domain-models.md`),
`auth.UserFromContext` returns a minimal caller (`{Authenticated bool, UsedDefaultPassword bool}`);
the token store is the SQLite `auth_tokens` table and the password is the singleton
`auth_password` row (decision E-7). `usedDefaultPassword` flows from `auth_password.is_default`
into `authStatus` and `login`'s result.

**Error presenter** (`internal/graph/error_presenter.go`): for unauthenticated callers, scrub
gqlgen parse/validation messages (so the schema can't be reconstructed via
introspection-by-error); pass resolver errors through verbatim with their `code` extension.
Wired via `gqlSrv.SetErrorPresenter(graph.ErrorPresenter)`. The current REST
`ErrorResponse{errors:[{code,msg}]}` envelope is dropped — GraphQL's `errors[]` with an
`extensions.code` replaces it (e.g. `UNAUTHENTICATED`, `NOT_FOUND`, `VALIDATION`,
`SESSION_NOT_READY`). The REST envelope types (`BindingError`/`ErrorResponse`/`ApiError`) and
the `status_codes` package are deleted (08).

---

## Server wiring (stdlib `net/http`, Gin removed — decision E-1)

The router is the stdlib `net/http` `ServeMux`; **Gin is removed entirely**. `app.go` (plan
02) builds an `*http.Server` around the mux — there is no `gin.Engine`, `gin.SetMode`,
`routers.NewRouter()`, or `GIN_MODE` (the Dockerfile drops `GIN_MODE` too, plan 01).

```go
resolver := &graph.Resolver{
	Store:    sqlStore,
	Snapshot: poller,
	Poller:   poller,
	EventBus: bus,
	Auth:     authSvc,
	Config:   cfg,
}

gqlSrv := handler.New(graph.NewExecutableSchema(graph.Config{
	Resolvers:  resolver,
	Directives: graph.DirectiveRoot{Auth: graph.AuthDirective},
}))
gqlSrv.AddTransport(transport.POST{})
gqlSrv.AddTransport(transport.GET{})
gqlSrv.AddTransport(transport.Websocket{
	InitFunc:              wsInitFunc(authSvc),
	Upgrader:              websocket.Upgrader{CheckOrigin: originChecker(cfg.ExternalURL)},
	KeepAlivePingInterval: 10 * time.Second,
})
gqlSrv.Use(extension.Introspection{})
gqlSrv.Use(extension.FixedComplexityLimit(MaxQueryComplexity))
gqlSrv.SetErrorPresenter(graph.ErrorPresenter)
gqlSrv.SetRecoverFunc(graph.RecoverFunc)

mux := http.NewServeMux()
mux.Handle("/graphql", auth.ClientIPMiddleware(cfg)(auth.Middleware(authSvc)(gqlSrv)))
mux.HandleFunc("/healthz", healthHandler)
mux.Handle("/internal/metrics", metricsHandler)
if cfg.Dev {
	mux.Handle("/playground", playground.Handler("GraphQL", "/graphql"))
}
// SPA static + fallback registered LAST (plan 01's RegisterStatic, a stdlib http.Handler:
// http.FileServer over the go:embed'd dist + the mounted assets volume + index.html
// fallback for unknown non-asset, non-/graphql paths).
RegisterStatic(mux, cfg)
```

- `handler.New` (not `NewDefaultServer`) so `transport.Websocket` is registered explicitly
  for subscriptions. The same `gqlSrv` serves queries/mutations (POST/GET) and subscriptions
  (Websocket).
- **`CheckOrigin` is sourced from `config.ExternalURL`** (same-origin) — decision E-4. There
  is **no `AllowedOrigins` config field** and **no CORS machinery** (plan 01 deletes all of
  it). `originChecker(cfg.ExternalURL)` accepts only the configured external origin on the WS
  upgrade.
- `auth.ClientIPMiddleware` ports the current X-Forwarded-For/X-Real-IP resolution that backs
  `clientIp` and the login rate-limit (the rate-limiter's `client_ip` context comes from the
  `auth_tokens.client_ip` column — decision E-7).
- Login rate-limiting (currently per-client-IP on `POST /v1/auth/login`) moves into the
  `login` mutation resolver (or a small pre-resolver wrapper keyed on the ctx client IP).
- The embedded SPA + `//go:embed` dist + SPA fallback is plan 01's `RegisterStatic` concern;
  shown here only to make the single-binary, single-origin wiring concrete. It is registered
  **last** so `/graphql`, `/healthz`, `/internal/metrics`, and `/playground` win and unknown
  non-asset paths fall back to `index.html`.

---

## Files to ADD / CHANGE / DELETE (this plan's slice)

ADD:
- `api/gqlgen.yml`
- `api/schema.graphql` (single SDL file; the path 08's `make generate` step (3) feeds the
  frontend codegen)
- `api/internal/graph/resolver.go` (Resolver struct + DI interfaces)
- `api/internal/graph/schema.resolvers.go` (generated stubs, filled in)
- `api/internal/graph/generated.go` (gqlgen-generated, committed)
- `api/internal/graph/model/models_gen.go` (gqlgen-generated)
- `api/internal/graph/mappers.go` (domain → GraphQL model mapping incl. the ONE shared
  `GeneratorStats` map→list mapper used by both the live and history-decode paths)
- `api/internal/graph/enums.go` (enum name↔human-value binding, per 08's enum table)
- `api/internal/graph/directive.go` (`AuthDirective`)
- `api/internal/graph/error_presenter.go` (`ErrorPresenter`, `RecoverFunc`)
- `api/internal/auth/middleware.go` HTTP middleware + `wsInitFunc` (same-origin cookie;
  auth pkg refactor; coordinate with plan 04 store)
- `api/internal/auth/token.go` (leaf-package `type Token string`, decision E-5 — referenced by
  the sqlc override and the cookie validation)

CHANGE:
- `api/internal/app/app.go` (was `routers/router.go`): build the stdlib `*http.Server` +
  `ServeMux` + gqlgen handler wiring above. **No Gin** (decision E-1).
- `api/Makefile` / root `Makefile`: `make generate` is the single 3-step pipeline owned by
  08 (gqlgen → sqlc → `bun run codegen`); the tygo target is dropped (08).
- `api/go.mod`: add gqlgen (`tool` directive) + gorilla/websocket + gqlparser; drop gin,
  go-redis, and the gin-metrics adapter (metrics handler becomes a plain `http.Handler`).

DELETE:
- `api/routers/api/v1/*.go` (all REST handlers) and `api/routers/routes/*.go` (route groups,
  the Gin `RoutingGroup` machinery) — replaced by resolvers.
- `api/routers/api/v1/events_sse.go` + the `CoalescingQueue` (replaced by the subscription
  bridge + eventbus fan-out, plan 05).
- `api/middleware/auth.go` (`RequireAuth`) and `api/middleware/session_stage.go`
  (`RequireSessionReady`, the 425 gate) — replaced by the `@auth` directive +
  `Session.stage` / `connectivityChanged.stage`.
- `api/routers/api/v1/nodes.go` + `api/routers/routes/nodes.go` (distributed-polling
  endpoint, deleted with plan 02).
- All CORS machinery (decision E-4) and the `AllowedOrigins` config field — plan 01 owns the
  removal; this plan's WS `CheckOrigin` reads `config.ExternalURL` instead.
- `api/models/models/dto.go` (the ~30 identity aliases + REST composites), `error.go` (REST
  error envelopes), the `status_codes` package — GraphQL error model replaces them (08).
- The `Int64` scalar wherever the old draft referenced it (SDL + `gqlgen.yml`) — decision E-2.
- Swagger: `swag`-generated docs + the `/v2/docs` handler (and the stale mock-mode line in the
  generated swagger doc — decision D-D).

The mock-mode section of the old draft is **removed** (decision D-D): no mock poller, no mock
store, no `config.mock`, no resolver mode-awareness.

---

## Step-by-step migration

1. Add `gqlgen.yml`, an empty `schema.graphql` with the header (the `DateTime` scalar +
   `@auth` directive + empty root types — **no `Int64` scalar**), wire the gqlgen `tool`
   directive in `go.mod`, run `go tool gqlgen generate` to confirm codegen works end-to-end.
2. Land the SDL incrementally per domain, regenerating after each, conforming field-for-field
   to 08's catalog. Start with `authStatus`/`login`/`settings`/`sessions` (the non-live config
   surface) since they have no eventbus dependency.
3. Implement `Resolver` + the four DI interfaces; back `GraphStore` with plan 04's
   `*store.DB`, `Snapshotter`/`Poller` with plan 02's poller. Implement config-surface
   resolvers + mappers; verify against a manual GraphQL query in the Playground.
4. Add the `@auth` directive + HTTP `auth.Middleware`; flip `authStatus`/`login` public,
   everything else `@auth`. Port cookie issue/clear + login rate-limit into the
   resolvers/middleware. Add `ErrorPresenter`.
5. Add the per-domain typed snapshot query resolvers reading the poller `LatestStore` via
   `Snapshotter.Latest`; add `Session.stage` from `Snapshotter.Stage` and the `connectivity`
   query from `Snapshotter.Connectivity`.
6. Add the five `<domain>History` queries + `historySaves` against plan 04's `history_points`
   store, including the `since` cursor and the server-side keep-last `maxPoints` bucketing.
   Implement the JSON-decode-per-`data_type` → typed-point path through the shared mappers.
7. Add `transport.Websocket` + `wsInitFunc` (same-origin cookie, decision E-3); implement the
   per-domain `<domain>Changed` subscriptions + `connectivityChanged` + `sessionUpdated`
   against plan 05's eventbus using the bridge recipe. Verify a subscription delivers, filters
   by `sessionId`, and tears down on client disconnect.
8. Replace `routers/router.go` (Gin) with the stdlib `ServeMux` + `gqlSrv` in `app.go`
   (decision E-1). Keep `/healthz` and `/internal/metrics` as plain handlers; register
   `RegisterStatic` last. Add the dev-only Playground. Source WS `CheckOrigin` from
   `config.ExternalURL` (decision E-4).
9. Delete all REST handlers, route groups, SSE code, the two auth/ready middlewares, the
   nodes endpoint, DTO aliases, REST error envelopes, CORS machinery, and Swagger.
10. The `make generate` rewrite + tygo drop is owned by 08; this plan just consumes the new
    pipeline. Run the full lint/build.
11. Tests (decision E-10, recommended light scope): copy saffron-hive's `subscription_test.go`
    patterns — publish on a real `eventbus.ChannelBus`, assert a `<domain>Changed` resolver's
    `out` delivers and filters by `sessionId`, and a disconnect test (cancel ctx, assert `out`
    closes). Add resolver tests for the config/history queries with a fake `GraphStore`. The
    minimal automated e2e smoke (boot → one typed query + one mutation + one `<domain>Changed`
    round-trip) lands alongside plan 04's CI migration up/down check; the manual two-session
    run remains the functional gate.

---

## RELEASE / UPGRADE NOTE — auth clean wipe (decision D-A)

This refactor replaces Redis with SQLite as the auth store. **There is NO migration of the
existing password or access tokens** (08 § "RELEASE / UPGRADE NOTE"). On first boot against an
empty SQLite DB the `auth_password` row re-bootstraps to `SD_BOOTSTRAP_PASSWORD` (default
`"change-me"`) with `is_default = 1`, and every client must log in again. **The operator MUST
re-set their password after upgrade.** This is an EXPLICIT, user-approved clean cutover (closes
critic B4), not an accidental loss of backward compatibility; surface it in the
deployment/upgrade docs (01/02/06).

---

## Risks

- **Subscription field count.** Per 08 / decision D-C we deliberately expose ~33 typed
  `<domain>Changed` subscription fields instead of one `liveState` field. urql multiplexes them
  over a single websocket, but a page that opens many domains pays for many active server-side
  goroutines (one per subscription). At the ~10-session capacity envelope (decision D-B) this is
  comfortable; revisit only if a single page subscribes to dozens of domains at once.
- **Coalescing semantics.** The latest-per-type/drop-stale guarantee the SSE `CoalescingQueue`
  provided now lives in the eventbus fan-out (plan 05's drop-on-full `ChannelBus`). If plan 05's
  bus does not coalesce per topic (only drops on full buffer), a slow client could receive stale
  ordering for high-frequency domains. The bridge here assumes plan 05's per-`(session, save,
  dataType)` topic + drop-on-full is sufficient; the two plans must agree.
- **WS cookie on the upgrade (decision E-3).** Same-origin cookie auth depends on the
  single-container, single-origin deployment (plan 01). If a deployment ever fronts the API on a
  different origin than the SPA, the WS cookie would not be sent — but that is explicitly
  out-of-scope (CORS removed, decision E-4). Plan 07 must send NO `connectionParams`.
- **Query complexity / depth.** The deep nested slices (machines, belt/pipe geometry) can
  produce large responses. `FixedComplexityLimit` plus per-page narrow selection mitigates; pick
  `MaxQueryComplexity` conservatively.
- **Enum name collisions.** Several enums share human values across types (`unknown`, `parked`);
  the name↔value binding must be per-enum-type, not global. 08 owns the exact 24-enum table.
- **History JSON decode cost.** Each `<domain>History` point requires a `json.Unmarshal` of the
  `history_points.data` blob server-side (decision E-6/D-C). For large ranges, the `maxPoints`
  keep-last bucketing bounds the number of points decoded; an unbounded `since`+no-`maxPoints`
  query over an 8h range is the worst case — the frontend always passes `maxPoints` for charts.

---

## How this satisfies the done-criteria

- **No REST, no WSS-SSE, no SSE.** Every one of the 39 routes + the SSE stream maps to a typed
  GraphQL Query/Mutation/Subscription (mapping table above); the Gin router, all REST handlers,
  `events_sse.go`, and `/v1/nodes` are deleted. The only non-GraphQL HTTP left is `/healthz`,
  `/internal/metrics`, and the SPA static handler.
- **GraphQL replaces API polling entirely — history AND live, fully typed (decision D-C).**
  History reads come from the five typed `<domain>History` queries + `historySaves` (SQLite
  `history_points` via plan 04, JSON decoded to typed points server-side); live state streams
  through the per-domain `<domain>Changed` subscriptions bridged from the in-process eventbus
  (plan 05); the initial snapshot is the per-domain typed snapshot queries off the poller's
  `LatestStore` (plan 02). No `liveState`, no `HistoryChunk`, no opaque scalar, no `Int64`.
- **No Redis.** Resolvers touch only the sqlc store (config/history/auth via `auth_password` +
  `auth_tokens`) and the eventbus (live). No Redis pub/sub, no Redis cache, no Redis token store.
- **No Gin, no CORS.** The router is stdlib `net/http` `ServeMux` (decision E-1); CORS is removed
  and the only origin check is the WS `CheckOrigin` from `config.ExternalURL` (decision E-4).
- **No home-built distributed polling.** `/v1/nodes` and lease types are deleted, not modeled;
  `Snapshotter`/`Poller` are the single in-process poller (plan 02), justified at the ~10-session
  envelope (decision D-B).
- **No mock mode.** No mock poller, no `config.mock`, no resolver mode-awareness (decision D-D).
- **UI data fetching becomes GraphQL-native** via the schema and subscription contract 08
  defines and this doc wires, consumed by urql React + graphql-ws in plan 07; tygo +
  `apiTypes.ts` are replaced by `@graphql-codegen/client-preset` against `api/schema.graphql`
  (08's `make generate` pipeline, decision E-8).
