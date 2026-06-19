# REST + SSE API Surface Catalog

Purpose: a complete inventory of every HTTP endpoint and SSE stream the current backend exposes, so a plan author can map each one to a GraphQL Query / Mutation / Subscription. Source of truth is the route registration in `api/routers/routes/*.go` and the handlers in `api/routers/api/v1/*.go`. The CLAUDE.md endpoint tables are partially stale (they predate `/v1/machines`, `/v1/hypertubes`, `/v1/resourceNodes`, `/v1/schematics`, the world endpoints, the auth group, settings, history, and `/v1/nodes`); this document supersedes them.

## How routing works

- `api/routers/router.go` builds three Gin groups: `public` (no auth), `private` (wrapped in `middleware.RequireAuth`), `hook` (unused — no group returns `HookRoutes`).
- `api/routers/routes/routes.go` `RoutingGroups()` registers every group. Each group implements `PublicRoutes() / PrivateRoutes() / HookRoutes()`.
- Auth: `middleware.RequireAuth` (`middleware/auth.go`) reads the `sd_access_token` HTTP-only cookie, validates it against the token store, refreshes TTL (sliding expiration), aborts 401 if absent/invalid. There is no bearer-header path — auth is cookie-only.
- Session-readiness gate: `middleware.RequireSessionReady` (`middleware/session_stage.go`) reads the session id from `?session_id=` query param OR `:id` path param, and returns 425 Too Early until all `models.RequiredEventTypes` are cached. Applied to nearly every live/snapshot data endpoint.
- All data GET endpoints read from the Redis cache (`session.GetCachedState`), never directly from the FRM game API. This is critical for the refactor: in the target, these become SQLite/in-memory snapshot reads.
- Response envelope: success bodies are returned raw (the DTO is the body). Errors use `models.ErrorResponse { errors: [{code,msg}] }` via `request_context.go`.

## Endpoint inventory

Legend for classification:
- LIVE = value changes on every poll cycle (~4s); belongs in a GraphQL Subscription (plus an initial snapshot Query).
- SNAPSHOT = point-in-time read of slow-changing or current state; GraphQL Query.
- HISTORICAL = time-series; GraphQL Query with cursor/`since`.
- CONFIG/MUTATION = create/update/delete of sessions/settings/auth; GraphQL Mutation (or config Query for the GETs).

Auth column: `cookie` = behind `RequireAuth`; `public` = no auth; `+ready` = also behind `RequireSessionReady` (425 until session initialized).

### Auth group — `routes/auth.go` (handlers in `api/v1/auth.go`)

| Method+Path | Handler | Inputs | Response | Auth | Class | GraphQL op |
|---|---|---|---|---|---|---|
| POST `/v1/auth/login` | `Login` | body `models.LoginRequest{password}` | `models.LoginResponse{success,usedDefaultPassword}` + sets `sd_access_token` cookie | public (rate-limited per client IP) | MUTATION | `mutation login(password): LoginResult` |
| GET `/v1/auth/status` | `GetStatus` | reads `sd_access_token` cookie | `models.AuthStatusResponse{authenticated,usedDefaultPassword}` | public | CONFIG (query) | `query authStatus: AuthStatus` |
| POST `/v1/auth/change-password` | `ChangePassword` | body `models.ChangePasswordRequest{currentPassword,newPassword}` | `models.ChangePasswordResponse{success,message}` | cookie | MUTATION | `mutation changePassword(current,new): ChangePasswordResult` |
| POST `/v1/auth/logout` | `Logout` | reads cookie | `models.LogoutResponse{success}` + clears cookie | cookie | MUTATION | `mutation logout: LogoutResult` |

Note for target: cookie set/clear is an HTTP transport concern. With GraphQL-over-HTTP this can stay a `Set-Cookie` on the GraphQL POST response, or move to a header/token returned in the payload. The graphql-ws subscription transport will need the same cookie/credential to authorize; see open questions.

### Sessions group — `routes/sessions.go` (handlers in `api/v1/sessions.go`, `state.go`, `events_sse.go`)

