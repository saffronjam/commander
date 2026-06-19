# Redis Inventory — Current Backend

Exhaustive inventory of every Redis touchpoint in `api/`, classified by role
(cache / pub-sub stream / lease-coordination / auth-settings store) and mapped to
its replacement (Go channel for LIVE, SQLite for stateful/history, in-memory for
ephemeral coordination).

## Dependency & wiring

- `api/go.mod` line 12: `github.com/redis/go-redis/v9 v9.17.2` — the only Redis dep. Remove on completion.
- `api/pkg/db/db.go` — singleton `db.DB Context{ RedisClient *redis.Client }`. `Setup()` calls `setupRedis()`; `Shutdown()` calls `shutdownRedis()`.
- `api/pkg/db/redis.go` — `NewClient` against `config.Config.Redis.URL` / `.Password`, DB 0. **Also runs `CONFIG SET notify-keyspace-events Ex`** (line 31) to enable keyspace expiry events. (Note: no code currently consumes expired-key events — see `SetUpExpirationListener`, which is defined but has no callers.)
- `api/pkg/config/config.go` lines 15–18: `Redis struct { URL; Password }`. Config yaml: `config.docker.yml` (`url: redis:6379`), `config.local.yml`. No `SD_REDIS_*` env binding in `environment.go` — URL is yaml-only.
- `api/cmd/app.go:53`: init task `"Setup DB" -> db.Setup()`.
- All access goes through one thin wrapper: `api/pkg/db/key_value/client.go` (`key_value.Client` wrapping `db.DB.RedisClient`). Methods: `Get/Set/Del/SetNX/SetXX/IsSet/Incr/Decr/List(KEYS)/Publish/AddListener(SUBSCRIBE)/ZAdd/ZRangeByScore/ZRemRangeByScore/SetUpExpirationListener(PSUBSCRIBE)`. The lease package also reaches `client.RedisClient` directly for `SetNX`, `Get`, `Scan`, and Lua `EVAL` (`renewScript`, `releaseScript`).

`Incr`, `Decr`, `SetXX` on the KV client have **no callers** — dead surface, drop them.

---

## 1. Redis-as-CACHE — live state snapshot (`state:*`)

**Files:** `api/service/session/cache.go`, written by `api/worker/session_manager.go` (publishLoop + monitorSessionInfo).

- **Key schema:** `state:{sessionID}:{saveName}:{eventType}` — `stateKey()` (cache.go:30). eventType is a `models.SatisfactoryEventType` (e.g. `circuits`, `factoryStats`, `players`, `belts`, `hypertubes` …).
- **Data shape:** JSON-marshalled `event.Data` payload for that event type (a slice or struct from `models`). Composite: `hypertubes` stores `models.Hypertubes` then split into `state.Hypertubes` + `state.HypertubeEntrances` on read.
- **Write:** `session_manager.go:333-339` — on every poll result, `Set(cacheKey, json(e.Data), 0)` (no TTL). One key per event type, overwritten each poll cycle.
- **Read:** `GetCachedState(sessionID, saveName)` (cache.go:36) does ~22 individual `Get()` calls, one per event type, assembling a `*models.State`. Cache miss → empty default. This is the data source for **every GET data endpoint** (see fan-out below).
- **Existence check:** `GetSessionStage` / `IsSessionReady` (cache.go:130-147) iterate `models.RequiredEventTypes` (11 types, session.go:14) calling `IsSet()`; if all present → `SessionStageReady` else `SessionStageInit`.
- **Cleanup:** `ClearCachedState(sessionID)` (cache.go:109) — `List("state:{sessionID}:*")` (KEYS) then `Del` each. Called from session delete handler (`sessions.go:156`).
- **Role:** KV-state cache (latest live snapshot, no expiry).
- **Maps to:** This is the "latest value" of the live stream. Replacement = **in-memory** latest-state map maintained by the single in-process poller (per session/save/eventType), fed straight to GraphQL `Query.state`. Does NOT need SQLite (it is ephemeral, reconstructed on next poll). The poller already holds it before publishing; expose a `LatestState(sessionID)` accessor from the eventbus/poller instead of a Redis read. Session-stage (`init`/`ready`) becomes "have we received all RequiredEventTypes since poller start" — track in-memory per session.

