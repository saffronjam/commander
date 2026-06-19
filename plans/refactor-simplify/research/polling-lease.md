# Research: Distributed Polling Lease Solution

Scope: document the entire "distributed polling" mechanism (lease coordination, rendezvous
hashing, the `-api`/`-publisher`/`-settings-listener` worker-flag split, `SD_NODE_NAME` node
identity, heartbeats, multi-instance Makefile targets) so a plan author can delete it and
replace it with ONE in-process poller. This is research only; nothing is changed here.

---

## 1. What the distributed solution does today

The system was designed (spec `002-redis-poll-lease`) to let multiple API replicas run
concurrently and split polling work between them: exactly one instance polls each session at
a time, work auto-rebalances when instances join/leave, and failover happens within the lease
TTL when an instance dies. The whole thing is implemented on top of Redis (lease keys,
heartbeat keys, Lua scripts, SCAN).

Core invariant (spec line 19): "One poll target = one Redis lease. Exactly one API instance
holds the lease for each endpoint." A "poll target" is a session (`poll:lease:<sessionID>`).

Once Redis is gone and there is a single process, this entire invariant is trivially satisfied
by construction (one process owns everything), so the whole coordination layer is dead weight.

---

## 2. Components, file by file

### 2.1 `api/service/lease/` (the whole package — DELETE entirely)

- `manager.go` (~1025 lines): `LeaseManager` interface + `leaseManager` impl.
  - Redis key prefixes: `poll:lease:` (lease) and indirectly `poll:node:` (heartbeats).
  - Background loops started by `Start(ctx)`:
    1. `statusTransitionLoop` — 10s grace period, flips self-status `init` -> `online`.
       During `init` the node renews existing leases but will not acquire new ones (anti-churn
       on restart, `TryAcquire` returns false when `!IsReady()`).
    2. `heartbeatLoop` — every `HeartbeatInterval` (10s) writes `poll:node:<id>` with TTL 30s.
    3. `renewalLoop` — every `RenewalInterval` (10s) runs three steps:
       `renewOwnedLeases()`, `reacquireUncertainLeases()`, `releaseNonPreferredLeases()`.
    4. `nodeDiscoveryLoop` — every `NodeDiscoveryInterval` (10s) refreshes the cached live-node
       list via `GetLiveNodes` (Redis SCAN of `poll:node:*`).
  - Acquire: `TryAcquire` — checks already-owned cache, `IsReady` gate, rendezvous preferred-
    owner check (non-preferred defer to current holder), then atomic `SET NX PX` of a JSON
    `RedisLeaseValue` with TTL `LeaseTTL` (30s). On success records `LeaseInfo` in `ownedLeases`.
  - Renew: `renewLease` runs `renewScript` (Lua, owner-checked `SET`+`PEXPIRE`). Failure marks
    the lease `LeaseStateUncertain` (fail-closed: poller pauses, see session_manager handler).
  - Re-acquire: `reacquireUncertainLeases`/`tryReacquireLease` — for uncertain leases, GET the
    key, if still owned re-renew, else drop from tracking.
  - Voluntary rebalance: `releaseNonPreferredLeases` — if this node is no longer the rendezvous
    preferred owner AND the preferred owner reports `online`, release the lease so the preferred
    owner can grab it.
  - Release: `Release` runs `releaseScript` (Lua, owner-checked `DEL`), idempotent.
  - Strict ownership: `IsOwnedStrict` does a live Redis GET (used by session_manager before poll
    start to avoid duplicate polling in the acquire->poll window).
  - Cached-state queries: `IsOwned`, `IsUncertain`, `OwnedSessions`, `GetLeaseInfo`.
  - Cluster queries for the `/v1/nodes` debug view: `GetLiveNodes`, `PreferredOwner`,
    `IsPreferredOwner`, `GetLeaseOwner`, `GetLeaseValue`, `CheckNodeReady`, `InstanceID`.
  - `Stop()`: graceful shutdown — releases all owned leases via `releaseScript`, clears
    `ownedLeases`, removes the heartbeat key, cancels ctx, waits on the WaitGroup.
