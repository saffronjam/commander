# Domain Model Inventory

Research for the GraphQL schema + sqlc table design. Read-only inventory of every significant
Go type across the three model namespaces:

- `api/models/models/*.go` — the **internal/app models** (camelCase JSON, tygo-exported to TS).
- `api/service/frm_client/frm_models/models.go` — the **raw FRM game-API shapes** (PascalCase JSON, internal only, never exported to TS).
- `api/export/tygo.yml` — the current Go->TS generator config that GraphQL codegen replaces.

## Classification legend

- **LIVE** — streamed game state; produced by the poller, currently cached in Redis (`state:{sessionID}:{eventType}`) and pushed via SSE. In the target: lives in channels/eventbus -> GraphQL subscription, plus an initial GraphQL query for first paint. Generally NOT persisted (ephemeral).
- **HISTORICAL** — time-series sample persisted across time. Target: SQLite tables, queried via GraphQL history queries.
- **CONFIG/ENTITY** — durable rows (session, settings, auth/user). Target: SQLite tables, GraphQL queries + mutations.
- **RAW-FRM** — wire shape of the FRM mod's HTTP API. Internal to the poller only; never reaches GraphQL or the DB. Translated into LIVE app models.
- **TRANSPORT/DTO** — request/response/envelope shapes with no independent persistence. In GraphQL these become input types, payload types, or disappear entirely (REST envelopes/error wrappers are replaced by GraphQL's own error model).

Note on **DTO aliasing**: `api/models/models/dto.go` declares ~30 type *aliases* (`type CircuitDTO = Circuit`, etc.) plus a few composite DTO structs. The aliases are pure identity (`=`), an artifact of the REST layer, and carry no extra fields. They should be DROPPED entirely in the GraphQL design — there is exactly one type per concept.

---

## Catalog: Internal app models (`api/models/models/`)

### Live state — top-level container

| Type | Classification | Notes |
|------|----------------|-------|
| `State` (state.go) | LIVE (aggregate) | The full snapshot object: embeds `SatisfactoryApiStatus`, `FactoryStats`, `ProdStats`, `GeneratorStats`, `SinkStats`, and slices of every live entity (Circuits, Players, Drones, Trains, TrainStations, DroneStations, Belts, Pipes, PipeJunctions, TrainRails, SplitterMergers, Hypertubes, HypertubeEntrances, Cables, Storages, Machines, Tractors, Explorers, VehiclePaths, `*SpaceElevator`, `*Hub`, RadarTowers, ResourceNodes, Schematics). This is the GraphQL `state` query root and the unit assembled from per-eventType cache reads in `session/cache.go`. |
| `StateDTO` = `State` (dto.go) | TRANSPORT/DTO | Alias only. Drop. |

### Live state — stats (scalar aggregates; also HISTORICAL candidates)

| Type | Fields | Classification |
|------|--------|----------------|
| `SatisfactoryApiStatus` (api_status.go) | `Running bool`, `PingMS int` | LIVE (health/transport). Per-session connection health; ephemeral. |
| `FactoryStats` (factory_stats.go) | `TotalMachines int`, `Efficiency MachineEfficiency` | LIVE + **HISTORICAL** (event type `factoryStats` is in the history set). |
| `MachineEfficiency` | `MachinesOperating/Idle/Paused/Unconfigured/Unknown int` | nested in FactoryStats |
| `ProdStats` (prod_stats.go) | `MinableProducedPerMinute`, `MinableConsumedPerMinute`, `ItemsProducedPerMinute`, `ItemsConsumedPerMinute float64`, `Items []ItemProdStats` | LIVE + **HISTORICAL** (`prodStats`). |
| `ItemProdStats` | embeds `ItemStats`; `ProducedPerMinute`, `MaxProducePerMinute`, `ProduceEfficiency`, `ConsumedPerMinute`, `MaxConsumePerMinute`, `ConsumeEfficiency`, `CloudCount float64`, `Minable bool` | nested |
| `GeneratorStats` (generator_stats.go) | `Sources map[PowerType]PowerSource` | LIVE + **HISTORICAL** (`generatorStats`). **Map-typed field** — GraphQL has no map; model as a list of `{ type: PowerType, count, totalProduction }`. |
| `PowerSource` | `Count int`, `TotalProduction float64` | nested |
| `SinkStats` (sink_stats.go) | `TotalPoints float64`, `Coupons int`, `NextCouponProgress`, `PointsPerMinute float64` | LIVE + **HISTORICAL** (`sinkStats`). |
| `ItemStats` (item_stats.go) | `Name string`, `Count float64` | shared inventory leaf, embedded widely |

### Live state — power

| Type | Fields | Classification |
|------|--------|----------------|
| `Circuit` (circuit.go) | `ID string`, `FuseTriggered bool`, `Consumption CircuitConsumption`, `Production CircuitProduction`, `Capacity CircuitCapacity`, `Battery CircuitBattery` | LIVE + **HISTORICAL** (`circuits`). |
| `CircuitConsumption` | `Total`, `Max float64` | nested |
| `CircuitProduction` | `Total float64` | nested |
| `CircuitCapacity` | `Total float64` | nested |
| `CircuitBattery` | `Percentage`, `Capacity`, `Differential`, `UntilFull`, `UntilEmpty float64` | nested |
| `Cable` (cable.go) | `ID`, `Name`, `Location0/1`, `Connected0/1 bool`, `Length float64` | LIVE (infra, 120s poll). |
| `PowerInfo` (power_info.go) | `CircuitID`, `CircuitGroupID int`, `PowerConsumed`, `MaxPowerConsumed float64` | nested helper |
| `CircuitIDs` (circuit_ids.go) | `CircuitID int`, `CircuitGroupID *int` | **embedded mixin** (`tstype:",extends"`) on many entities. Flatten into each GraphQL type. |

### Live state — vehicles & stations

| Type | Key fields | Classification |
|------|-----------|----------------|
| `Drone` (drone.go) | `Name`, `Speed`, `Status DroneStatus`, `Home DroneStation`, `Paired/Destination *DroneStation`, `CircuitID/GroupID`, embeds `Location`+`CircuitIDs` | LIVE |
| `DroneStation` (drone_station.go) | `Name`, `Fuel *Fuel`, `BoundingBox`, `IncomingRate`, `OutgoingRate`, `InputInventory/OutputInventory []ItemStats`, embeds `Location`+`CircuitIDs` | LIVE |
| `Train` (train.go) | `ID`, `Name`, `Speed`, `Status TrainStatus`, `PowerConsumption`, `Vehicles []TrainVehicle`, `Timetable []TrainTimetableEntry`, `TimetableIndex`, embeds `Location`+`CircuitIDs` | LIVE |
| `TrainVehicle` | `Type TrainType`, `Capacity`, `Inventory []ItemStats` | nested |
| `TrainTimetableEntry` | `Station string` | nested |
| `TrainStation` (train_station.go) | `Name`, `BoundingBox`, `Platforms []TrainStationPlatform`, embeds `Location`+`CircuitIDs` | LIVE |
| `TrainStationPlatform` | `ID`, `Type`, `Mode`, `Status`, `BoundingBox`, `Inventory []ItemStats`, `TransferRate`, `InflowRate`, `OutflowRate`, embeds `Location` | nested |
| `Truck` (truck.go) | `ID`, `Name`, `Speed`, `Status TruckStatus`, `Fuel *Fuel`, `Inventory []ItemStats`, embeds `Location`+`CircuitIDs` | LIVE |
| `TruckStation` (truck_station.go) | `Name`, `BoundingBox`, `TransferRate`, `MaxTransferRate`, `Inventory []ItemStats`, `CircuitID int`, embeds `Location`+`CircuitIDs` | LIVE |
| `Tractor` (tractor.go) | `ID`, `Name`, `Speed`, `Status TractorStatus`, `Fuel *Fuel`, `Inventory []ItemStats`, embeds `Location`+`CircuitIDs` | LIVE |
| `Explorer` (explorer.go) | `ID`, `Name`, `Speed`, `Status ExplorerStatus`, `Fuel *Fuel`, `Inventory []ItemStats`, embeds `Location`+`CircuitIDs` | LIVE |
| `VehiclePath` (vehicle_path.go) | `Name`, `VehicleType VehiclePathType`, `PathLength float64`, `Vertices []Location` | LIVE |
| `Vehicles` (vehicles.go) | `Trains/Drones/Trucks/Tractors/Explorers` slices | TRANSPORT/DTO — bundles vehicles for the `vehicles` SSE event. Likely collapse into `State` / subscription payload. |
| `VehicleStations` (vehicles.go) | `TrainStations/DroneStations/TruckStations` slices | TRANSPORT/DTO — same, for `vehicleStations` event. |
| `Fuel` (fuel.go) | `Name string` (JSON `"Name"` — note PascalCase tag), `Amount float64` | nested helper |

### Live state — infrastructure (slow 120s poll)

| Type | Key fields | Classification |
|------|-----------|----------------|
| `Belt` (belt.go) | `ID`, `Name`, `Location0/1`, `Connected0/1`, `SplineData []Location`, `Length`, `ItemsPerMinute` | LIVE |
| `Belts` (belt.go) | `Belts []Belt`, `SplitterMergers []SplitterMerger` | TRANSPORT/DTO (event bundle) |
| `Pipe` (pipe.go) | same shape as Belt | LIVE |
| `Pipes` (pipe.go) | `Pipes []Pipe`, `PipeJunctions []PipeJunction` | TRANSPORT/DTO |
| `PipeJunction` (pipe_junction.go) | `ID`, `Name`, embeds `Location` | LIVE |
| `SplitterMerger` (splitter_merger.go) | `ID`, `Type SplitterMergerType`, embeds `Location`, `BoundingBox` | LIVE |
| `TrainRail` (train_rail.go) | `ID`, `Type TrainRailType`, `Location0/1`, `Connected0/1`, `SplineData`, `Length` | LIVE |
| `Hypertube` (hypertube.go) | `ID`, `Location0/1`, `SplineData`, `BoundingBox` | LIVE |
| `HypertubeEntrance` (hypertube.go) | `ID`, embeds `Location`, `BoundingBox`, `PowerInfo` | LIVE |
| `Hypertubes` (hypertube.go) | `Hypertubes []Hypertube`, `HypertubeEntrances []HypertubeEntrance` | TRANSPORT/DTO |
| `Storage` (storage.go) | `ID`, `Type StorageType`, `Inventory []ItemStats`, `BoundingBox`, embeds `Location` | LIVE |
| `Machine` (machine.go) | `Type MachineType`, `Status MachineStatus`, `Category MachineCategory`, `Productivity float64`, `Input/Output []MachineProdStats`, `BoundingBox`, embeds `Location`+`CircuitIDs` | LIVE |
| `MachineProdStats` (machine.go) | `Name`, `Stored`, `Current`, `Max`, `Efficiency float64` | nested |

### Live state — progression / world

| Type | Key fields | Classification |
|------|-----------|----------------|
| `SpaceElevator` (space_elevator.go) | `ID`, `Name`, `BoundingBox`, `CurrentPhase []SpaceElevatorPhaseObjective`, `FullyUpgraded`, `UpgradeReady`, embeds `Location` | LIVE (semi-static; progression). |
| `SpaceElevatorPhaseObjective` | `Name`, `Amount`, `TotalCost` | nested |
| `Hub` (hub.go) | `ID`, `Name`, `HasActiveMilestone`, `ActiveMilestone *HubMilestone`, `ShipDocked`, `ShipReturnTime *int64`, `BoundingBox`, embeds `Location` | LIVE |
| `HubMilestone` (hub.go) | `Name`, `TechTier int`, `Type string`, `Cost []HubMilestoneCost` | nested |
| `HubMilestoneCost` (hub.go) | `Name`, `Amount`, `RemainingCost`, `TotalCost` | nested |
| `Schematic` (schematic.go) | `ID`, `Name`, `Tier int`, `Type string`, `Purchased`, `Locked`, `LockedPhase bool`, `Cost []SchematicCost` | LIVE (this is the "unlockables" feature data — no separate Unlockable type exists). |
| `SchematicCost` (schematic.go) | `Name`, `Amount`, `TotalCost` | nested |
| `RadarTower` (radar_tower.go) | `ID`, `RevealRadius`, `Nodes []ResourceNode`, `Fauna []ScannedFauna`, `Flora []ScannedFlora`, `Signal []ScannedSignal`, `BoundingBox`, embeds `Location` | LIVE |
| `ResourceNode` (radar_tower.go) | `ID`, `Name`, `ClassName`, `Purity ResourceNodePurity`, `ResourceForm string`, `ResourceType ResourceType`, `NodeType NodeType`, `Exploited bool`, embeds `Location` | LIVE |
| `ScannedFauna/Flora/Signal` | `Name <enum>`, `ClassName string`, `Amount int` | nested |

### Shared geometry leaves

| Type | Fields | Classification |
|------|--------|----------------|
| `Location` (location.go) | `X`, `Y`, `Z`, `Rotation float64` | shared leaf + embedded mixin (`tstype:",extends"`). Flatten into entities in GraphQL. |
| `BoundingBox` (location.go) | `Min Location`, `Max Location` | shared leaf |
| `Player` (player.go) | `ID`, `Name`, `Health float64`, `Items []ItemStats`, embeds `Location` | LIVE |

### Historical / time-series

| Type | Fields | Classification | Notes |
|------|--------|----------------|-------|
| `DataPoint` (data_point.go) | `GameTimeID int64`, `DataType string`, `Data any` | **HISTORICAL** (core persisted row) | Currently the value stored in Redis sorted-sets. `Data any` holds a `Circuit[]`/`FactoryStats`/`ProdStats`/`GeneratorStats`/`SinkStats` payload depending on `DataType`. In SQLite this becomes the central history table: `(save_name, data_type, game_time_id, data JSON)`. The `any` payload is a schema design decision — see open questions. |
| `HistoryChunk` (history_chunk.go) | `DataType string`, `SaveName string`, `LatestID int64`, `Points []DataPoint` | TRANSPORT/DTO | History query response envelope. Becomes a GraphQL query result type. |
| `HistorySavesResponse` (history_chunk.go) | `SaveNames []string`, `CurrentSave string` | TRANSPORT/DTO | Becomes a GraphQL query result. |
| `GameTimeOffset` (game_time.go) | `OffsetSeconds int64`, `ProbedAt time.Time` | LIVE/in-memory | In-process per-session cache to derive `GameTimeID`. Not exported to TS, not persisted today. Stays server-internal (poller computes `gameTimeId` for samples). |

### Config / entities (durable -> SQLite)

| Type | Fields | Classification | Notes |
|------|--------|----------------|-------|
| `Session` (session.go) | `ID`, `Name`, `Address`, `SessionName`, `IsOnline`, `IsPaused`, `IsDisconnected bool`, `ConsecutiveFailures int (json:"-")`, `CreatedAt time.Time` | **CONFIG/ENTITY** | The session row. `ConsecutiveFailures` is transient (runtime only). `IsOnline`/`IsDisconnected` are runtime-derived — decide persisted-vs-derived (open question). |
| `SessionDTO` (session.go) | Session fields minus `ConsecutiveFailures`, plus computed `Stage SessionStage` | TRANSPORT/DTO | REST response shape. In GraphQL, `stage` becomes a resolver field on the `Session` type; drop the separate DTO. |
| `SessionStage` enum (session.go) | `init`, `ready` | ENUM | Currently derived from cache presence of `RequiredEventTypes`. Becomes a resolver-computed field / poller-tracked state. |
| `RequiredEventTypes` (session.go) | `[]SatisfactoryEventType` var | logic constant | Drives stage computation; not a type. |
| `CreateSessionRequest` (session.go) | `Name`, `Address string` (required) | TRANSPORT/DTO -> GraphQL **input** | mutation `createSession` input. |
| `UpdateSessionRequest` (session.go) | `*Name`, `*IsPaused`, `*Address` (all optional) | TRANSPORT/DTO -> GraphQL **input** | mutation `updateSession` input (nullable fields = patch semantics). |
| `Settings` (settings.go) | `LogLevel LogLevel` | **CONFIG/ENTITY** | Single global settings row. |
| `LogLevel` enum (settings.go) | `Trace`, `Debug`, `Info`, `Warning`, `Error` | ENUM | Has `ToZapLevel()`/`IsValid()`/`ValidLogLevels`. |
| `SettingsChange` (settings.go) | `Field string`, `OldValue/NewValue any` | TRANSPORT/DTO | Diff record for change events. `any` values need GraphQL handling. |
| `SettingsChangedEvent` (settings.go) | `Settings Settings`, `Changes []SettingsChange` | LIVE/transport | Published on settings change (Redis pub/sub today). Becomes a GraphQL subscription payload or just refetch. |

### Auth (CONFIG/ENTITY + transport)

All in auth.go. Auth state today = hashed password + tokens in Redis (feature 001). Target: SQLite-stored hashed password + token/user table.

| Type | Fields | Classification |
|------|--------|----------------|
| `LoginRequest` | `Password string` (required) | TRANSPORT/DTO -> GraphQL **input** |
| `LoginResponse` | `Success`, `UsedDefaultPassword bool` | TRANSPORT/DTO -> mutation payload |
| `AuthStatusResponse` | `Authenticated`, `UsedDefaultPassword bool` | TRANSPORT/DTO -> query result |
| `ChangePasswordRequest` | `CurrentPassword`, `NewPassword string` (required) | TRANSPORT/DTO -> GraphQL **input** |
| `ChangePasswordResponse` | `Success bool`, `Message string` | TRANSPORT/DTO -> mutation payload |
| `LogoutResponse` | `Success bool` | TRANSPORT/DTO -> mutation payload |

Note: there is **no explicit `User` model**. Auth is single-shared-password. The hashed password + access tokens are the only persisted auth state; design a minimal `auth` (or `credential` + `token`) table in SQLite.

### Events (the SSE / eventbus envelope)

| Type | Fields | Classification | Notes |
|------|--------|----------------|-------|
| `SatisfactoryEventType` (satisfactory_event.go) | string enum, 25 values (see below) | ENUM | The discriminator for everything the poller emits. Maps 1:1 to cache keys, GET endpoints, and subscription channels. |
| `SatisfactoryEvent` (satisfactory_event.go) | `Type SatisfactoryEventType`, `Data any`, `GameTimeID int64` | TRANSPORT/eventbus | The bus message. In the target, this is the Go channel payload; the GraphQL subscription bridges it. `Data any` is union-typed by `Type` — GraphQL needs a union or per-type subscriptions (open question). |
| `SseSatisfactoryEvent` (satisfactory_event.go) | embeds `SatisfactoryEvent`, `ClientID int64` | TRANSPORT/DTO | SSE-specific wrapper (per-client). Drop in GraphQL (graphql-ws handles per-subscription delivery). |

### Distributed-polling artifacts (to be DELETED, listed for awareness)

These exist only because of the Redis-lease/multi-node design that the refactor removes. They should NOT
appear in the GraphQL schema or SQLite. Flagged so the schema author does not model them.

| Type (nodes.go) | Classification |
|------|----------------|
| `NodeInfo` (`InstanceID`, `IsThisInstance`, `Status`, `OwnedSessions []SessionLease`) | DELETE (distributed only) |
| `SessionLease` (`SessionID`, `SessionName`, `OwnerID`, `PreferredOwnerID`, `State`, `AcquiredAt/LastRenewedAt/UncertainSince time.Time`) | DELETE (lease/rendezvous-hashing) |
| `NodesResponse` (`ThisInstanceID`, `LiveNodes []NodeInfo`, `Timestamp`) | DELETE (GET /v1/nodes) |

### REST envelopes / errors (replaced by GraphQL's error model)

| Type (error.go) | Classification |
|------|----------------|
| `BindingError` (`ValidationErrors map[string][]string`) | TRANSPORT/DTO — drop |
| `ErrorResponse` (`Errors []ApiError`) | TRANSPORT/DTO — drop |
| `ApiError` (`Code`, `Msg string`) | TRANSPORT/DTO — drop |
| `SatisfactoryApiError` (Go error type, `Message string`) | internal error type — keep as Go-internal only |
| `status_codes` package (`Unknown=0`, `Success=20001`, `InvalidParams=20002`, `Error=20004`, `ValidationFailed=20005`, `MsgFlags`, `GetMsg`) | TRANSPORT — REST status-code envelope, drop entirely under GraphQL. |

---

## `SatisfactoryEventType` — full enum (the live-data discriminator)

`satisfactoryApiCheck`, `circuits`, `factoryStats`, `prodStats`, `sinkStats`, `players`,
`generatorStats`, `vehicles`, `vehicleStations`, `sessionUpdate`, `belts`, `pipes`, `trainRails`,
`cables`, `storages`, `machines`, `tractors`, `explorers`, `vehiclePaths`, `spaceElevator`, `hub`,
`radarTowers`, `resourceNodes`, `hypertubes`, `schematics`.

Plus the Redis key constant `SatisfactoryEventKey = "satisfactory_events"` (pub/sub channel base name — drop with Redis).

The **HISTORICAL subset** (persisted as `DataPoint`s, from `RequiredEventTypes` minus non-sample types) is exactly the five sample types with `GameTimeID != 0`: `circuits`, `factoryStats`, `prodStats`, `generatorStats`, `sinkStats` (confirmed by `DataPoint.DataType` doc comment in data_point.go). Everything else is LIVE-only.

`RequiredEventTypes` (for session "ready" stage): `satisfactoryApiCheck`, `circuits`, `factoryStats`, `prodStats`, `generatorStats`, `sinkStats`, `players`, `belts`, `pipes`, `trainRails`, `cables`.

---

## Full enum inventory (-> GraphQL enums)

| Enum | Values | File |
|------|--------|------|
| `SatisfactoryEventType` | (25, listed above) | satisfactory_event.go |
| `SessionStage` | init, ready | session.go |
| `LogLevel` | Trace, Debug, Info, Warning, Error | settings.go |
| `DroneStatus` | idle, flying, docking | drone.go |
| `TrainType` | freight, locomotive | train.go |
| `TrainStatus` | selfDriving, manualDriving, parked, docking, derailed, unknown | train.go |
| `TrainStationPlatformType` | freight, fluidFreight | train_station.go |
| `TrainStationPlatformMode` | import, export | train_station.go |
| `TrainStationPlatformStatus` | idle, docking | train_station.go |
| `TruckStatus` | selfDriving, manualDriving, parked, unknown | truck.go |
| `TractorStatus` | selfDriving, manualDriving, parked, unknown | tractor.go |
| `ExplorerStatus` | selfDriving, manualDriving, parked, unknown | explorer.go |
| `VehiclePathType` | Explorer, Factory Cart, Truck, Tractor | vehicle_path.go |
| `MachineType` | assembler, constructor, foundry, manufacturer, refinery, smelter, blender, packager, particleAccelerator, miner, oilExtractor, waterExtractor, biomassBurner, coalGenerator, fuelGenerator, geothermalGenerator, nuclearPowerPlant | machine.go |
| `MachineCategory` | factory, extractor, generator | machine.go |
| `MachineStatus` | operating, idle, paused, unconfigured, unknown | machine.go |
| `PowerType` | biomass, coal, fuel, geothermal, nuclear, unknown | generator_stats.go |
| `StorageType` | Blueprint Storage Box, Dimensional Depot Uploader, Industrial Storage Container, Personal Storage Box, Storage Container | storage.go |
| `SplitterMergerType` | Conveyor Merger, Conveyor Splitter, Programmable Splitter, Smart Splitter | splitter_merger.go |
| `TrainRailType` | Railway | train_rail.go |
| `ResourceNodePurity` | Impure, Normal, Pure | radar_tower.go |
| `ResourceType` | Iron Ore, Copper Ore, Limestone, Coal, SAM, Sulfur, Caterium Ore, Bauxite, Raw Quartz, Uranium, Crude Oil, Geyser, Nitrogen Gas | radar_tower.go |
| `NodeType` | Node, Geyser, Fracking Core, Fracking Satellite | radar_tower.go |
| `FaunaType` | (14 species values, human-readable strings) | radar_tower.go |
| `FloraType` | (10 values) | radar_tower.go |
| `SignalType` | Somersloop, Mercer Sphere, Blue/Yellow/Purple Power Slug, Hard Drive | radar_tower.go |

**GraphQL enum caveat**: many enum *values* contain spaces (`"Iron Ore"`, `"Fracking Core"`, `"Conveyor Merger"`, `"Space Giraffe-Tick-Penguin-Whale Thing"`). GraphQL enum names must match `/[_A-Za-z][_0-9A-Za-z]*/` — no spaces/hyphens. gqlgen needs a name<->value mapping (enum value bound to a Go const) so the wire value stays the human string while the GraphQL name is an identifier. This is a concrete codegen task for the schema author.

---

## Catalog: RAW-FRM models (`frm_models/models.go`) — all RAW-FRM

These are the FRM mod's HTTP response shapes (PascalCase JSON, e.g. `CircuitID`, `PowerConsumed`).
They are translated to internal models inside `frm_client` and are **never** serialized to TS, GraphQL,
or SQLite. They remain a pure poller-internal concern. Listed for completeness:

`Location`, `BoundingBox`, `PowerInfo`, `ItemAmount`, `Production`, `Ingredient`, `Extractor`,
`FactoryMachine`, `Generator`, `Circuit`, `ProdStatItem`, `WorldInvItem`, `CloudInvItem`, `SinkData`,
`Player`, `TrainTimeTableEntry`, `TrainVehicle`, `Train`, `InventoryItem`, `TrainStationPlatform`,
`TrainStation`, `Drone`, `TruckFuel`, `Truck`, `DroneStationFuel`, `DroneStation`, `TruckStation`,
`Belt`, `Pipe`, `PipeJunction`, `TrainRail`, `SplitterMerger`, `Cable`, `StorageInventoryItem`,
`Storage`, `Tractor`, `Explorer`, `VehiclePathVertex`, `VehiclePath`, `SpaceElevatorPhase`,
`SpaceElevator`, `ScannedResourceNode`, `ResourceNode`, `ScannedFauna`, `ScannedFlora`,
`ScannedSignal`, `RadarTower`, `Hypertube`, `HypertubeEntrance`, `HubTerminalCostItem`,
`HubTerminalMilestone`, `HubTerminal`, `SchematicCost`, `Schematic`.

Notable RAW-FRM-only fields the internal models drop or transform:
- FRM `Circuit.CircuitID` is a **string**; internal `Circuit.ID` is a string too, but FRM `BatteryTimeFull/Empty` are `*string` ("HH:MM:SS") and become parsed `float64` (`CircuitBattery.UntilFull/UntilEmpty`).
- FRM has separate `Extractor` and `FactoryMachine`; internal collapses both into one `Machine` with a `Category`.
- FRM `SinkData.GraphPoints []float64` (per-minute history array) is dropped; internal `SinkStats` keeps only scalars.
- FRM `Generator` carries `BaseProd/RegulatedDemandProd/ProductionCapacity/CircuitID`; internal aggregates these into `GeneratorStats.Sources` keyed by `PowerType`.
- `SessionInfoRaw` (in session.go, not frm_models) is also RAW-FRM: the `getSessionInfo` PascalCase response, with `ToDTO()` -> `SessionInfo` (camelCase). `SessionInfo` feeds session-name updates and game-time. Both are transport; `SessionInfo` may surface as fields on the GraphQL `Session` type (e.g. `sessionName`, day/night, play duration).

---

## tygo (current type-gen being replaced)

`api/export/tygo.yml` is minimal:
```yaml
packages:
  - path: api/models/models
    output_path: ../dashboard/src/apiTypes.ts
    type_mappings:
      time.Time: "string"
```
It scans the **entire** `models/models` package and emits one flat `dashboard/src/apiTypes.ts`. Implications for the GraphQL/codegen replacement:
- Only `time.Time -> string` is custom-mapped. GraphQL needs a scalar for timestamps (e.g. `DateTime`/ISO string).
- tygo honors `tstype:",extends"` on embedded `Location`/`CircuitIDs`/`ItemStats`/`SatisfactoryEvent` to produce TS interface `extends`. GraphQL has no interface-extends in the same way — the schema author must **flatten** these mixins into each concrete type, OR model them as shared GraphQL interfaces (`Located`, `CircuitScoped`). Recommend flattening for the leaf mixins (`Location`, `CircuitIDs`) since they're field-bags, not behavioral.
- `tygo:alias object` hints on nodes.go types are irrelevant (those types are being deleted).
- The whole-package scan means the DTO aliases, REST envelopes, FRM-raw `SessionInfoRaw`, and node/lease types all currently leak into TS. The GraphQL schema is the chance to expose ONLY the real domain types.

`make generate` (root Makefile) runs tygo; it gets replaced by gqlgen (server types) + graphql-codegen client-preset (frontend types). See plan 08.