### Cache read fan-out (every consumer that calls `GetCachedState`)
All in `routers/api/v1/`, all become GraphQL query resolvers reading the in-memory latest-state:
`state.go:43`, `status.go:40`, `circuits.go:41`, `stats.go` (40/74/108/142 — generator/prod/factory/sink), `players.go:41`, `drones.go` (41/81/121), `trains.go` (41/81/121), `infrastructure.go` (41/81/121/156/191 — belts/pipes/rails/cables/etc), `world.go` (40/75/110/145/180/215/250), `machines.go:40`, `schematics.go:41`, `resource_nodes.go:40`. ~30 call sites total.

---

## 2. Redis-as-STREAM — SSE backing pub/sub (`satisfactory_events:{sessionID}`)

**Files:** publisher `api/worker/session_manager.go`; subscriber `api/routers/api/v1/events_sse.go`.

- **Channel schema:** `{SatisfactoryEventKey}:{sessionID}` where `SatisfactoryEventKey = "satisfactory_events"` (`models/models/satisfactory_event.go:32`). Built in two places: `session_manager.go:254` and `events_sse.go:166`.
- **Payload:** JSON of `models.SatisfactoryEvent` (`{Type, Data, GameTimeID}`).
- **Publish:** `session_manager.go:343` (`kvClient.Publish(channelKey, asJson)` per poll event) and `:446` (session-update event from `monitorSessionInfo` when save name changes — `SatisfactoryEventSessionUpdate`).
- **Subscribe:** `events_sse.go:169` — `key_value.New().AddListener(ctx, channelKey, ...)` → Redis `SUBSCRIBE` with 1000-buffered channel (client.go:96-126). Each SSE HTTP connection opens its own Redis subscription; messages pushed into a per-connection `CoalescingQueue` (dedupe by event type) then streamed via gin `SSEvent`.
- **Role:** pub/sub fan-out stream backing SSE — the LIVE data path.
- **Maps to:** **Go channels / in-process eventbus** (plan 05). Poller publishes `SatisfactoryEvent` to a topic keyed by sessionID; GraphQL subscription resolvers subscribe per connection. The 1000-buffer + coalescing-by-event-type semantics must be preserved as fan-out + per-subscriber buffered channel with latest-wins coalescing. The `SatisfactoryEventSessionUpdate` event also flows here. No SQLite, no Redis.

---

## 3. Redis-as-STREAM — settings change pub/sub (`settings_changed`)

**Files:** `api/service/settings/service.go`, listener `api/worker/settings_listener.go`.

- **Channel:** `settings_changed` (`SettingsChangedChan`, service.go:12).
- **Payload:** JSON `models.SettingsChangedEvent` (`{Settings, Changes}`; model comment at `settings.go:85`).
- **Publish:** `service.go:91` on `Update()` when `len(changes) > 0`.
- **Subscribe:** `settings_listener.go:77` via `AddListener`; applies changes (currently only `logLevel` → `log.SetLogLevel`).
- **Role:** pub/sub coordination to propagate settings to all instances (cross-instance only matters in the distributed model).
- **Maps to:** In single-process world this is **in-memory** (a Go channel or direct call). The listener becomes a simple in-process subscriber, or settings `Update()` directly invokes the log-level apply. Since there's only one process, the cross-instance broadcast disappears entirely. (Settings *storage* moves to SQLite — see §6.)

---

## 4. Redis-as-CACHE/KV — settings storage (`global:settings`)

**File:** `api/service/settings/service.go`.

- **Key:** `global:settings` (`SettingsKey`, service.go:11) — single global key.
- **Data:** JSON `models.Settings`. `DefaultSettings()` written on first read (`initializeDefaults`).
- **Access:** `Get()` (read, lazy-init defaults), `Update()` (validate → diff → `Set(.., 0)` → publish). No TTL.
- **Role:** KV config store (singleton).
- **Maps to:** **SQLite** — a `settings` table (single-row, or key/value rows). Config data, persistent. Replaces the `global:settings` key.

---

## 5. Redis-as-AUTH store (`auth:password`, `auth:token:{token}`)

