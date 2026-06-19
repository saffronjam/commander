# Live Dataflow Trace (current) and Target Mapping

Scope: end-to-end LIVE dataflow from the game's FRM API into the browser, plus the
historical-data and connectivity-detection paths that ride on the same pipeline.
This is read-only research to let a plan author rebuild the pipeline on Go channels
(an in-process eventbus) + GraphQL subscriptions, with SQLite for history/config.

---

## 1. Current end-to-end pipeline (one diagram)

```
FRM mod API (per game server, sess.Address)
   |  HTTP GET /getPower, /getFactory, ... (per-domain pollers)
   v
frm_client.Client.SetupEventStream      (~25 goroutines, one ticker each)
   |  each tick -> requestQueue.Enqueue(endpointType, fetch)   (dedupe + serialize)
   |  fetch -> makeSatisfactoryCall -> JSON -> models.* conversion
   v
callback(handler)  in worker/session_manager.go publishLoop
   |  (a) if history-enabled type: session.StoreHistoryPoint + PruneOldHistory  -> Redis ZSET
   |  (b) cache latest:  kvClient.Set("state:{sid}:{save}:{type}", data, 0)     -> Redis string
   |  (c) publish:       kvClient.Publish("satisfactory_events:{sid}", json)    -> Redis pub/sub
   v
Redis pub/sub channel  "satisfactory_events:{sessionID}"
   |
   v
StartSessionEventsSSE (routers/api/v1/events_sse.go)
   |  kvClient.AddListener(ctx, channel) -> CoalescingQueue (latest-per-type) -> gin Stream
   v
SSE  text/event-stream  "satisfactory_events" events  -->  browser
```

Two parallel reads also exist (request/response, not stream):
- `GET /v1/sessions/{id}/state` -> `session.GetCachedState` -> reads all `state:*` Redis keys -> `StateDTO`.
- `GET /v1/sessions/{id}/history/{dataType}` -> `session.GetHistory` -> reads Redis ZSET + data keys.

---

## 2. Poll loop & cadence (`frm_client/client.go`)

`SetupEventStream(ctx, callback)` builds a static `endpoints` slice (24 entries) and
spawns one goroutine **per endpoint**, each with its own `time.NewTicker(Interval)`.
Each goroutine fetches immediately on start, then on every tick. Cadence tiers:

- 2s timeout status check; **5s** interval: `satisfactoryApiCheck` (`GetSatisfactoryApiStatus`).
- **4s** (live/dynamic): circuits, factoryStats, prodStats, sinkStats, players,
  generatorStats, machines, vehicles, vehicleStations, tractors, explorers, radarTowers.
- **20s**: resourceNodes. **30s**: vehiclePaths, spaceElevator, hub, schematics.
- **120s** (heavy infra): belts, pipes, trainRails, cables, storages, hypertubes.

Timeouts: `apiTimeout=10s` regular, `infraApiTimeout=20s` for belts/pipes/cables/rails,
`statusCheckTimeout=2s` for the root status probe (see `client.go:18-22`).

Note: `SatisfactoryEventVehicles` / `VehicleStations` are emitted by the poller but the
state cache (`cache.go`) does NOT read them back into `State` — they are split into
trains/drones/trainStations/droneStations downstream by the trains/drones/vehicles files.
(Worth flagging to the data-model author — see open questions.)

There is a second, lightweight loop `SetupLightPolling(ctx, callback)` used when a
session is disconnected: a single goroutine, **10s** ticker, polls only `GetSessionInfo`
(`/getSessionInfo`), emitting `satisfactoryApiCheck` Running true/false events.

**Target:** one in-process poller per session. Keep the per-domain interval tiers
(they are the natural sub-poll cadences). Each fetch result is published onto the Go
eventbus instead of invoking a Redis-publishing callback. The light-polling loop becomes
the poller's "offline" mode (same goroutine, swap the tick set).

---

## 3. Raw FRM data -> game state (conversion)

Conversion is per-domain (`power.go`, `trains.go`, `drones.go`, `stats.go`, `infra.go`,
`vehicles.go`, `world.go`, `misc.go`, `players.go`, `machines.go`, `schematics.go`).
Pattern (see `power.go:14-75` `ListCircuits`):
1. `makeSatisfactoryCall(ctx, "/getX", &rawSlice)` decodes FRM JSON (`frm_models.*`).
2. Loop, map `frm_models.X` -> `models.X` with unit conversions (MW->W `*1e6`, cm->m `/100`),
   status derivation (e.g. `satisfactoryStatusToTrainStatus`, `satisfactoryStatusToDroneStatus`
   use station-proximity math in `client.go:131-173`), filtering and sorting.