| Method+Path | Handler | Inputs | Response | Auth | Class | GraphQL op |
|---|---|---|---|---|---|---|
| GET `/v1/sessions` | `ListSessions` | none | `[]models.SessionDTO` (with computed `stage`) | cookie | SNAPSHOT/CONFIG | `query sessions: [Session!]!` |
| POST `/v1/sessions` | `CreateSession` | body `models.CreateSessionRequest{name,address}` | 201 `models.SessionDTO` | cookie | MUTATION | `mutation createSession(input): Session` |
| GET `/v1/sessions/preview` | `PreviewSession` | query `address` | `{sessionInfo: models.SessionInfo}` (live probe of game server, 5s timeout) | cookie | SNAPSHOT (side-effect-free probe) | `query previewSession(address): SessionInfo` |
| GET `/v1/sessions/:id` | `GetSession` | path `id` | `models.SessionDTO` | cookie | SNAPSHOT/CONFIG | `query session(id): Session` |
| PATCH `/v1/sessions/:id` | `UpdateSession` | path `id`, body `models.UpdateSessionRequest{name?,isPaused?,address?}` (all optional, at least one required) | `models.SessionDTO` | cookie | MUTATION | `mutation updateSession(id,input): Session` |
| DELETE `/v1/sessions/:id` | `DeleteSession` | path `id` | 204 (also clears cached state + history) | cookie | MUTATION | `mutation deleteSession(id): Boolean` |
| GET `/v1/sessions/:id/validate` | `ValidateSession` | path `id` | `models.SessionInfo` (live probe; updates stored `sessionName`/`isOnline`) | cookie | MUTATION (has side-effects) or SNAPSHOT-with-write | `mutation validateSession(id): SessionInfo` |
| GET `/v1/sessions/:id/events` | `StartSessionEventsSSE` | path `id` | **SSE stream** of `models.SseSatisfactoryEvent` | cookie (+ `SseSetup` middleware) | **LIVE (stream)** | `subscription sessionEvents(sessionId): SatisfactoryEvent` |
| GET `/v1/sessions/:id/state` | `GetSessionState` | path `id` | `models.StateDTO` (full snapshot of everything) | cookie +ready | SNAPSHOT | `query sessionState(id): State` |

### THE SSE ENDPOINT — detail (the single most important mapping)

`GET /v1/sessions/:id/events` (`events_sse.go::StartSessionEventsSSE`) is the only streaming endpoint. It is the live data backbone of the entire frontend.

- Transport today: Redis pub/sub channel `satisfactory_events:{sessionID}` (`models.SatisfactoryEventKey + ":" + sessionID`). Subscribed via `key_value.New().AddListener`.
- A per-connection `CoalescingQueue` keeps only the latest message per `SatisfactoryEventType` (drops stale duplicates when the consumer is slow) — this backpressure/coalescing behavior MUST be preserved in the eventbus -> subscription bridge (see plan 05).
- Each emitted frame is a `models.SseSatisfactoryEvent` = `models.SatisfactoryEvent { type, data, gameTimeId }` + `clientId`. The SSE event name is the literal `"satisfactory_events"`.
- `data` is `any` (polymorphic per `type`). The publisher is the session poller in `worker/session_manager.go`.

Event types carried over this one stream (`models/models/satisfactory_event.go`):

| Event `type` | Payload (`data`) | Poll interval | Class | Maps to GraphQL |
|---|---|---|---|---|
| `satisfactoryApiCheck` | `SatisfactoryApiStatus` | 5s | LIVE | subscription field |
| `circuits` | `[]Circuit` | 4s | LIVE (+HISTORICAL) | subscription + history query |
| `factoryStats` | `FactoryStats` | 4s | LIVE (+HISTORICAL) | subscription + history query |
| `prodStats` | `ProdStats` | 4s | LIVE (+HISTORICAL) | subscription + history query |
| `sinkStats` | `SinkStats` | 4s | LIVE (+HISTORICAL) | subscription + history query |
| `generatorStats` | `GeneratorStats` | 4s | LIVE (+HISTORICAL) | subscription + history query |
| `players` | `[]Player` | 4s | LIVE | subscription field |
| `vehicles` | trains+drones+trucks | 4s | LIVE | subscription field(s) |
| `vehicleStations` | train+drone+truck stations | 4s | LIVE | subscription field(s) |
| `machines` | `[]Machine` | 4s | LIVE | subscription field |
| `storages` | `[]Storage` | (world) | LIVE | subscription field |
| `tractors` / `explorers` / `vehiclePaths` | world vehicles | | LIVE | subscription field |
| `spaceElevator` / `hub` / `radarTowers` | progress objects | | LIVE/SNAPSHOT | subscription field |
| `resourceNodes` | `[]ResourceNode` | | SNAPSHOT (static-ish) | query (rarely streamed) |
| `schematics` | `[]Schematic` | | SNAPSHOT | query |
| `belts` / `pipes` / `cables` / `trainRails` | infra geometry | 120s | SNAPSHOT (slow) | query (or low-freq subscription) |
| `hypertubes` | `Hypertubes` | 120s | SNAPSHOT | query |
| `sessionUpdate` | `Session` (full object) | on save-name change / disconnect | LIVE (control event) | `subscription sessionUpdated(id): Session` |