**File:** `api/service/auth/auth.go`. (Sibling `rate_limiter.go` is pure in-memory `sync.Map`, no Redis — keep as-is.)

- **Password key:** `auth:password` (passwordKey, auth.go:17). Value = bcrypt hash string, no TTL. `InitializePassword` (`IsSet`+`Set`, bootstrap default `change-me`), `ValidatePassword`/`IsUsingDefaultPassword` (`Get`), `ChangePassword` (`Set`).
- **Token keys:** `auth:token:{token}` (tokenKeyPrefix, auth.go:18). Value = JSON `TokenData{CreatedAt, LastUsed, ClientIP}`. **TTL = 7 days** (`tokenTTL`, auth.go:22). `StoreToken`/`RefreshToken` (`Set` with TTL — refresh re-sets TTL), `ValidateToken` (`Get`), `DeleteToken` (`Del`).
- **Role:** KV auth/session store; tokens rely on Redis TTL for expiry.
- **Maps to:** **SQLite**. `auth_password` (single row, bcrypt hash) and `auth_tokens(token PK, created_at, last_used, client_ip, expires_at)`. TTL must be reimplemented as an `expires_at` column + lazy check on read and/or a periodic prune (no Redis auto-expiry). `GetTokenTTL()` stays as a Go const for cookie max-age. Bootstrap-password logic stays identical (insert if absent).

---

## 6. Redis-as-KV — session store (`session:{id}`)

**File:** `api/service/session/store.go`.

- **Key:** `session:{id}` (sessionKeyPrefix, store.go:16). Value = JSON `models.Session` (`{ID, Name, Address, SessionName, IsOnline, IsPaused, IsDisconnected, CreatedAt, …}`; session.go). No TTL.
- **Access:** `Create/Get/Update/Delete`; `List()` via `List("session:*")` (KEYS) then per-key `Get`; `UpdateOnlineStatus`, `UpdateDisconnectedStatus` (read-modify-write).
- **Consumers:** session manager worker (`store.List()` every 5s in `watchForNewSessions`, online/disconnect status writes), `nodes.go` handler, session CRUD handlers.
- **Role:** KV config/state store for session config + transient connection status.
- **Maps to:** **SQLite** `sessions` table (one row per session, columns mirroring `models.Session`). `List` becomes `SELECT *`. `IsOnline`/`IsDisconnected` are transient runtime state — could stay columns (updated by poller) or move to in-memory; keep as columns for simplicity (single writer). The 5s polling watch loop becomes redundant once the poller is in-process (it can be started/stopped directly on session CRUD), but the table is the source of truth.

---

## 7. Redis-as-KV — deleted-session tombstone (`deleted-session:{id}`)

**File:** `api/service/session/cache.go`.

- **Key:** `deleted-session:{sessionID}`, value `"1"`, **TTL = 24h** (`deletedSessionTTL`, cache.go:12).
- **Access:** `MarkSessionDeleted` (`Set` TTL) at delete (`sessions.go:151`); `IsSessionDeleted` (`IsSet`) — checked in `StoreHistoryPoint` (cache.go:189) and `session_manager.go:269` to prevent in-flight pollers from re-inserting data for a just-deleted session.
- **Role:** coordination guard against race between delete and in-flight distributed pollers.
- **Maps to:** **Eliminated / in-memory.** In a single in-process poller, deletion synchronously cancels the poller goroutine, so the tombstone race largely disappears. If a guard is still wanted, an in-memory set with the same 24h semantics, or a deleted-at column / hard delete in SQLite. No Redis.

---

## 8. Redis-as-HISTORY — time-series sorted sets (`history:*`)

**Files:** `api/service/session/cache.go` (history funcs), written by `api/worker/session_manager.go` handler, read by `api/routers/api/v1/history.go`.