3. Return `[]models.X` (or `*models.X`). These typed values are what the callback carries
   as `event.Data any`.

`makeSatisfactoryCall` / `makeSatisfactoryCallWithTimeout` (`client.go:454-517`) also drive
connection health (see section 6) and `setApiUp`.

**Target:** conversion logic is pure and stays as-is. It moves under the single poller;
output `models.*` go onto eventbus topics. No change to `frm_models` or conversion funcs.

---

## 4. State caching (`session/cache.go`)

- **Cache write** happens in `publishLoop`'s handler (`session_manager.go:329-340`):
  `kvClient.Set("state:{sid}:{saveName}:{type}", json(event.Data), 0)` — no expiry,
  overwritten each poll. Only written when `saveName != ""`.
- **Cache read** `GetCachedState(sessionID, saveName)` (`cache.go:36-104`): constructs an
  empty `models.State` then `getCached` each event type from its `state:` key and unmarshals.
  Composite `hypertubes` is split into `Hypertubes` + `HypertubeEntrances`.
- **Session stage** `GetSessionStage` (`cache.go:130-142`): a session is `ready` only when
  ALL `models.RequiredEventTypes` have a `state:` key; else `init`. Used by
  `RequireSessionReady` middleware (`middleware/session_stage.go`) to return **425 Too Early**.
- **Cleanup** `ClearCachedState` / `ClearHistoryData` use `kvClient.List(pattern)` (Redis KEYS)
  to wildcard-delete on session delete.

Key formats (all must move to SQLite columns/queries):
- state latest: `state:{sessionID}:{saveName}:{eventType}`
- deleted marker: `deleted-session:{sessionID}` (24h TTL, `cache.go:12-26`)
- history ZSET: `history:{sessionID}:{saveName}:{dataType}` (score=gameTimeID, member=gameTimeID)
- history data: `history:{sessionID}:{saveName}:{dataType}:data:{gameTimeID}`

**Target:** "latest state per type" becomes either (a) an in-memory map in the poller
(source of truth for the initial subscription payload) and/or (b) a `latest_state` row in
SQLite. The `/state` request becomes a GraphQL **query** that reads the latest snapshot;
session-stage `ready/init` becomes a query field derived from which types have arrived.

---

## 5. History storage (rides the same poll handler)

`historyEnabledTypes` (`session_manager.go:20-26`): circuits, generatorStats, prodStats,
factoryStats, sinkStats. On each poll of such a type, the handler (`session_manager.go:288-304`):
1. Reads `saveName` and `gameTimeID := state.gameTimeTracker.CurrentGameTime()`.
2. If both valid: sets `event.GameTimeID` (so SSE subscribers can track position),
   `StoreHistoryPoint(...)` (Redis ZSET + data key), then `PruneOldHistory(...)` against
   `config.MaxSampleGameDuration`.

`GameTimeTracker` (`session/game_time.go`): tracks `OffsetSeconds` + wall-clock since
`ProbedAt`; `Update(totalPlayDuration)` is fed by `monitorSessionInfo` (10s); detects
**time discontinuity** (save rollback: game time moved backward) and returns a
`TimeDiscontinuity`. The ZSET member = gameTimeID specifically so a rollback **overwrites**
the existing point at that game-time (`cache.go:177-182`).

Read path: `GetHistory(sid, save, dataType, sinceID)` (`cache.go:225-269`) — ZRANGEBYSCORE
from `sinceID+1`, returns `HistoryChunk{DataType, SaveName, LatestID, Points}`. The
`since`/`LatestID` cursor enables incremental fetching by the frontend.
`GetHistorySaves` scans keys to list save names (`history.go:ListHistorySaves`).

**Target:** history -> SQLite table keyed `(session_id, save_name, data_type, game_time_id)`
with the data blob; `gameTimeID` is the natural primary-ordering key. Overwrite-on-rollback
= `INSERT ... ON CONFLICT(... game_time_id) DO UPDATE`. Prune = `DELETE WHERE game_time_id < cutoff`.
`GetHistory` becomes a GraphQL **query** with a `since` cursor arg; `GetHistorySaves` a query.
The `GameTimeTracker` stays in-process in the poller (drives `game_time_id` on write).