`sessionUpdate` is the **offline/disconnect + save-name-change control event**, published from `worker/session_manager.go` (`transitionToDisconnected` sets `IsOnline=false`, `IsDisconnected=true`, and the manager re-publishes the `Session`). The target eventbus must carry these connection-state events too (plan 05 "offline events"). There is no dedicated REST offline endpoint — disconnection is surfaced ONLY through `sessionUpdate` on the SSE stream and via the `isOnline`/`isDisconnected` fields on `SessionDTO`.

`RequiredEventTypes` (`session.go`) — the subset that gates session "ready": `satisfactoryApiCheck, circuits, factoryStats, prodStats, generatorStats, sinkStats, players, belts, pipes, trainRails, cables`. In GraphQL terms, `Session.stage` (init|ready) is a computed field; the 425 gate becomes either a resolver-level error or a `stage` field clients check before querying live data.

### Settings group — `routes/settings.go` (`api/v1/settings.go`)

| Method+Path | Handler | Inputs | Response | Auth | Class | GraphQL op |
|---|---|---|---|---|---|---|
| GET `/v1/settings` | `GetSettings` | none | `models.Settings` | cookie | CONFIG (query) | `query settings: Settings` |
| PUT `/v1/settings` | `UpdateSettings` | body `models.Settings` | `models.Settings` | cookie | MUTATION | `mutation updateSettings(input): Settings` |

Note: `UpdateSettings` also publishes a settings-change event (`event.Settings`) — a candidate for a `settingsChanged` subscription if the frontend needs cross-tab live settings, but currently there is no SSE channel for it (settings changes are not on the satisfactory_events stream). Confirm whether a subscription is needed.

### Status group — `routes/status.go` (`api/v1/status.go`, `client_ip.go`)

| Method+Path | Handler | Inputs | Response | Auth | Class | GraphQL op |
|---|---|---|---|---|---|---|
| GET `/v1/satisfactoryApiStatus` | `GetSatisfactoryApiStatus` | query `session_id` | `models.SatisfactoryApiStatusDTO` | cookie +ready | LIVE (5s poll) | subscription field / `query sessionState{satisfactoryApiStatus}` |
| GET `/v1/client-ip` | `GetClientIP` | none (reads X-Forwarded-For/X-Real-IP/RemoteAddr) | `{ip}` | cookie | SNAPSHOT (request-scoped) | `query clientIp: String` |

### Stats group — `routes/stats.go` (`api/v1/stats.go`) — all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/factoryStats` | `GetFactoryStats` | `models.FactoryStatsDTO` | LIVE (+HISTORICAL) | subscription field + `sessionState` query + history query |
| GET `/v1/generatorStats` | `GetGeneratorStats` | `models.GeneratorStatsDTO` | LIVE (+HISTORICAL) | same |
| GET `/v1/prodStats` | `GetProdStats` | `models.ProdStatsDTO` | LIVE (+HISTORICAL) | same |
| GET `/v1/sinkStats` | `GetSinkStats` | `models.SinkStatsDTO` | LIVE (+HISTORICAL) | same |

These four stats types plus `circuits` are exactly the `historyEnabledTypes` (see History group) — they are both live-streamed AND persisted as time-series.