- **Index key (ZSET):** `history:{sessionID}:{saveName}:{dataType}` (`historyKey`, cache.go:173). Member = `"{gameTimeID}"` (member is gameTimeID only, so re-add at same game-time overwrites — handles save rollback). Score = `float64(gameTimeID)`.
- **Data key (string):** `history:{sessionID}:{saveName}:{dataType}:data:{gameTimeID}` (cache.go:209). Value = JSON `models.DataPoint{GameTimeID, DataType, Data}` (`models/models/data_point.go`). No TTL (manually pruned).
- **dataType set:** only the 5 `historyEnabledTypes` (session_manager.go:20-26): `circuits`, `generatorStats`, `prodStats`, `factoryStats`, `sinkStats`.
- **Write:** `StoreHistoryPoint` (cache.go:188) — `Set(dataKey)` then `ZAdd(indexKey, score, member)`. Called from poll handler (`session_manager.go:296`) for history-enabled types when `saveName != "" && gameTimeID > 0`.
- **Read:** `GetHistory(sessionID, saveName, dataType, sinceID)` (cache.go:225) — `ZRangeByScore(key, sinceID+1, maxScore)` for incremental fetch, then `Get` each data key, returns `models.HistoryChunk{DataType, SaveName, LatestID, Points}`. Endpoint `history.go:90`.
- **Save discovery:** `GetHistorySaves(sessionID)` (cache.go:273) — `List("history:{sessionID}:*")` (KEYS) + `extractSaveName` parse. Endpoint `history.go:129`.
- **Prune:** `PruneOldHistory(...)` (cache.go:319) — cutoff `currentGameTimeID - maxDurationSeconds` (`config.Config.MaxSampleGameDuration`, set via env `SD_MAX_SAMPLE_GAME_DURATION` in `environment.go:63`). `ZRangeByScore(0, cutoff)` → `Del` each data key → `ZRemRangeByScore(0, cutoff)`. Called every poll (`session_manager.go:300`).
- **Cleanup:** `ClearHistoryData(sessionID)` (cache.go:153) — `List("history:{sessionID}:*")` + `Del`. Called on session delete (`sessions.go:159`).
- **Role:** persistent historical time-series store (ZSET index + per-point JSON values).
- **Maps to:** **SQLite** `history_points` table, e.g. `(session_id, save_name, data_type, game_time_id, data BLOB/JSON, PRIMARY KEY (session_id, save_name, data_type, game_time_id))`. ZSET score-ordering → `ORDER BY game_time_id`; member-overwrite-on-same-gameTimeID → `INSERT ... ON CONFLICT DO UPDATE` (upsert). `GetHistory sinceID` → `WHERE game_time_id > ?`. `GetHistorySaves` → `SELECT DISTINCT save_name`. `PruneOldHistory` → `DELETE WHERE game_time_id < cutoff`. `ClearHistoryData` → `DELETE WHERE session_id = ?` (or FK cascade from sessions). This is the primary SQLite history target.

---

## 9. Redis-as-LEASE-COORDINATION (distributed polling) — `poll:lease:*`, `poll:node:*`

**Files:** entire `api/service/lease/` package (manager.go, instance.go, lua_scripts.go, rendezvous.go, types.go); consumed by `api/worker/session_manager.go` and `api/routers/api/v1/nodes.go`.

- **Lease key:** `poll:lease:{sessionID}` (leaseKeyPrefix, manager.go:95). Value = JSON `RedisLeaseValue{OwnerID, AcquiredAt, LastRenewedAt}` (types.go:137). **TTL = LeaseTTL (30s default)** (types.go:84).
  - Acquire: `SetNX(key, val, LeaseTTL)` (manager.go:848).
  - Renew: Lua `renewScript` (lua_scripts.go:12) — `GET`, cjson-decode, compare `owner_id`, `SET`+`PEXPIRE` if owner. Run every RenewalInterval (10s).
  - Release: Lua `releaseScript` (lua_scripts.go:38) — conditional `DEL` if owner.
  - Reads: `GetLeaseOwner`/`GetLeaseValue`/`IsOwnedStrict`/`tryReacquireLease` via `Get`.
