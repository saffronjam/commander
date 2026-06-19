# 08 — Data Model & Schema (the authoritative contract)

## Context

This document is the SINGLE SOURCE OF TRUTH for the GraphQL type catalog, the SQLite table set, and the
`make generate` pipeline. Every other plan conforms to it:

- `04-sqlite-sqlc-store.md` takes its tables, columns, indexes, queries, and sqlc overrides from here.
- `06-graphql-backend.md` takes its SDL types/enums, queries, subscriptions, the `@auth` directive surface,
  and the resolver mapping rules from here.
- `07-graphql-frontend.md` relies on the GraphQL type/field shapes defined here for `client-preset` codegen.

It exists so those three plans do not each invent their own naming and drift. Where a directive does not
enumerate a field, follow the conventions in this document. **Do not invent alternative names.**

This rewrite applies the LOCKED user decisions and engineering resolutions that closed the critic's
contradictions C1–C9. The "Resolved contradictions" section at the end records, inline, where the previous
draft of 08 disagreed with 04/06/07 and which choice is now canonical, so a reader sees the resolution is
intentional.

Today the project has three parallel Go type namespaces and one generator:

- `api/models/models/*.go` — the internal app models (camelCase JSON). Currently exported wholesale to
  `dashboard/src/apiTypes.ts` by tygo.
- `api/service/frm_client/frm_models/models.go` — the raw FRM game-API wire shapes (PascalCase JSON).
  Poller-internal; never serialized to the client or stored.
- `api/models/models/dto.go` — ~30 type aliases (`type CircuitDTO = Circuit`) plus a few composite DTO
  structs, an artifact of the REST layer.

After the refactor there are exactly two generated surfaces and one hand-written DB surface:

1. **GraphQL SDL** (`api/schema.graphql`) — the only client-facing contract. gqlgen generates Go models
   (`internal/graph/model/models_gen.go`); `@graphql-codegen/client-preset` generates the TS types the
   React app imports. tygo is deleted.
2. **sqlc** (`internal/store/sqlite/*`) — generated Go from the SQL queries; the only persistence surface.
3. **The FRM raw models stay exactly as they are** — poller-internal, untouched by this plan.

The core classification, established in `research/domain-models.md`, is:

- **RAW-FRM** — FRM wire shape. Poller-internal. Never reaches GraphQL or SQLite. Untouched.
- **LIVE** — streamed game state produced by the poller. Flows poller → eventbus → GraphQL subscription
  (`<domain>Changed`), plus a typed snapshot query for first paint. **Not persisted** (held in the in-memory
  `LatestStore` only).
- **HISTORICAL** — time-series sample persisted across game-time. Stored in SQLite `history_points`, read
  via per-type `<domain>History` queries. Exactly five types.
- **CONFIG/ENTITY** — durable rows (session, settings, auth). SQLite tables, GraphQL queries + mutations.
- **TRANSPORT/DTO** — request/response/envelope shapes. Become GraphQL input/payload types or disappear.

There is NO mock mode (decision D-D). `Config.Mock` never existed in code; the only references are stale
lines in `CLAUDE.md` ("Set `mock: true`") and `api/CLAUDE.md` (`service/mock_client`, `Config.Mock`), which
04/06 delete. No mock poller is built; no plan may assume one.

## Capacity envelope (the scale this schema is designed for)

Decision D-B: the target is **up to ~10 concurrent game sessions**. A single in-process poller, no sharding,
is justified at this scale:

- ~10 sessions × ~12 live data types on the fast tier (~4 s) + the 5 history writes/session feed bounded
  SQLite write traffic. Under WAL with a single writer (`_txlock=immediate`, see 04) the upsert rate is
  comfortable.
- eventbus fan-out is a handful of subscribers per session (one browser tab opens a few `<domain>Changed`
  streams); the drop-on-full `ChannelBus` (`research/ref-graphql.md` §4) absorbs slow clients.
- Beyond a few dozen sessions the single-writer/single-poller model would need revisiting (sharded pollers,
  a write queue). That is **explicitly out of scope** for this refactor — the schema is not designed for it.

## Settled design decisions

- **One concept = one type.** The DTO aliases in `dto.go` carry no extra fields and are dropped entirely.
  `Circuit`, not `Circuit` + `CircuitDTO`. The `SessionDTO.Stage` computed field becomes a resolver field
  on the GraphQL `Session` type.
- **GraphQL types are their own shape, not the Go structs.** Per `research/ref-graphql.md`, gqlgen runs with
  `autobind: []`: every GraphQL type is a generated model and resolvers map the in-memory snapshot →
  generated model by hand. We do not bind `models.Circuit` directly to GraphQL `Circuit`. This is the
  clean-break approach; the schema exposes a tidied shape (flattened mixins, no `any`, no map types) without
  contorting the internal structs.
- **Fully-typed per-type, no opaque payload (decision D-C).** No `JSON`/`Any`/`Map` scalar ever crosses the
  GraphQL boundary. Resolvers decode stored JSON into typed structs server-side. The FORBIDDEN constructs
  are spelled out in their own section below.
- **Mixins flatten.** `Location` (`X,Y,Z,Rotation`) and `CircuitIDs` (`CircuitID, CircuitGroupID`) are
  embedded via `tstype:",extends"` on many entities today. GraphQL has no struct-embedding-as-field-bag, so:
  - `Location` is a shared object type `Location { x y z rotation }` referenced by a `location: Location!`
    field (reads better on the client; matches how the map overlays consume it).
  - `CircuitIDs` (two scalars) flattens to `circuitId: Int` + `circuitGroupId: Int` directly on each entity.
  - `BoundingBox { min: Location! max: Location! }` stays a shared object.
  - `ItemStats { name: String! count: Float! }` stays a shared object (embedded as a list element, never as
    a mixin).
- **Maps become lists.** `GeneratorStats.Sources map[PowerType]PowerSource` has no GraphQL representation. It
  becomes `sources: [PowerSource!]!` with `PowerSource { type: PowerType! count: Int! totalProduction: Float! }`
  (the map key promoted to a `type` field). The same JSON-encoded list shape is used in the SQLite history
  blob. Do the conversion in ONE shared mapper so the live path and the history path agree (action for 06).
- **History is the only time-series in SQLite.** Exactly five `dataType`s — `circuits`, `factoryStats`,
  `prodStats`, `generatorStats`, `sinkStats` — are persisted (`research/history-persistence.md` §1). Everything
  else LIVE is ephemeral.