- `instance.go`: node identity + heartbeat persistence.
  - `GenerateInstanceID(nodeName)`: if `nodeName != ""` use it verbatim, else
    `{hostname}-{bootTimestampNanos}-{uuid8}`. This is where `SD_NODE_NAME` flows in.
  - `RegisterHeartbeat`/`RefreshHeartbeat`/`RemoveHeartbeat`: write/delete `poll:node:<id>` JSON
    `HeartbeatData{Status, StartupTime}` with TTL.
  - `GetLiveNodes`: Redis SCAN `poll:node:*`, strips prefix to instance IDs.
  - `GetNodeStatus`: GET heartbeat, returns `init`/`online`/`offline` (`offline` on redis.Nil).
- `rendezvous.go`: `ComputePreferredOwner(sessionID, nodes)` + `computeWeight` — FNV-1a Highest
  Random Weight hashing to pick the deterministic preferred owner for a session. Pure-Go, no
  Redis, but only meaningful with >1 node.
- `types.go`: `LeaseState` enum (`Unknown/Owned/Other/Uncertain`), `LeaseInfo`, `LeaseConfig`
  + `DefaultLeaseConfig` (LeaseTTL 30s, all intervals 10s, HeartbeatTTL 30s), `LeaseEvent*`
  types (logging only), `RedisLeaseValue` (JSON `{owner_id, acquired_at, last_renewed_at}`)
  with `Marshal`/`ParseRedisLeaseValue`.
- `lua_scripts.go`: `renewScript` and `releaseScript` (owner-checked, cjson-decoding Lua).

### 2.2 `api/cmd/flag.go` + `api/cmd/app.go` (the worker-flag split)

- `flag.go`:
  - `FlagType` enum: `FlagTypeWorker`, `FlagTypeGlobal`.
  - `FlagDefinition` carries a `Run func(ctx, cancel)` per worker.
  - `GetFlags()` defines four flags:
    - `mode` (global)
    - `api` (worker) — Run nil; handled specially in `app.go` (starts HTTP server).
    - `publisher` (worker) — Run -> `worker.SessionManagerWorker(ctx)`.
    - `settings-listener` (worker) — Run -> `worker.SettingsListenerWorker(ctx)`.
  - `AnyWorkerFlagsPassed()` and `SetPassedValue`/`GetPassedValue` helpers.