- **Node heartbeat key:** `poll:node:{instanceID}` (nodeKeyPrefix, instance.go:21). Value = JSON `HeartbeatData{Status("init"/"online"), StartupTime}`. **TTL = HeartbeatTTL (30s)**. `RegisterHeartbeat`/`RefreshHeartbeat` (`Set` TTL), `RemoveHeartbeat` (`Del`), `GetLiveNodes` (`SCAN poll:node:*`, instance.go:107), `GetNodeStatus` (`Get`).
- **Rendezvous hashing:** `rendezvous.go` (FNV-1a HRW) picks preferred owner among live nodes — pure in-memory, no Redis.
- **Instance identity:** `GenerateInstanceID` uses `config.Config.NodeName` (env `SD_NODE_NAME`, `environment.go:40`) or hostname+boot+uuid.
- **Lifecycle:** `SessionManagerWorker` (session_manager.go:537) creates+starts `LeaseManager`; `StartSession` calls `TryAcquire` before spawning a publisher; the poll handler re-checks `IsOwned`/`IsUncertain`/`IsOwnedStrict` (session_manager.go:274,356) and stops the publisher if the lease is lost.
- **Role:** distributed coordination locks + cluster membership — the entire "distributed polling" solution.
- **Maps to:** **DELETED ENTIRELY** (plan 02). Single in-process poller owns every session unconditionally; no leases, no heartbeats, no rendezvous, no `SD_NODE_NAME`. `StartSession` just spawns the goroutine. `nodes.go` endpoint + `models.Nodes*` types + `globalLeaseManager` go away. This is coordination state that has **no replacement** — it ceases to exist.

---

## Summary table

| # | Redis object | Key/Channel | Role | TTL | Replacement |
|---|---|---|---|---|---|
| 1 | live state cache | `state:{sid}:{save}:{evt}` | KV cache | none | in-memory latest-state in poller |
| 2 | SSE events | `satisfactory_events:{sid}` (pub/sub) | stream | — | Go channel eventbus |
| 3 | settings change | `settings_changed` (pub/sub) | stream | — | in-memory (single proc) |
| 4 | settings store | `global:settings` | KV config | none | SQLite `settings` |
| 5a | auth password | `auth:password` | KV auth | none | SQLite `auth_password` |
| 5b | auth tokens | `auth:token:{tok}` | KV auth | 7d | SQLite `auth_tokens` (+expires_at) |
| 6 | session store | `session:{id}` | KV state | none | SQLite `sessions` |
| 7 | delete tombstone | `deleted-session:{id}` | coordination | 24h | eliminated / in-memory |
| 8 | history index | `history:{sid}:{save}:{type}` (ZSET) | history | none (pruned) | SQLite `history_points` |
| 8 | history data | `history:...:data:{gtid}` (string) | history | none (pruned) | SQLite `history_points.data` |
| 9a | poll lease | `poll:lease:{sid}` | coordination lock | 30s | DELETED |
| 9b | node heartbeat | `poll:node:{iid}` | coordination | 30s | DELETED |

## Notable side effects / gotchas to carry into plans

- `redis.go:31` runs `CONFIG SET notify-keyspace-events Ex` at startup but **nothing consumes** expired-key events (`SetUpExpirationListener` has zero callers). Pure dead path — drop with Redis.
- KV client methods `Incr`, `Decr`, `SetXX`, `SetUpExpirationListener` have **no callers** — dead surface.
- All TTL-based expiry (auth tokens 7d, lease 30s, heartbeat 30s, tombstone 24h) currently relies on Redis auto-eviction. Only the auth-token TTL needs reimplementing in SQLite (`expires_at` + prune); the rest belong to the deleted lease subsystem.
- `state:` and `history:` keys are **save-name-scoped** (`saveName` segment) — the SQLite schema must keep `save_name` as a column to preserve per-save isolation (this was an intentional recent fix, commit `0a12da81`).
- Two separate constructions of the SSE channel key string (`session_manager.go:254`, `events_sse.go:166`) must agree — when moving to channels, centralize the topic key.
- `models.DataPoint` and `models.SatisfactoryEventKey` carry Redis-implementation comments; update when migrating.
- Config: drop `Redis` struct from `config.go` and the `redis:` blocks in `config.docker.yml` / `config.local.yml`; drop `NodeName`/`SD_NODE_NAME` (environment.go:40) with the lease subsystem; keep `MaxSampleGameDuration`/`SD_MAX_SAMPLE_GAME_DURATION` (still drives history pruning).