- **History rows are stored as a JSON blob keyed by `(session_id, save_name, data_type, game_time_id)`.** Table
  is `history_points` (decision E-6). A single `data TEXT` (JSON) column holds the per-type payload. Rationale:
  the five payloads are heterogeneous structs (`[]Circuit`, `ProdStats` with nested `Items[]`, etc.), not flat
  scalar series; the frontend re-hydrates the whole struct per point; the existing Redis impl already stored
  one JSON `DataPoint` per point. The typed per-type GraphQL history queries (below) are served by resolvers
  that `json.Unmarshal` the `data` column per `data_type` into the typed point struct. We adopt the
  saffron-hive raw/bucketed query pair + retention loop mechanics on a JSON-blob row, with **keep-last**
  bucketing (not `AVG` — averaging heterogeneous JSON is impossible).
- **`game_time_id` is the time axis, not wall-clock.** All history keying, range, `since` cursor, and bucketing
  use the in-game `gameTimeId` (int seconds). There is **no `recorded_at` column** on `history_points`
  (decision E-6): retention is game-time based (cutoff = `currentGameTimeId − maxSampleGameDuration`,
  `research/history-persistence.md` §4), so a wall-clock column is dead weight.
- **`save_name` is a mandatory key segment everywhere (decision E-11).** It is part of the in-memory
  `LatestStore` key, part of the `history_points` composite PK, and part of the per-`(session, save, dataType)`
  eventbus topic. This preserves commit `0a12da8` ("include save name in state cache keys").