### Circuits / Players / Machines — single-endpoint groups, all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/circuits` (`routes/circuits.go`) | `ListCircuits` | `[]models.CircuitDTO` | LIVE (+HISTORICAL) | subscription + query + history |
| GET `/v1/players` (`routes/players.go`) | `ListPlayers` | `[]models.PlayerDTO` | LIVE | subscription field |
| GET `/v1/machines` (`routes/machines.go`) | `GetMachines` | `[]models.MachineDTO` | LIVE | subscription field |

### Trains group — `routes/trains.go` (`api/v1/trains.go`), all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/trains` | `ListTrains` | `[]models.TrainDTO` | LIVE | subscription + query |
| GET `/v1/trainStations` | `ListTrainStations` | `[]models.TrainStationDTO` | LIVE | subscription + query |
| GET `/v1/trainSetup` | `GetTrainSetup` | `models.TrainSetupDTO` (trains+stations combined) | LIVE | composite query / subscription |

### Drones group — `routes/drones.go` (`api/v1/drones.go`), all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/drones` | `ListDrones` | `[]models.DroneDTO` | LIVE | subscription + query |
| GET `/v1/droneStations` | `ListDroneStations` | `[]models.DroneStationDTO` | LIVE | subscription + query |
| GET `/v1/droneSetup` | `GetDroneSetup` | `models.DroneSetupDTO` (drones+stations combined) | LIVE | composite query / subscription |

`*Setup` composites (train/drone) are convenience aggregations of the two list endpoints. In GraphQL these collapse naturally: a single query can select both `trains` and `trainStations`, so the dedicated `*Setup` endpoints likely disappear.

### Infrastructure group — `routes/infrastructure.go` (`api/v1/infrastructure.go`), all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/belts` | `ListBelts` | `models.BeltsDTO` (belts + splitter/mergers) | SNAPSHOT (120s poll) | `query belts(sessionId)` |
| GET `/v1/pipes` | `ListPipes` | `models.PipesDTO` (pipes + junctions) | SNAPSHOT | `query pipes(sessionId)` |
| GET `/v1/cables` | `ListCables` | `[]models.CableDTO` | SNAPSHOT | `query cables(sessionId)` |
| GET `/v1/trainRails` | `ListTrainRails` | `[]models.TrainRailDTO` | SNAPSHOT | `query trainRails(sessionId)` |
| GET `/v1/hypertubes` | `ListHypertubes` | `models.Hypertubes` (tubes + entrances) | SNAPSHOT | `query hypertubes(sessionId)` |

### Resource nodes / Schematics — `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/resourceNodes` (`routes/resource_nodes.go`) | `ListResourceNodes` | `[]models.ResourceNode` (raw model, not DTO) | SNAPSHOT (static-ish) | `query resourceNodes(sessionId)` |
| GET `/v1/schematics` (`routes/schematics.go`) | `ListSchematics` | `[]models.SchematicDTO` | SNAPSHOT | `query schematics(sessionId)` |