- `app.go`:
  - `Create()` loops over flags; for every `FlagTypeWorker` flag that is true (except `api`),
    spawns `flag.Run` in a goroutine tracked by `app.workerWg`. If `api` is true it boots the
    Gin HTTP server.
  - `validateApp()`: if `!AnyWorkerFlagsPassed()`, sets ALL worker flags to true ("No workers
    specified, starting all"). This is why `go run main.go` with no flags runs everything.
  - `Stop()`: cancels ctx, waits up to 10s on `workerWg` (this is the window the LeaseManager
    uses to release leases), then shuts down the HTTP server with a 5s timeout.

The split exists ONLY to support running the HTTP API and the poller as separate scaled
processes. With a single process this whole flag/worker abstraction collapses to: start HTTP
server + start the one poller + start settings handling, unconditionally.

### 2.3 `api/worker/session_manager.go`

This is the actual poller, currently entangled with the lease manager. It must SURVIVE (in
de-leased form) — it is the thing being replaced/simplified, not deleted.

- Lease entanglement to remove:
  - Package globals `globalLeaseManager` + `SetGlobalLeaseManager`/`GetGlobalLeaseManager`
    (only consumer is `routers/api/v1/nodes.go`).
  - `SessionManager.leaseManager` field, `NewSessionManager(leaseManager)` parameter.
  - `StartSession`: calls `leaseManager.TryAcquire` and bails if not acquired -> must become
    unconditional start.
  - `publishLoop` handler: per-event `IsOwned`/`IsUncertain` checks that pause/stop the loop ->
    delete; the loop should just run while its ctx is alive.
  - `publishLoop` pre-poll `IsOwnedStrict` guard -> delete.
  - `Stop()`: `sm.leaseManager.Stop()` call -> delete.
  - `SessionManagerWorker`: constructs the lease manager, `Start`s it, calls
    `SetGlobalLeaseManager`, then `NewSessionManager(leaseManager)` -> simplify to just build
    and run the manager.
- Logic that MUST be preserved (the real polling responsibilities — see section 5):
  - `Start`: load all sessions from store, start a publisher per non-paused session, then
    `watchForNewSessions` every 5s.
  - `watchForNewSessions`: reconcile started publishers against the session list — start new /
    unpaused sessions, stop paused / deleted sessions.
  - `StartSession`/`StopSession`/`restartPublisherLocked`: per-session goroutine lifecycle.
  - `publishLoop`: build FRM client for the session address, set disconnect callback, run
    `SetupEventStream` (or `SetupLightPolling` when disconnected), and for each event: store
    history (history-enabled types via `session.StoreHistoryPoint`/`PruneOldHistory`), cache
    latest state (`state:<id>:<saveName>:<type>`), publish to the event channel.
  - `monitorSessionInfo`: every 10s fetch session info, update `GameTimeTracker`, detect save-
    name change, persist + publish a `SessionUpdate` event.
  - `transitionToDisconnected`/`transitionToConnected`: switch between full and light polling.
  - NOTE: these last items touch Redis (`kvClient.Set`, `kvClient.Publish`, session store).
    Those Redis touchpoints are owned by docs 03 (redis-removal) / 04 (sqlite) / 05 (eventbus).
    For THIS doc the only concern is removing the lease coordination, not the cache/pubsub.

### 2.4 `api/worker/settings_listener.go`

`SettingsListenerWorker` — subscribes to a Redis pub/sub channel (`settings.SettingsChangedChan`)
and applies log-level changes live. It is a `FlagTypeWorker` only because of the split; it is
NOT part of lease/distribution. It should stop being a separately-flaggable worker and just be
started in-process (its Redis pub/sub dependency is doc 03/05's concern, not this doc's). Listed
here only because it is one of the three worker flags being collapsed.

### 2.5 `api/routers/api/v1/nodes.go` + route + model + frontend (DELETE entirely)

The `/v1/nodes` endpoint exists purely to visualize the distributed lease cluster. With one
process it is meaningless (always one node owning everything).

- Backend: `api/routers/api/v1/nodes.go` (handler `GetNodes`), `api/routers/routes/nodes.go`
  (`NodesRoutingGroup`, registered in `api/routers/routes/routes.go`), model
  `api/models/models/nodes.go` (`NodeInfo`, `SessionLease`, `NodesResponse`).
- Frontend (consumes `GET /v1/nodes`): `dashboard/src/services/nodesApi.ts`,
  `dashboard/src/sections/debug/view/debug-nodes-view.tsx` (+ its `index.ts`),
  `dashboard/src/pages/debug-nodes.tsx`, route entry in `dashboard/src/routes/sections.tsx`,
  nav entry in `dashboard/src/layouts/config-nav-dashboard.tsx`, and the generated
  `NodeInfo`/`SessionLease`/`NodesResponse` types in `dashboard/src/apiTypes.ts` (these
  regenerate). NOTE: `apiTypes.ts`/`config-nav-dashboard.tsx` also contain unrelated "nodes"
  (resource nodes on the map) — do NOT confuse those; only the lease-node debug view is removed.

### 2.6 Node identity / `SD_NODE_NAME` (DELETE all node-identity plumbing)

- `api/pkg/config/config.go:12` — `NodeName string` config field.
- `api/pkg/config/environment.go:40-43` — reads `SD_NODE_NAME` env var into `Config.NodeName`.
- `api/worker/session_manager.go` `SessionManagerWorker` — passes `config.Config.NodeName` into
  `lease.NewLeaseManager`.
- `api/service/lease/instance.go` `GenerateInstanceID` — consumes it.
- Makefile (section 2.7) sets `SD_NODE_NAME` on every backend target.

A single process has no node identity; all of this goes away.

### 2.7 Makefile multi-instance targets (DELETE / simplify)

In `/Users/emikar/repos/satisfactory-dashboard/Makefile`:

- `backend` (line ~86): `SD_NODE_NAME=dev-backend go run main.go -api -publisher`
- `backend-live` (line ~90): `SD_NODE_NAME=dev-backend air`
- `backend-2` (line ~94): `SD_API_PORT=8082 SD_NODE_NAME=dev-backend-2 ... -api -publisher`
- `backend-api` (line ~98): `SD_NODE_NAME=dev-api-1 ... -api`
- `backend-poller` (line ~102): `SD_NODE_NAME=dev-poller-1 ... -publisher`
- `backend-api-2` (line ~106): `SD_API_PORT=8082 SD_NODE_NAME=dev-api-2 ... -api`
- `backend-poller-2` (line ~110): `SD_NODE_NAME=dev-poller-2 ... -publisher`
- `help` text (lines ~27-31) advertising the `*-api`/`*-poller`/`*-2` instance targets.

After the refactor there is exactly one backend invocation: `go run main.go` (no flags, no
`SD_NODE_NAME`, no `-api -publisher`). Delete `backend-2`, `backend-api`, `backend-poller`,
`backend-api-2`, `backend-poller-2` and their help lines; reduce `backend`/`backend-live` to
flagless invocations.

---

## 3. How leases are acquired / renewed / released (concise mechanics)

- Acquire: `SET poll:lease:<sessionID> <jsonValue> NX PX 30000` (after the rendezvous
  preferred-owner gate and the `init`-phase gate). Success -> record `LeaseInfo{state:owned}`.
- Renew: every 10s, Lua `renewScript` does owner-checked `SET`+`PEXPIRE 30000`. Failure ->
  mark `uncertain` (fail-closed; poller pauses).
- Re-acquire: uncertain leases are re-checked against Redis; restored if still owned, dropped
  otherwise.
- Release (voluntary): Lua `releaseScript` owner-checked `DEL`. Triggered by rebalance
  (non-preferred owner) or by `Release()`/shutdown.
- Expire (failover): if a process dies, the 30s TTL lets the key disappear and another node
  acquires it on its next attempt; heartbeat key (`poll:node:<id>`, TTL 30s) also expires so
  the dead node drops out of rendezvous.

## 4. How sessions are sharded across nodes

- Live nodes discovered via SCAN `poll:node:*` (cached, refreshed every 10s).
- For each session, `ComputePreferredOwner(sessionID, liveNodes)` = node with the highest
  FNV-1a HRW weight. The preferred owner aggressively acquires; non-preferred owners only
  acquire as fallback (unowned) and voluntarily release once the preferred owner is `online`.
- Net effect: roughly even, deterministic, stable distribution as the node set changes.

In a single-process world there is exactly one node, so every `ComputePreferredOwner` returns
that node and every session is owned locally — i.e. sharding is a no-op and can be deleted.

## 5. What a single-process replacement MUST still do

The poller responsibilities (everything in `session_manager.go` minus the lease logic):

1. Own ALL sessions: on startup, load every session from the store and start a poll loop for
   each non-paused session (no `TryAcquire`, no preferred-owner gate — start unconditionally).
2. One poll loop per session: keep the existing per-session goroutine model (`StartSession` ->
   `publishLoop` -> FRM `SetupEventStream`/`SetupLightPolling`).
3. Reconcile dynamically: keep `watchForNewSessions` (5s) — start newly-created/unpaused
   sessions, stop paused/deleted sessions. (Or replace the 5s poll with an in-process event
   when sessions change — doc 05's call.)
4. Connected/disconnected transitions: keep `transitionToDisconnected`/`transitionToConnected`
   + `restartPublisherLocked`.
5. Session-info monitoring: keep `monitorSessionInfo` (save-name tracking, game-time tracker,
   `SessionUpdate` publishing).
6. Per-event work: keep history storage for history-enabled types and "latest state" caching +
   event publish — but redirected to SQLite (history/state) and Go channels (live stream) per
   docs 03/04/05. The poll loop no longer needs any per-event ownership check; the loop runs
   for the lifetime of its ctx.
7. Lifecycle / shutdown: keep ctx-cancel-driven stop of all per-session goroutines. DROP the
   lease-release shutdown step. The `app.Stop()` `workerWg` 10s grace window (cmd/app.go) was
   sized for lease release; once leases are gone it only needs to wait for poll goroutines to
   exit, so it can be simplified.

What it must NOT do anymore: heartbeats, rendezvous hashing, lease acquire/renew/release/
re-acquire, uncertain-state pausing, node discovery, `IsOwnedStrict` pre-poll guard, the
`/v1/nodes` cluster view, node identity (`SD_NODE_NAME`).

---

## 6. DELETE list (authoritative)

Backend — delete entirely:
- `api/service/lease/manager.go`
- `api/service/lease/instance.go`
- `api/service/lease/rendezvous.go`
- `api/service/lease/types.go`
- `api/service/lease/lua_scripts.go`
- (the whole `api/service/lease/` package, plus any `*_test.go` in it)
- `api/routers/api/v1/nodes.go`
- `api/routers/routes/nodes.go` (and its registration in `api/routers/routes/routes.go`)
- `api/models/models/nodes.go` (`NodeInfo`, `SessionLease`, `NodesResponse`)

Backend — remove code paths (file survives):
- `api/cmd/flag.go`: remove `publisher` and `settings-listener` and `api` worker flags, the
  `Run func` mechanism, `FlagTypeWorker`, `AnyWorkerFlagsPassed` (the whole worker-flag concept;
  keep only `mode` if still needed).
- `api/cmd/app.go`: remove the worker-flag loop, `validateApp` "start all workers" logic, the
  `api`-flag-gated HTTP-server branch (just always start it); simplify `Stop()` grace window.
- `api/worker/session_manager.go`: remove `globalLeaseManager` globals + getters/setters,
  `leaseManager` field + constructor param, all `TryAcquire`/`IsOwned`/`IsUncertain`/
  `IsOwnedStrict` calls, lease-related shutdown, and the lease-manager wiring in
  `SessionManagerWorker`.
- `api/pkg/config/config.go`: remove `NodeName` field.
- `api/pkg/config/environment.go`: remove the `SD_NODE_NAME` read block (lines ~40-43).

Frontend — delete:
- `dashboard/src/services/nodesApi.ts`
- `dashboard/src/sections/debug/view/debug-nodes-view.tsx` (+ remove its export in `index.ts`)
- `dashboard/src/pages/debug-nodes.tsx`
- nodes route entry in `dashboard/src/routes/sections.tsx`
- nodes nav entry in `dashboard/src/layouts/config-nav-dashboard.tsx` (lease-node debug item)
- generated `NodeInfo`/`SessionLease`/`NodesResponse` from `dashboard/src/apiTypes.ts`
  (auto-removed on type regen once Go models are deleted)

Build / ops — delete or simplify:
- Makefile targets: `backend-2`, `backend-api`, `backend-poller`, `backend-api-2`,
  `backend-poller-2` and their `help` lines; simplify `backend`/`backend-live` to flagless,
  `SD_NODE_NAME`-free invocations.

Spec — historical, can be archived/removed:
- `specs/002-redis-poll-lease/` (the entire feature spec describing this solution).