- **Typed-string columns via sqlc overrides — leaf packages only (decision E-5).** `session_id` overrides to
  `internal/session.ID`; auth tokens override to `internal/auth.Token`. Both are dependency-free string
  aliases in **leaf** packages to avoid import cycles. `data_type` is **NOT** overridden — it stays `TEXT`
  in the store and is mapped to the GraphQL `HistoryDataType` enum in the resolver. (There is no `models.*`
  override table; the old draft's `models.SessionID` / `models.SatisfactoryEventType` overrides are dropped.)
- **Distributed-polling and REST-envelope types are deleted, not modelled.** `NodeInfo`, `SessionLease`,
  `NodesResponse` (nodes.go), `BindingError`/`ErrorResponse`/`ApiError` (error.go), the `status_codes`
  package, and `SseSatisfactoryEvent` all disappear. GraphQL's own error model + the `@auth` directive
  replace the REST envelope. CORS is removed entirely (same-origin); the only origin check is the WS
  `Upgrader.CheckOrigin` sourced from `config.ExternalURL` (decision E-4).

## Naming conventions

| Layer | Convention | Example |
|---|---|---|
| Go internal struct | `PascalCase` type, `PascalCase` field, camelCase JSON tag | `type Circuit struct { ID string \`json:"id"\` }` |
| GraphQL type | `PascalCase` type, `camelCase` field | `type Circuit { id: ID! fuseTriggered: Boolean! }` |
| GraphQL enum | `PascalCase` name, `SCREAMING_SNAKE` value names | `enum DroneStatus { IDLE FLYING DOCKING }` |
| GraphQL input | suffix `Input` | `input CreateSessionInput { name: String! address: String! }` |
| GraphQL mutation payload | suffix `Result` | `type LoginResult { success: Boolean! usedDefaultPassword: Boolean! }` |
| GraphQL history query | `<domain>History` | `circuitsHistory`, `factoryStatsHistory` |
| GraphQL history point type | `<Type>HistoryPoint` | `CircuitsHistoryPoint`, `FactoryStatsHistoryPoint` |
| GraphQL live subscription | `<domain>Changed` | `circuitsChanged`, `factoryStatsChanged` |
| SQL table | `snake_case`, plural | `sessions`, `settings`, `history_points`, `auth_password`, `auth_tokens` |
| SQL column | `snake_case` | `session_id`, `save_name`, `game_time_id`, `data_type` |
| sqlc Go param/row | sqlc default `PascalCase` from column | `HistoryPoint.GameTimeID` |
| leaf override types | leaf package, dependency-free string alias | `internal/session.ID`, `internal/auth.Token` |

- **IDs:** GraphQL `ID!` for opaque entity identifiers (`Session.id`, `Circuit.id`). Game-numeric ids stay
  typed: `gameTimeId` is `Int!`; `circuitId`/`circuitGroupId` are `Int`.
- **Integers stay `Int` (decision E-2).** GraphQL's built-in `Int` is 32-bit per spec, but `gameTimeId` and
  `Hub.shipReturnTime` (game-time seconds) stay under 2^53 for decades, so `Int` is safe. There is NO `Int64`
  scalar in the SDL or `gqlgen.yml`. (This deletes the old draft's flagged-but-undecided `Int64` caveat —
  the decision is final: keep `Int`.)
- **Timestamps:** GraphQL `scalar DateTime` → `graphql.Time` (RFC3339 ISO string), matching the saffron-hive
  `gqlgen.yml`. The only `time.Time` field reaching the client is `Session.createdAt`.

## Enum mapping (names vs. wire values)

GraphQL enum value names must match `/[_A-Za-z][_0-9A-Za-z]*/` — no spaces, no hyphens. Many Satisfactory enum
*values* are human strings with spaces/hyphens (`"Iron Ore"`, `"Conveyor Merger"`). gqlgen binds each enum
value to a Go constant via the `models:` block in `gqlgen.yml`, so the **GraphQL name** is a SCREAMING_SNAKE
identifier while the **Go value** the resolver returns stays the existing human string:

```yaml
models:
  ResourceType:
    model: github.com/.../api/models/models.ResourceType
    enum_values:
      IRON_ORE:      { value: "Iron Ore" }
      COPPER_ORE:    { value: "Copper Ore" }
      FRACKING_CORE: { value: "Fracking Core" }
```

Name-generation rule: uppercase, replace any run of non-alphanumeric with a single `_`, strip leading/trailing
`_`. So `"Space Giraffe-Tick-Penguin-Whale Thing"` → `SPACE_GIRAFFE_TICK_PENGUIN_WHALE_THING`; `selfDriving`
→ `SELF_DRIVING`.

Full enum list to declare in SDL (24 enums). `SatisfactoryEventType` is **not** an exposed enum — see note
after the table.

| GraphQL enum | Source file | Wire-value note |
|---|---|---|
| `SessionStage` | session.go | `INIT`, `READY` |
| `LogLevel` | settings.go | `TRACE`,`DEBUG`,`INFO`,`WARNING`,`ERROR` |
| `DroneStatus` | drone.go | `IDLE`,`FLYING`,`DOCKING` |
| `TrainType` | train.go | `FREIGHT`,`LOCOMOTIVE` |
| `TrainStatus` | train.go | `SELF_DRIVING`,`MANUAL_DRIVING`,`PARKED`,`DOCKING`,`DERAILED`,`UNKNOWN` |
| `TrainStationPlatformType` | train_station.go | `FREIGHT`,`FLUID_FREIGHT` |
| `TrainStationPlatformMode` | train_station.go | `IMPORT`,`EXPORT` |
| `TrainStationPlatformStatus` | train_station.go | `IDLE`,`DOCKING` |
| `TruckStatus` | truck.go | `SELF_DRIVING`,`MANUAL_DRIVING`,`PARKED`,`UNKNOWN` |
| `TractorStatus` | tractor.go | `SELF_DRIVING`,`MANUAL_DRIVING`,`PARKED`,`UNKNOWN` |
| `ExplorerStatus` | explorer.go | `SELF_DRIVING`,`MANUAL_DRIVING`,`PARKED`,`UNKNOWN` |
| `VehiclePathType` | vehicle_path.go | `EXPLORER`,`FACTORY_CART`,`TRUCK`,`TRACTOR` |
| `MachineType` | machine.go | 17 values, all identifiers |
| `MachineCategory` | machine.go | `FACTORY`,`EXTRACTOR`,`GENERATOR` |
| `MachineStatus` | machine.go | `OPERATING`,`IDLE`,`PAUSED`,`UNCONFIGURED`,`UNKNOWN` |
| `PowerType` | generator_stats.go | `BIOMASS`,`COAL`,`FUEL`,`GEOTHERMAL`,`NUCLEAR`,`UNKNOWN` |
| `StorageType` | storage.go | 5 values, spaces |
| `SplitterMergerType` | splitter_merger.go | 4 values, spaces |
| `TrainRailType` | train_rail.go | `RAILWAY` |
| `ResourceNodePurity` | radar_tower.go | `IMPURE`,`NORMAL`,`PURE` |
| `ResourceType` | radar_tower.go | 13 values, spaces |
| `NodeType` | radar_tower.go | `NODE`,`GEYSER`,`FRACKING_CORE`,`FRACKING_SATELLITE` |
| `FaunaType` | radar_tower.go | 14 values, spaces/hyphens |
| `FloraType` | radar_tower.go | 10 values |
| `SignalType` | radar_tower.go | `SOMERSLOOP`,`MERCER_SPHERE`,`BLUE_POWER_SLUG`,… |

Plus one history-only enum used by `historySaves` is not needed; the five-value `HistoryDataType` is declared
but **only used internally by the resolver** (the data_type → enum mapping) — it is not an argument on any
per-type history query, because each query is already concrete. It is still declared in the SDL for the
resolver's typed return discrimination and for any tooling that wants the closed set:

```graphql
enum HistoryDataType { CIRCUITS FACTORY_STATS PROD_STATS GENERATOR_STATS SINK_STATS }
```

**`SatisfactoryEventType` is NOT an exposed GraphQL enum.** It is the internal eventbus discriminator (plan 05)
and the `history_points.data_type` column value (stored as plain `TEXT`, decision E-5 — no sqlc override).
The GraphQL schema replaces it with named `<domain>Changed` subscription fields and the narrow
`HistoryDataType` enum above.

## FORBIDDEN constructs (decision D-C; resolves C2, C3, C9)

These must NOT appear anywhere in `api/schema.graphql`, `gqlgen.yml`, or any plan:

1. **No single `liveState` sparse object.** There is no catch-all `liveState`/`State`-with-all-nullable-fields
   subscription or query that bundles every domain. Each domain has its own typed snapshot query and its own
   typed `<domain>Changed` subscription.
2. **No `HistoryChunk` and no opaque `data` field on the wire.** The old `HistoryChunk { dataType, points,
   latestId }` envelope and the `DataPoint.data` opaque field are gone. History is served by per-type queries
   returning concrete `[<Type>HistoryPoint!]!`.
3. **No `JSON` / `Any` / `Map` / `Int64` scalar.** No opaque payload scalar of any kind crosses the boundary.
   The JSON blob lives only in the SQLite `history_points.data` column and inside the Go eventbus
   `Event.Payload any`; resolvers decode it into typed structs before it reaches the client.
4. **No GraphQL union or `__typename` narrowing for history/live.** Every subscription and every history query
   returns exactly one concrete type. (One query per data type is the explicit cost we accept to avoid union
   narrowing in `client-preset`.)

## The fully-typed GraphQL catalog (decision D-C)

Doc 08 is the authoritative type + field catalog; 06 and 07 conform to it. The complete domain list is derived
from `research/domain-models.md`, `research/rest-surface.md`, and the SSE event-type inventory.

### Object types (shared + domain)

**Shared leaves:** `Location { x: Float! y: Float! z: Float! rotation: Float! }`,
`BoundingBox { min: Location! max: Location! }`, `ItemStats { name: String! count: Float! }`,
`Fuel { name: String! amount: Float! }`.

**Stats & status:**
- `SatisfactoryApiStatus { running: Boolean! pingMs: Int! }`
- `FactoryStats { totalMachines: Int! efficiency: MachineEfficiency! }`,
  `MachineEfficiency { machinesOperating: Int! machinesIdle: Int! machinesPaused: Int! machinesUnconfigured: Int! machinesUnknown: Int! }`
- `ProdStats { minableProducedPerMinute: Float! minableConsumedPerMinute: Float! itemsProducedPerMinute: Float! itemsConsumedPerMinute: Float! items: [ItemProdStats!]! }`,
  `ItemProdStats { name: String! count: Float! producedPerMinute: Float! maxProducePerMinute: Float! produceEfficiency: Float! consumedPerMinute: Float! maxConsumePerMinute: Float! consumeEfficiency: Float! cloudCount: Float! minable: Boolean! }`
  (the embedded `ItemStats` flattens into `name`/`count`)
- `GeneratorStats { sources: [PowerSource!]! }`, `PowerSource { type: PowerType! count: Int! totalProduction: Float! }`
- `SinkStats { totalPoints: Float! coupons: Int! nextCouponProgress: Float! pointsPerMinute: Float! }`

**Power:**
- `Circuit { id: ID! fuseTriggered: Boolean! consumption: CircuitConsumption! production: CircuitProduction! capacity: CircuitCapacity! battery: CircuitBattery! }`
  with nested `CircuitConsumption { total: Float! max: Float! }`, `CircuitProduction { total: Float! }`,
  `CircuitCapacity { total: Float! }`,
  `CircuitBattery { percentage: Float! capacity: Float! differential: Float! untilFull: Float! untilEmpty: Float! }`
- `Cable { id: ID! name: String! location0: Location! location1: Location! connected0: Boolean! connected1: Boolean! length: Float! }`

**Vehicles & stations** (each flattens `Location`→`location` and, where present, `CircuitIDs`→`circuitId`/`circuitGroupId`):
- `Drone`, `DroneStation`, `Train` (with `vehicles: [TrainVehicle!]!`, `timetable: [TrainTimetableEntry!]!`),
  `TrainVehicle { type: TrainType! capacity: Float! inventory: [ItemStats!]! }`,
  `TrainTimetableEntry { station: String! }`,
  `TrainStation` (with `platforms: [TrainStationPlatform!]!`), `TrainStationPlatform`,
  `Truck`, `TruckStation`, `Tractor`, `Explorer`,
  `VehiclePath { name: String! vehicleType: VehiclePathType! pathLength: Float! vertices: [Location!]! }`

**Infrastructure:**
- `Belt`, `Pipe`, `PipeJunction`, `SplitterMerger`, `TrainRail`, `Hypertube`,
  `HypertubeEntrance` (PowerInfo flattened), `Storage`,
  `Machine { type: MachineType! status: MachineStatus! category: MachineCategory! productivity: Float! input: [MachineProdStats!]! output: [MachineProdStats!]! ... location: Location! boundingBox: BoundingBox! }`,
  `MachineProdStats { name: String! stored: Float! current: Float! max: Float! efficiency: Float! }`

**Progression / world:**
- `SpaceElevator { ... currentPhase: [SpaceElevatorPhaseObjective!]! fullyUpgraded: Boolean! upgradeReady: Boolean! location: Location! boundingBox: BoundingBox! }`,
  `SpaceElevatorPhaseObjective { name: String! amount: Float! totalCost: Float! }`
- `Hub { id: ID! name: String! hasActiveMilestone: Boolean! activeMilestone: HubMilestone shipDocked: Boolean! shipReturnTime: Int location: Location! boundingBox: BoundingBox! }`,
  `HubMilestone { name: String! techTier: Int! type: String! cost: [HubMilestoneCost!]! }`,
  `HubMilestoneCost { name: String! amount: Float! remainingCost: Float! totalCost: Float! }`
- `Schematic { id: ID! name: String! tier: Int! type: String! purchased: Boolean! locked: Boolean! lockedPhase: Boolean! cost: [SchematicCost!]! }` (the "unlockables" data),
  `SchematicCost { name: String! amount: Float! totalCost: Float! }`
- `RadarTower { id: ID! revealRadius: Float! nodes: [ResourceNode!]! fauna: [ScannedFauna!]! flora: [ScannedFlora!]! signal: [ScannedSignal!]! location: Location! boundingBox: BoundingBox! }`,
  `ResourceNode { id: ID! name: String! className: String! purity: ResourceNodePurity! resourceForm: String! resourceType: ResourceType! nodeType: NodeType! exploited: Boolean! location: Location! }`,
  `ScannedFauna { name: FaunaType! className: String! amount: Int! }`,
  `ScannedFlora { name: FloraType! className: String! amount: Int! }`,
  `ScannedSignal { name: SignalType! className: String! amount: Int! }`

**Player:** `Player { id: ID! name: String! health: Float! items: [ItemStats!]! location: Location! }`

**Connectivity / control:**
- `ConnectivityStatus { isOnline: Boolean! isDisconnected: Boolean! stage: SessionStage! }`
- `Session { id: ID! name: String! address: String! sessionName: String! isOnline: Boolean! isPaused: Boolean! isDisconnected: Boolean! stage: SessionStage! createdAt: DateTime! }`
  (`stage`/`isOnline`/`isDisconnected` are resolver fields read from the poller's in-memory state, not DB columns)
- `SessionInfo { sessionName: String! ... }` (the camelCase `getSessionInfo` probe result; used by `previewSession`/`validateSession`)
- `Settings { logLevel: LogLevel! }`

### Snapshot (point-in-time) queries — read the poller's in-memory `LatestStore`

Every snapshot query is typed (no `liveState`). All carry `@auth`. All take `sessionId: ID!` (and read the
session's current `save_name` from the poller; the live tier is not save-name-parameterized on the wire — the
poller already knows the active save). Mirroring the live domains:

```graphql
type Query {
  # sessions / config
  sessions: [Session!]! @auth
  session(id: ID!): Session @auth
  previewSession(address: String!): SessionInfo! @auth
  settings: Settings! @auth
  authStatus: AuthStatus!                     # public
  clientIp: String! @auth

  # live snapshots (mirror the <domain>Changed subscriptions)
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

  # history (see below)
  historySaves(sessionId: ID!): [String!]! @auth
  circuitsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [CircuitsHistoryPoint!]! @auth
  factoryStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [FactoryStatsHistoryPoint!]! @auth
  prodStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [ProdStatsHistoryPoint!]! @auth
  generatorStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [GeneratorStatsHistoryPoint!]! @auth
  sinkStatsHistory(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [SinkStatsHistoryPoint!]! @auth
}
```

### Per-type history queries + point types (decision D-C, E-6, E-9)

One query PER data type, returning concrete typed point arrays. Signature pattern:

```
<domain>History(sessionId: ID!, saveName: String!, since: Int, maxPoints: Int): [<Type>HistoryPoint!]!
```

Each `<Type>HistoryPoint` carries `gameTimeId: Int!` plus the typed fields of that domain:

```graphql
type CircuitsHistoryPoint        { gameTimeId: Int!  circuits: [Circuit!]! }
type FactoryStatsHistoryPoint    { gameTimeId: Int!  factoryStats: FactoryStats! }
type ProdStatsHistoryPoint       { gameTimeId: Int!  prodStats: ProdStats! }
type GeneratorStatsHistoryPoint  { gameTimeId: Int!  generatorStats: GeneratorStats! }
type SinkStatsHistoryPoint       { gameTimeId: Int!  sinkStats: SinkStats! }
```

There is no `HistoryData` interface and no `union` — each point type is standalone and concrete (resolves C9).

Argument semantics:
- `saveName: String!` is **mandatory** (decision E-11): history is partitioned per save; the client passes the
  save it is charting (from `historySaves`, defaulting to the session's current save).
- `since: Int` is the `gameTimeId` incremental cursor (`game_time_id > since`), ordered ascending.
- `maxPoints: Int` triggers server-side **keep-last bucketing** (decision E-6): bucket by
  `floor(gameTimeId / window) * window` where `window` is derived from the requested range / `maxPoints`, keep
  the last point per bucket. This replaces today's client-side `downsampleDataPoints`. (The old `window`
  argument name is renamed to `maxPoints` to match the locked signature; 04/06/07 use `maxPoints`.)

The resolver reads `history_points.data TEXT` (JSON), `json.Unmarshal`s into the concrete Go struct per
`data_type`, and returns the matching `<Type>HistoryPoint`. `historySaves(sessionId: ID!): [String!]!` returns
the distinct save names (decision D-C; the old `HistorySaves { saveNames currentSave }` envelope is dropped —
the client gets the current save from the session's live state).

### Per-domain live subscriptions (decision D-C, E-9)

Per-domain subscriptions with typed payloads, naming convention `<domain>Changed`. All carry `@auth`; auth is
established once at WS connect via the same-origin cookie (decision E-3 — no `connectionParams`). Each takes a
`sessionId: ID!` filter argument and the resolver filters server-side (saffron-hive pattern,
`research/ref-graphql.md` §5). The complete anchor set, derived from the SSE event inventory
(`research/rest-surface.md` "THE SSE ENDPOINT"):

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

Notes:
- `connectivityChanged` carries the offline/disconnect signal (today's `sessionUpdate` control event surfaces
  `isOnline`/`isDisconnected`/`stage`); `sessionUpdated` carries the full `Session` on save-name change/config
  change (`research/rest-surface.md` obs. 6).
- The five history-enabled domains (`circuits`, `factoryStats`, `prodStats`, `generatorStats`, `sinkStats`)
  each have BOTH a `<domain>Changed` subscription and a `<domain>History` query. **There is no dedicated
  `historyAppended` subscription (decision E-9):** live points arrive via the `<domain>Changed` subscription
  (whose payload already corresponds to the latest `gameTimeId`), and charts stitch them by `gameTimeId`. On
  WS reconnect the client re-runs each `<domain>History` query with `since=<latest gameTimeId>` AND re-snapshots
  live state via the snapshot queries.

### Mutations

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
```

Inputs / payloads:
`input LoginInput { password: String! }`, `type LoginResult { success: Boolean! usedDefaultPassword: Boolean! }`,
`type LogoutResult { success: Boolean! }`,
`input ChangePasswordInput { currentPassword: String! newPassword: String! }`,
`type ChangePasswordResult { success: Boolean! message: String! }`,
`type AuthStatus { authenticated: Boolean! usedDefaultPassword: Boolean! }`,
`input CreateSessionInput { name: String! address: String! }`,
`input UpdateSessionInput { name: String isPaused: Boolean address: String }` (nullable = patch),
`input UpdateSettingsInput { logLevel: LogLevel! }`.

## The master mapping table

One row per significant Go type: model → classification → GraphQL type/field → sqlc table (`channel only` =
eventbus, never stored; `in-memory only` = `LatestStore` snapshot, never stored; `—` = not persisted).

### Live aggregate + stats

| Go model (file) | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `State` (state.go) | LIVE aggregate | (no single GraphQL type) — fans out into per-domain snapshot queries + `<domain>Changed` subscriptions | in-memory only (`LatestStore`) |
| `StateDTO` = State | DTO | drop | — |
| `SatisfactoryApiStatus` (api_status.go) | LIVE | `SatisfactoryApiStatus` (`satisfactoryApiStatus` query, `satisfactoryApiStatusChanged` sub) | in-memory only |
| `FactoryStats` (factory_stats.go) | LIVE + HISTORICAL | `FactoryStats` (`factoryStats` query, `factoryStatsChanged` sub, `factoryStatsHistory` query) | `history_points` (data_type=`factoryStats`, JSON) |
| `MachineEfficiency` | nested | `MachineEfficiency` | — |
| `ProdStats` (prod_stats.go) | LIVE + HISTORICAL | `ProdStats` (+ `prodStatsHistory`) | `history_points` (`prodStats`) |
| `ItemProdStats` | nested | `ItemProdStats` (flattens embedded `ItemStats`) | — |
| `GeneratorStats` (generator_stats.go) | LIVE + HISTORICAL | `GeneratorStats` (map→`sources: [PowerSource!]!`) (+ `generatorStatsHistory`) | `history_points` (`generatorStats`) |
| `PowerSource` | nested | `PowerSource { type count totalProduction }` | — |
| `SinkStats` (sink_stats.go) | LIVE + HISTORICAL | `SinkStats` (+ `sinkStatsHistory`) | `history_points` (`sinkStats`) |
| `ItemStats` (item_stats.go) | shared leaf | `ItemStats { name count }` | — |

### Live power

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `Circuit` (circuit.go) | LIVE + HISTORICAL | `Circuit` (`circuits` query, `circuitsChanged` sub, `circuitsHistory` query) | `history_points` (`circuits`, JSON = `[]Circuit`) |
| `CircuitConsumption/Production/Capacity/Battery` | nested | nested object types | — |
| `Cable` (cable.go) | LIVE (slow) | `Cable` (`cables` query, `cablesChanged` sub) | — |
| `PowerInfo` (power_info.go) | nested helper | flattened onto `HypertubeEntrance` | — |
| `CircuitIDs` (circuit_ids.go) | mixin | flatten → `circuitId: Int` + `circuitGroupId: Int` on each host | — |

### Live vehicles & stations

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `Drone` (drone.go) | LIVE | `Drone` (flatten `Location`/`CircuitIDs`) | — |
| `DroneStation` (drone_station.go) | LIVE | `DroneStation` | — |
| `Train` (train.go) | LIVE | `Train` (`vehicles`, `timetable`) | — |
| `TrainVehicle`, `TrainTimetableEntry` | nested | nested object types | — |
| `TrainStation` (train_station.go) | LIVE | `TrainStation` (`platforms`) | — |
| `TrainStationPlatform` | nested | nested object type | — |
| `Truck` (truck.go) | LIVE | `Truck` | — |
| `TruckStation` (truck_station.go) | LIVE | `TruckStation` | — |
| `Tractor` (tractor.go) | LIVE | `Tractor` | — |
| `Explorer` (explorer.go) | LIVE | `Explorer` | — |
| `VehiclePath` (vehicle_path.go) | LIVE | `VehiclePath` | — |
| `Vehicles` (vehicles.go) | DTO bundle | drop — fields become `trains/drones/trucks/tractors/explorers` queries + `*Changed` subs | — |
| `VehicleStations` (vehicles.go) | DTO bundle | drop — fields become `trainStations/droneStations/truckStations` | — |
| `Fuel` (fuel.go) | nested helper | `Fuel { name amount }` (GraphQL `name` despite Go `json:"Name"`) | — |

### Live infrastructure

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `Belt` (belt.go) | LIVE (slow) | `Belt` | — |
| `Belts` (belt.go) | DTO bundle | drop — `belts` + `splitterMergers` | — |
| `Pipe` (pipe.go) | LIVE | `Pipe` | — |
| `Pipes` (pipe.go) | DTO bundle | drop — `pipes` + `pipeJunctions` | — |
| `PipeJunction` (pipe_junction.go) | LIVE | `PipeJunction` | — |
| `SplitterMerger` (splitter_merger.go) | LIVE | `SplitterMerger` | — |
| `TrainRail` (train_rail.go) | LIVE | `TrainRail` | — |
| `Hypertube` (hypertube.go) | LIVE | `Hypertube` | — |
| `HypertubeEntrance` (hypertube.go) | LIVE | `HypertubeEntrance` (PowerInfo flattened) | — |
| `Hypertubes` (hypertube.go) | DTO bundle | drop — `hypertubes` + `hypertubeEntrances` | — |
| `Storage` (storage.go) | LIVE | `Storage` | — |
| `Machine` (machine.go) | LIVE | `Machine` (`input`/`output`) | — |
| `MachineProdStats` (machine.go) | nested | nested object type | — |

### Live progression / world

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `SpaceElevator` (space_elevator.go) | LIVE | `SpaceElevator` | — |
| `SpaceElevatorPhaseObjective` | nested | nested object type | — |
| `Hub` (hub.go) | LIVE | `Hub { ... shipReturnTime: Int }` (Int, not Int64) | — |
| `HubMilestone`, `HubMilestoneCost` | nested | nested object types | — |
| `Schematic` (schematic.go) | LIVE | `Schematic` (the "unlockables" data) | — |
| `SchematicCost` | nested | nested object type | — |
| `RadarTower` (radar_tower.go) | LIVE | `RadarTower` | — |
| `ResourceNode` (radar_tower.go) | LIVE | `ResourceNode` (`resourceForm: String!`, see fit note 7) | — |
| `ScannedFauna/Flora/Signal` | nested | nested object types (FaunaType/FloraType/SignalType enums) | — |

### Shared geometry & player

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `Location` (location.go) | shared leaf + mixin | `Location { x y z rotation }` (mixin usages flatten to a `location:` field) | — |
| `BoundingBox` (location.go) | shared leaf | `BoundingBox { min max }` | — |
| `Player` (player.go) | LIVE | `Player` (`players` query, `playersChanged` sub) | — |

### Historical / time-series

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `DataPoint` (data_point.go) | HISTORICAL | NOT a single GraphQL type — fans out to the five concrete `<Type>HistoryPoint` types; `Data any` decoded server-side | `history_points (session_id, save_name, data_type, game_time_id, data)` — composite PK, no surrogate id, no recorded_at |
| `HistoryChunk` (history_chunk.go) | DTO | **drop** (FORBIDDEN) — replaced by `[<Type>HistoryPoint!]!` returns | — |
| `HistorySavesResponse` (history_chunk.go) | DTO | **drop** — replaced by `historySaves: [String!]!` | — |
| `GameTimeOffset` (game_time.go) | in-memory | not exposed; poller-internal `GameTimeTracker` state | — |

### Config / entities

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| `Session` (session.go) | CONFIG | `Session` (`stage`/`isOnline`/`isDisconnected` are resolver fields from poller memory; `consecutiveFailures` not exposed) | `sessions (id, name, address, session_name, is_paused, created_at)` |
| `SessionDTO` (session.go) | DTO | drop — folded into `Session` + resolver `stage` | — |
| `SessionStage` enum | ENUM | `enum SessionStage { INIT READY }` (resolver-computed) | — |
| `RequiredEventTypes` var | logic const | not a type; stays poller-internal | — |
| `CreateSessionRequest` | DTO→input | `input CreateSessionInput { name address }` | — |
| `UpdateSessionRequest` | DTO→input | `input UpdateSessionInput { name? isPaused? address? }` | — |
| `Settings` (settings.go) | CONFIG | `Settings { logLevel }` | `settings (key, value)` key/value rows (`UpsertSetting` ON CONFLICT) |
| `LogLevel` enum | ENUM | `enum LogLevel { TRACE DEBUG INFO WARNING ERROR }` | — |
| `SettingsChange` (settings.go) | DTO | drop (`any` diff record) | — |
| `SettingsChangedEvent` (settings.go) | LIVE/transport | dropped from the wire; settings changes are surfaced by refetch after `updateSettings` (no `settingsChanged` subscription) | — |

> Frontend note: the existing `historyDataRange` / `historyWindowSize` chart controls
> (`dashboard/src/types.ts`, `research/history-persistence.md` §7) are **client-only UI preferences**, not
> backend `Settings`. They stay in browser localStorage. They drive the `since`/`maxPoints` query arguments;
> they are NOT added to the `settings` table (which remains just `logLevel`).

### Auth

There is no `User` model; auth is single-shared-password (hashed) + access tokens (feature 001, currently in
Redis). Target SQLite: a singleton password row + a tokens table (decision E-7).

**Auth cutover = CLEAN WIPE (decision D-A — see the prominent release note below).** There is NO
Redis→SQLite migration of password or tokens. On first SQLite boot the DB is empty and auth re-bootstraps.

| Go model | Class | GraphQL type | sqlc table |
|---|---|---|---|
| (no `User` struct) | CONFIG | — | `auth_password (id PK CHECK(id=1), hash, is_default, updated_at)` singleton; `auth_tokens (token PK, created_at, last_used, expires_at, client_ip)` |
| `LoginRequest` | DTO→input | `input LoginInput { password }` | — |
| `LoginResponse` | DTO→payload | `type LoginResult { success usedDefaultPassword }` | — |
| `AuthStatusResponse` | DTO→query | `type AuthStatus { authenticated usedDefaultPassword }` | — |
| `ChangePasswordRequest` | DTO→input | `input ChangePasswordInput { currentPassword newPassword }` | — |
| `ChangePasswordResponse` | DTO→payload | `type ChangePasswordResult { success message }` | — |
| `LogoutResponse` | DTO→payload | `type LogoutResult { success }` | — |

### Events / transport (eventbus + REST envelopes)

| Go model | Class | Disposition |
|---|---|---|
| `SatisfactoryEventType` (satisfactory_event.go) | ENUM | internal eventbus discriminator + `history_points.data_type` (plain TEXT, NO sqlc override). NOT a GraphQL enum. The narrow `HistoryDataType` (5 values) is the only event-type-ish enum declared, used only inside the history resolver. |
| `SatisfactoryEvent` (satisfactory_event.go) | eventbus envelope | becomes the Go channel `Event{Type, Payload any, GameTimeID}` (plan 05). Bridged to `<domain>Changed` subscriptions; the envelope is never serialized. |
| `SseSatisfactoryEvent` (satisfactory_event.go) | DTO | drop (graphql-ws owns per-subscription delivery) |
| `NodeInfo`, `SessionLease`, `NodesResponse` (nodes.go) | distributed | **DELETE** (plan 02) |
| `BindingError`, `ErrorResponse`, `ApiError` (error.go) | REST envelope | **DELETE** (GraphQL error model + error presenter) |
| `SatisfactoryApiError` (Go error) | internal | keep Go-internal only; never a GraphQL type |
| `status_codes` package | REST envelope | **DELETE** |
| all `frm_models/*` + `SessionInfoRaw` | RAW-FRM | untouched; poller-internal. `SessionInfo` (camelCase) feeds `Session.sessionName` and the `SessionInfo` GraphQL type used by `previewSession`/`validateSession`. |

## SQLite schema (authoritative columns; 04 turns these into migrations)

```sql
CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    address      TEXT NOT NULL,
    session_name TEXT NOT NULL DEFAULT '',
    is_paused    INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- decision E-7: single-row password + superset token columns
CREATE TABLE auth_password (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    hash       TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_tokens (
    token      TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    client_ip  TEXT NOT NULL DEFAULT ''
);

-- decision E-6: history_points, composite PK, JSON data, NO surrogate id, NO recorded_at
CREATE TABLE history_points (
    session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    save_name    TEXT NOT NULL,
    data_type    TEXT NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT NOT NULL,
    PRIMARY KEY (session_id, save_name, data_type, game_time_id)
);

CREATE INDEX idx_history_points_range
    ON history_points (session_id, save_name, data_type, game_time_id);
```

Design points:
- The **composite PK** `(session_id, save_name, data_type, game_time_id)` replicates the Redis
  ZSET-member-is-game-time overwrite-on-same-game-time dedup (rollback handling,
  `research/history-persistence.md` §5). `UpsertHistoryPoint` writes
  `INSERT … ON CONFLICT(session_id, save_name, data_type, game_time_id) DO UPDATE SET data = excluded.data`
  (upsert on same game-time).
- `ON DELETE CASCADE` from `sessions` replaces both the Redis `ClearHistoryData` sweep and the
  `deleted-session` tombstone (the tombstone existed only to stop multiple distributed pollers writing after
  delete; with one in-process poller + FK cascade it is unnecessary — plans 02/03).
- A `PRIMARY KEY` on those columns is itself a covering index, and `idx_history_points_range` serves the range
  read (`WHERE session_id=? AND save_name=? AND data_type=? AND game_time_id > :since ORDER BY game_time_id`)
  and the prune (`DELETE … WHERE … AND game_time_id <= :cutoff`). 04 may collapse the explicit index into the
  PK if the PK ordering already covers these reads; ship at most one extra index.
- `save_name` participates in the PK (decision E-11), replacing the Redis key-prefix partitioning from commit
  `0a12da8`.

sqlc query set (names 04 generates): `UpsertHistoryPoint` (`:exec`, upsert), `ListHistorySaves` (`:many`,
`SELECT DISTINCT save_name`), `GetLatestGameTimeId` (`:one`), `QueryHistoryRaw` (`:many`), `QueryHistoryBucketed`
(`:many`, keep-last bucketing), `PruneHistoryOlderThan` (`:execrows`), `RunTokenPrune` for the periodic token
sweep, plus the session/settings/auth CRUD (`UpsertSetting`, `GetAuthPassword`/`SetAuthPassword`,
`InsertToken`/`GetToken`/`TouchToken`/`DeleteToken`).

sqlc overrides (`sqlc.yaml`) — leaf packages only (decision E-5; resolves C7):
```yaml
overrides:
  - column: "sessions.id"
    go_type: "github.com/.../api/internal/session.ID"
  - column: "history_points.session_id"
    go_type: "github.com/.../api/internal/session.ID"
  - column: "auth_tokens.token"
    go_type: "github.com/.../api/internal/auth.Token"
```
`internal/session.ID` and `internal/auth.Token` are dependency-free `type X string` aliases living in leaf
packages to avoid import cycles. **`history_points.data_type` is deliberately NOT overridden** — it stays
`TEXT` (Go `string`) in the store; the resolver maps it to the `HistoryDataType` GraphQL enum. There is no
`models.*` override table (the old draft's `models.SessionID` / `models.SatisfactoryEventType` overrides are
removed).

Auth read path (decision E-7): lazy `expires_at > now` check on token read + a periodic `RunTokenPrune`
(~1 h) that deletes expired rows; `last_used` is bumped on each successful validation (sliding expiration);
`client_ip` gives the login rate-limiter its context.

## The canonical `make generate` recipe (decision E-8; owned by this doc)

This doc OWNS the single `make generate` pipeline. The ordering is fixed because each step consumes the
previous step's output:

```make
generate:
	cd api && go tool gqlgen generate    # (1) emits resolver stubs + api/schema.graphql consumers; the
	                                      #     schema is the contract the frontend codegen reads
	cd api && sqlc generate               # (2) regenerates internal/store/sqlite/* from queries + migrations
	cd dashboard && bun run codegen       # (3) @graphql-codegen/client-preset reads gqlgen's schema.graphql
```

(1) before (3) because the frontend `client-preset` codegen reads the same `api/schema.graphql` that gqlgen
validates/uses; (2) is independent of (1)/(3) but is folded into the one recipe so a single `make generate`
brings every generated surface back in sync.

### tygo retirement (resolves B2)

- **DELETE** `api/export/tygo.yml` and the `api/export/` dir (nothing else lives there).
- **DELETE** `dashboard/src/apiTypes.ts`. All imports redirect to the codegen output (`dashboard/src/gql/` from
  `client-preset`). `dashboard/src/types.ts` keeps only UI-only types (the range/window presets); domain types
  come from `gql/`. (Large mechanical change tracked by plan 07; the type-source swap is owned here.)
- **Remove** the tygo dependency from `api` tooling. Add the gqlgen `tool` directive to `api/go.mod`
  (`tool github.com/99designs/gqlgen`) per `research/ref-graphql.md` §1; sqlc runs via the pinned `sqlc`
  binary (`research/ref-store.md` §9) with a `make sqlc-check` drift guard wired into the pre-commit aggregate.
- **Restate the CLAUDE.md rule.** Today CLAUDE.md says "run `make generate` after any changes to Go model
  structs." After the refactor this means: run the three-step pipeline above after any change to
  `api/schema.graphql` OR to `internal/store/queries/*.sql` / `internal/store/migrations/*.sql`. 06/07 update
  the wording in root `CLAUDE.md`, `api/CLAUDE.md`, and `dashboard/CLAUDE.md`. (The same edit deletes the stale
  mock-mode references — decision D-D.)

Because tygo dumped the entire models package, it currently leaks DTO aliases, REST envelopes,
`SessionInfoRaw`, and the node/lease types into TS. The GraphQL schema exposes ONLY the real domain types —
that narrowing is a feature of this migration, not a regression.

## Tests (decision E-10, recommended light scope)

Keep the planned Go unit tests — migrations up/down (`research/ref-store.md` §4c), eventbus fan-out/teardown,
subscription teardown (`research/ref-graphql.md` §9). ADD a minimal automated e2e smoke (boot → one typed
query + one mutation + one `<domain>Changed` subscription round-trip) and a CI migration up/down check. This is
the RECOMMENDED light scope; the manual two-session run remains the functional gate. (No heavy testing is
mandated.)

## RELEASE / UPGRADE NOTE — auth clean wipe (decision D-A; prominent on purpose)

This refactor replaces Redis with SQLite as the auth store. **There is NO migration of the existing password
or access tokens.** On first boot against an empty SQLite DB:

- auth re-bootstraps to `SD_BOOTSTRAP_PASSWORD` (default `"change-me"`) with `is_default = 1`;
- all previously issued access tokens are gone (every client must log in again);
- **the operator MUST re-set their password after upgrade.**

This is an EXPLICIT, user-approved decision (closes critic B4 / decision D.1) — it is a clean cutover, not an
accidental loss of backward compatibility. 01/02/06 must surface this in the deployment/upgrade docs.

## Models that do not cleanly fit — flagged with recommended resolution

1. **`Session` runtime-derived fields (`isOnline`, `isDisconnected`, `stage`, `consecutiveFailures`).** Poller
   runtime state, not durable config. `consecutiveFailures` is `json:"-"` (never exposed). Resolution: do NOT
   persist them; only `id/name/address/session_name/is_paused/created_at` are columns. The GraphQL `Session`
   exposes `isOnline`/`isDisconnected`/`stage` as **resolver fields** read from the poller's in-memory map;
   `connectivityChanged` streams them live. (04/06 confirm the resolver reads the poller, not the DB, for
   status.)
2. **`SatisfactoryEvent.Data any` (eventbus payload).** Cannot be a GraphQL field. Resolution: per-domain
   `<domain>Changed` subscriptions; the `any` lives only inside the Go channel envelope.
3. **`DataPoint.Data any` (history blob).** Stored as `data TEXT` (JSON) in `history_points`; surfaced via the
   five concrete `<Type>HistoryPoint` types; resolver `json.Unmarshal`s per `data_type`. The `any` never
   crosses GraphQL.
4. **`GeneratorStats.Sources map[PowerType]PowerSource`.** No GraphQL map. Resolution: `sources: [PowerSource!]!`
   with the key promoted to a `type` field. The SQLite JSON blob may keep the map shape; resolver and live
   poller both convert via ONE shared mapper so both paths agree. (Action for 06.)
5. **`*Setup` / bundle DTOs (`Vehicles`, `VehicleStations`, `Belts`, `Pipes`, `Hypertubes`, `TrainSetupDTO`,
   `DroneSetupDTO`).** REST convenience aggregations. Resolution: delete; GraphQL clients select multiple
   queries/subscriptions in one document (`research/rest-surface.md` obs. 2).
6. **`Fuel.Name` PascalCase JSON tag (`json:"Name"`).** Inconsistency in the current model. Resolution: the
   GraphQL field is `name` regardless of the Go tag, because gqlgen runs `autobind: []` and the resolver maps
   the field explicitly. No client-visible artifact.
7. **`ResourceNode.ResourceForm string` vs typed `ResourceType`/`NodeType`.** `ResourceForm` is a free string
   today. Resolution: keep `resourceForm: String!` (do not invent an enum the backend doesn't produce). Flag
   for the schema author; if the FRM values are a closed set, a follow-up can enum it.

## Resolved contradictions (where the OLD 08 disagreed with 04/06/07)

The previous draft of this doc held several positions that contradicted the sibling plans. Each is now resolved
in this rewrite; recorded so a reader sees the change is intentional:

- **C1 — history table name.** Old draft: `history_samples` with a surrogate `id INTEGER AUTOINCREMENT` and a
  `recorded_at` column. **Resolved (E-6):** the table is `history_points` with a composite PK
  `(session_id, save_name, data_type, game_time_id)`, a JSON `data` column, NO surrogate id, NO `recorded_at`.
- **C2 — one history shape vs five.** Old draft mixed a single `HistoryPoint { data: HistoryData }` /
  `HistoryChunk` envelope with an interface. **Resolved (D-C, C2):** five concrete `<Type>HistoryPoint` types,
  one `<domain>History` query each, no interface, no `HistoryChunk`.
- **C3 — opaque payload on the wire.** Old draft discussed a `HistoryData` interface / opaque `data`.
  **Resolved (D-C, C3):** FORBIDDEN — fully typed per-type, no opaque field crosses GraphQL.
- **C4 — Int64 scalar.** Old draft flagged but left the `Int64` question open. **Resolved (E-2):** keep
  built-in `Int`; NO `Int64` scalar in the SDL or `gqlgen.yml`.
- **C7 — sqlc overrides.** Old draft overrode `data_type` to `models.SatisfactoryEventType` and used
  `models.SessionID`. **Resolved (E-5):** override only `session_id`→`internal/session.ID` and
  `auth_tokens.token`→`internal/auth.Token` (leaf packages); `data_type` stays TEXT, mapped to the GraphQL
  enum in the resolver. No `models.*` override table.
- **C8 — auth tables.** Old draft: `auth_credentials (used_default)` + minimal `auth_tokens (token, created_at,
  expires_at)`. **Resolved (E-7):** `auth_password (hash, is_default, updated_at)` singleton +
  `auth_tokens (token, created_at, last_used, expires_at, client_ip)` superset.
- **C9 — union/interface for history.** Old draft considered a union/interface. **Resolved (C9, D-C):** no
  union, no interface, no `__typename` narrowing — one concrete type per query/subscription.
- **B1 — mock mode.** Old draft was silent on mock mode while CLAUDE.md referenced it. **Resolved (D-D):** mock
  mode is dropped; stale references in root/api CLAUDE.md are deleted; no mock poller exists.

## How this satisfies the done-criteria

- **No Redis / No REST / No SSE / No distributed polling.** Every Go model is classified and routed: RAW-FRM
  stays poller-internal, LIVE → eventbus + `<domain>Changed` subscription, HISTORICAL+CONFIG+auth → SQLite, and
  the lease/node/REST-envelope/SSE-wrapper types are explicitly DELETED, not migrated.
- **sqlc + migration files.** This doc fixes the exact table/column/index set, the composite-PK `history_points`
  table, and the leaf-package sqlc overrides that 04 turns into numbered migrations and generated queries.
- **GraphQL replaces all polling — history AND live, fully typed.** The catalog maps every type to a typed
  snapshot query, a `<domain>History` query, a `<domain>Changed` subscription, or "drop". No `liveState`, no
  `HistoryChunk`, no opaque scalar.
- **UI fetching is GraphQL-native.** tygo + `apiTypes.ts` are retired in favor of the three-step `make generate`
  (gqlgen → sqlc → client-preset), so the frontend's types come straight from the schema this document defines.