---

## 6. Connectivity / "offline" detection & signaling

Detection lives in `frm_client.Client` (`client.go:79-129`):
- `makeSatisfactoryCall` network error -> `setApiUp(false)` + `incrementFailureCount()`.
- HTTP 503/404 -> `setApiUp(false)` but does NOT increment failures (server reachable).
- success -> `resetFailureCount()`.
- `failureThreshold=5`. On crossing the threshold once, fires `onDisconnected()` callback.

Signaling chain:
- The publisher sets `onDisconnected` (`session_manager.go:260-263`) ->
  `transitionToDisconnected(sessionID)`: sets `sess.IsDisconnected=true`, `IsOnline=false`,
  persists via store, then `restartPublisherLocked` -> relaunches `publishLoop` which now
  calls `SetupLightPolling` instead of `SetupEventStream`.
- Recovery: light polling's `GetSessionInfo` succeeds -> emits `satisfactoryApiCheck Running:true`
  -> handler sees `status.Running && sess.IsDisconnected` -> `transitionToConnected` -> restart
  in full `SetupEventStream` mode.
- `satisfactoryApiCheck` events also update `store.UpdateOnlineStatus` (`session_manager.go:309-319`)
  and are published over SSE so the UI shows online/offline.

So "offline" is BOTH a persisted session flag (IsOnline/IsDisconnected) AND a live SSE event.

**Target:** offline/online is a dedicated eventbus topic (the orchestrator brief calls out
"offline events"). The poller flips between full/light tick sets internally instead of
tearing down and restarting a goroutine. The persisted `is_online`/`is_disconnected` go to
the SQLite sessions table; the live transition is a `satisfactoryApiCheck`-equivalent
subscription event. The 5-failure threshold + callback logic ports verbatim.

---

## 7. Request queue / rate limiting (`request_queue.go`)

`RequestQueue` is per-`Client` (per-session). One worker goroutine drains a buffered
`requestChan` (cap 100) and executes requests **sequentially** — so a single session never
issues concurrent HTTP calls to its FRM API. `Enqueue(endpointType, fn)`:
- If an in-flight request for the same `endpointType` exists (`pendingTypes[type]`), it
  **drops** the new one returning `(false, nil)` — **deduplication** so a slow endpoint
  doesn't pile up duplicate polls. Returns `(true, err)` when actually executed.
- `Stop()` cancels the worker (wired to `ctx.Done()` in `SetupEventStream`).

This is the only rate-limiting mechanism; there is no global cross-session limit.

**Target:** keep this serialize+dedupe queue inside the single poller, one per session
poller. It is independent of Redis and ports unchanged. (Possible enhancement: a shared
limiter if many sessions share a host — open question, out of scope here.)

---

## 8. Per-session isolation

- Lifecycle: `SessionManager` (`worker/session_manager.go`) keeps
  `publishers map[sessionID]*publisherState`; `watchForNewSessions` polls the store every
  5s to start/stop/restart publishers as sessions are created/paused/deleted.
- Isolation keys: SSE channel `satisfactory_events:{sessionID}`; cache `state:{sid}:{save}:*`;
  history `history:{sid}:{save}:*`. Save-name is part of the key so a rollback/new-save is
  isolated within a session too.
- `publisherState` holds per-session `currentSaveName` (+RWMutex), `gameTimeTracker`,
  `cancel`, `isDisconnected`.
- **Distributed-polling coupling (to be removed):** every poll result is gated by
  `leaseManager.IsOwned/IsUncertain/IsOwnedStrict` (`session_manager.go:273-286, 356-366`),
  and `SessionManagerWorker` builds a `lease.NewLeaseManager` keyed on `config.NodeName`.
  This is the entire SD_NODE_NAME / multi-instance machinery the refactor deletes (see plan 02).
- `monitorSessionInfo` (10s, `session_manager.go:392-453`) runs per session: feeds the
  GameTimeTracker, detects save-name changes, persists + publishes a `sessionUpdate` event.
- `IsSessionDeleted` marker prevents late poll results from re-inserting data after delete.

**Target:** `SessionManager` stays as the in-process supervisor minus all lease/owner checks.
One poller goroutine-group per session writing to per-session eventbus topics (or one bus
keyed by sessionID). SSE channel-per-session maps directly to a GraphQL subscription
parameterized by `sessionId`.