### World group — `routes/world.go` (`api/v1/world.go`), all `query session_id`, cookie +ready

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/storages` | `ListStorages` | `[]models.StorageDTO` | LIVE | subscription + query |
| GET `/v1/tractors` | `ListTractors` | `[]models.TractorDTO` | LIVE | subscription + query |
| GET `/v1/explorers` | `ListExplorers` | `[]models.ExplorerDTO` | LIVE | subscription + query |
| GET `/v1/vehiclePaths` | `ListVehiclePaths` | `[]models.VehiclePathDTO` | LIVE | subscription + query |
| GET `/v1/spaceElevator` | `GetSpaceElevator` | `models.SpaceElevatorDTO` | SNAPSHOT/LIVE | query (+ subscription on progress) |
| GET `/v1/hub` | `GetHub` | `models.HubDTO` | SNAPSHOT/LIVE | query (+ subscription on progress) |
| GET `/v1/radarTowers` | `ListRadarTowers` | `[]models.RadarTowerDTO` | SNAPSHOT | query |

### History group — `routes/history.go` (`api/v1/history.go`), cookie +ready

| Method+Path | Handler | Inputs | Response | Class | GraphQL op |
|---|---|---|---|---|---|
| GET `/v1/sessions/:id/history` | `ListHistorySaves` | path `id` | `models.HistorySavesResponse{saveNames,currentSave}` | HISTORICAL (config) | `query historySaves(sessionId)` |
| GET `/v1/sessions/:id/history/:dataType` | `GetHistory` | path `id`,`dataType` (enum: circuits/generatorStats/prodStats/factoryStats/sinkStats); query `saveName?` (default current), `since?` (int cursor, default 0) | `models.HistoryChunk` (ascending by `gameTimeId`) | HISTORICAL | `query history(sessionId,dataType,saveName,since): HistoryChunk` |

This is THE historical time-series endpoint. `historyEnabledTypes` is hardcoded to exactly five types. The `since` param is a `gameTimeId` cursor for incremental fetch — preserve this as a GraphQL cursor argument. In the target, this reads from SQLite instead of Redis (`session.GetHistory`).

### Nodes group — `routes/nodes.go` (`api/v1/nodes.go`) — REMOVE entirely

| Method+Path | Handler | Response | Class | GraphQL op |
|---|---|---|---|---|
| GET `/v1/nodes` | `GetNodes` (PUBLIC) | `models.NodesResponse{thisInstanceID,liveNodes[],timestamp}` | n/a | **DELETE — no equivalent** |

`/v1/nodes` exposes the distributed-lease topology (`worker.GetGlobalLeaseManager`, `SessionLease`, `NodeInfo`, per-session ownership). The refactor explicitly kills distributed polling (goal #2). This endpoint, its models (`models/models/nodes.go`), and the lease manager all get deleted — no GraphQL replacement.

### Non-grouped / infra endpoints (in `router.go`)

| Method+Path | Source | Response | Class | Disposition |
|---|---|---|---|---|
| ANY `/healthz` | `router.go` inline | `{status:"ok"}` | n/a | keep as plain HTTP (not GraphQL) |
| GET `/v2/docs/*any` | `docsHandlers.ServeDocs` | Swagger UI | n/a | replace with GraphQL playground/introspection |
| GET `/internal/metrics` | `ginmetrics` | Prometheus | n/a | keep as plain HTTP |

## Summary counts

- Total app endpoints in `RoutingGroups()`: 39 routes (38 GET/POST/PATCH/DELETE + 1 SSE).
- 1 SSE stream (`/v1/sessions/:id/events`) carries ~26 distinct event types — this is the entire LIVE surface and maps to GraphQL subscriptions.
- 4 auth mutations/queries, 2 settings, 8 session lifecycle (incl. state + events), 2 history, 1 client-ip, 1 nodes (delete).
- ~28 data GET endpoints, ALL of which read the cache and ALL of which are a projection of the single `State` object (`models/models/state.go`). In GraphQL these collapse into a small number of resolvers on a `State`/`Session` type plus the subscription.

## Key target-architecture observations

1. **One subscription replaces the SSE multiplexer.** The `satisfactory_events` Redis channel + `CoalescingQueue` becomes a Go eventbus -> graphql-ws subscription. The coalescing (latest-per-type, drop-stale) behavior is load-bearing for slow clients and must be reimplemented in the bridge (plan 05).
2. **Every data GET is a slice of `State`.** Rather than ~28 endpoints, the GraphQL schema can expose one `State` type (or `Session.state`) with per-field resolvers, and per-page queries select only the fields a route needs (plan 07 "smart queries"). The `*Setup` composites disappear.
3. **History is the only true SQLite time-series.** Five `historyEnabledTypes` (circuits + 4 stats) with a `gameTimeId` `since` cursor. Everything else is current-state (live or slow-snapshot).
4. **The 425 readiness gate becomes a schema concern.** `Session.stage` (init/ready) computed from `RequiredEventTypes`; the middleware abort disappears.
5. **Auth is cookie + per-IP rate limit.** GraphQL needs the same cookie on both the HTTP POST and the graphql-ws connection_init. `usedDefaultPassword` flag must survive into `authStatus`/`login` results.
6. **Disconnect/offline has no dedicated endpoint** — it travels as a `sessionUpdate` event and as `isOnline`/`isDisconnected` fields. The target eventbus must emit a connection-state event (subscription) so the UI learns about going offline live.
7. **`/v1/nodes` and the lease manager are deleted, not migrated.**