---

## 9. SSE publish/consume internals (to replace with GraphQL subscriptions)

Publish: `kvClient.Publish("satisfactory_events:{sid}", json(SatisfactoryEvent))`
(`session_manager.go:343`). Event shape `models.SatisfactoryEvent{Type, Data any, GameTimeID}`
(`satisfactory_event.go:35-39`).

Consume: `StartSessionEventsSSE` (`events_sse.go:143-202`):
1. `kvClient.AddListener(ctx, channel, handler)` (Redis Subscribe, 1000-buffer channel).
2. Handler unmarshals and `queue.Push` into a **CoalescingQueue** — a `map[type]event`
   that keeps only the latest message per event type plus a non-blocking `signal` chan
   (`events_sse.go:29-91`). This is per-client backpressure: if the client is slow, stale
   states for a type are overwritten rather than queued.
3. `gin.Stream` selects on `ctx.Done()` or `queue.Signal()`, drains all latest messages,
   emits each as an SSE event named `satisfactory_events` (`SseSatisfactoryEvent` adds `ClientID`).
4. `clients` map + `AddClientMessageCount` track per-client msg frequency (debug only).

**Target mapping (critical for plan 05/06):**
- Redis `Publish` -> eventbus `bus.Publish(topic{sessionID,type}, event)`.
- Redis `AddListener`/Subscribe -> eventbus `Subscribe()` returning a Go channel; fan-out to
  N subscribers with per-subscriber buffered channel.
- **CoalescingQueue** is the backpressure/coalescing behavior the eventbus fan-out must
  preserve (latest-per-type, drop stale) — do not lose this when bridging to graphql-ws.
- `gin.Stream` SSE loop -> gqlgen Subscription resolver returning `<-chan *Event`, served
  over graphql-ws. The initial cached snapshot (current `GetCachedState`) should be sent as
  the subscription's first payload (or via a paired query) so a new subscriber is immediately
  consistent, mirroring how SSE+`/state` work together today.
- `SatisfactoryEventType` (the 25 string consts in `satisfactory_event.go`) maps to a
  GraphQL union/enum of payload types; `GameTimeID` is carried on history-typed events.

---

## 10. Per-piece target mapping table

| Current piece | File | Target |
|---|---|---|
| Per-domain poll goroutines + tickers | `frm_client/client.go` SetupEventStream | poller goroutine(s), interval tiers kept |
| Light polling (offline) | `frm_client/client.go` SetupLightPolling | poller "offline mode" tick set |
| FRM JSON -> models conversion | `power.go`, `trains.go`, ... | unchanged, runs inside poller |
| RequestQueue (serialize+dedupe) | `request_queue.go` | unchanged, per-session inside poller |
| Connection health / failureThreshold | `client.go:79-129` | unchanged; fires offline eventbus topic |
| publishLoop callback orchestration | `session_manager.go:267-348` | poller -> eventbus publish; no Redis |
| Latest-state cache write/read | `cache.go` GetCachedState / Set | poller in-mem snapshot + SQLite `latest_state`; `/state` -> GraphQL query |
| Session stage init/ready (425) | `cache.go` + `middleware/session_stage.go` | GraphQL query field derived from arrived types |
| History store/prune | `cache.go` StoreHistoryPoint/PruneOldHistory | SQLite history table, INSERT ON CONFLICT, DELETE prune (SQLite write) |
| History read + cursor | `cache.go` GetHistory / `history.go` | GraphQL query with `since` cursor |
| GameTimeTracker + discontinuity | `game_time.go` | in-process in poller, drives `game_time_id` |
| monitorSessionInfo (save name, online) | `session_manager.go:392-453` | poller sub-task; persists session row in SQLite; emits sessionUpdate topic |
| Redis pub/sub publish | `session_manager.go:343` + `key_value/client.go` Publish | eventbus Publish |
| SSE subscribe + CoalescingQueue | `events_sse.go` | gqlgen Subscription resolver + eventbus fan-out w/ coalescing |
| Lease / owner gating, NodeName | `session_manager.go:273-366`, SessionManagerWorker | DELETED (plan 02) |
| deleted-session marker (24h TTL) | `cache.go:12-26` | SQLite soft-delete flag or row removal |
| ClearCachedState/History (KEYS scan) | `cache.go` | SQLite `DELETE WHERE session_id=?` |
