# Research: History / Persistence Feature (current state)

Scope: document the current data-history persistence feature (spec `006-data-history-persistence`)
so a plan author can move it to SQLite + sqlc and expose it via GraphQL queries. This is the
time-series history subsystem only (NOT the live-state cache or session store, though they share
keying conventions and are noted where relevant).

## 1. What is retained (the time-series metrics)

Only five "history-enabled" event types are sampled and stored. The allow-list exists in two places
that MUST stay in sync:

- Backend writer: `api/worker/session_manager.go:19-26` (`historyEnabledTypes`, keyed by
  `models.SatisfactoryEventType`).
- Backend reader: `api/routers/api/v1/history.go:11-18` (`historyEnabledTypes`, keyed by string).
- Frontend: `dashboard/src/services/historyApi.ts:9-14` (`HistoryDataType` union).

| dataType         | Go payload type             | Description            |
| ---------------- | --------------------------- | ---------------------- |
| `circuits`       | `[]models.Circuit`          | Power circuit data     |
| `generatorStats` | `models.GeneratorStats`     | Generator production   |
| `prodStats`      | `models.ProdStats`          | Production statistics  |
| `factoryStats`   | `models.FactoryStats`       | Factory efficiency     |
| `sinkStats`      | `models.SinkStats`          | Awesome Sink metrics   |

Each stored sample is a `models.DataPoint` (`api/models/models/data_point.go`):
```
DataPoint { GameTimeID int64; DataType string; Data any }
```
`Data` is the entire event payload, stored as opaque JSON. There is no per-metric column
decomposition today — the whole struct is serialized as one JSON blob.

All other event types (players, vehicles, belts, pipes, cables, machines, etc.) are NOT historized;
they only live in the state cache.

## 2. Sampling cadence and the game-time key

- Cadence is driven by the FRM poller, NOT by a separate sampling timer. Each of the five
  history-enabled events is polled every **4 seconds** (see `api/CLAUDE.md` polling table:
  circuits 4s, factoryStats 4s, prodStats 4s, sinkStats 4s, generatorStats 4s). Every poll that
  produces one of these events writes one history point.
- The sample KEY is `GameTimeID` = the in-game `TotalPlayDuration` in seconds, computed by
  `GameTimeTracker` (`api/service/session/game_time.go`):
  - On each `getSessionInfo` poll the tracker records `OffsetSeconds = TotalPlayDuration` and
    `ProbedAt = now` (`Update`, called at `session_manager.go:413`).
  - `CurrentGameTime() = OffsetSeconds + floor(seconds since ProbedAt)` — i.e. game-time is
    interpolated from wall-clock between the ~5s session-info polls. Returns 0 if uninitialized.
- At write time (`session_manager.go:288-304`): if the event is history-enabled, `saveName != ""`,
  and `gameTimeID > 0`, the code:
  1. sets `event.GameTimeID = gameTimeID` (so SSE subscribers learn the latest id),
  2. calls `session.StoreHistoryPoint(...)`,
  3. calls `session.PruneOldHistory(...)`.
- Because game-time is computed in 1-second resolution but polls fire every 4s, distinct points
  are usually ~4s apart in `GameTimeID`. Two points landing on the same `GameTimeID` OVERWRITE
  (see keying below) — this is the rollback-dedup mechanism, not an error.

## 3. Current storage: Redis (two keys per point)

Implemented in `api/service/session/cache.go:149-354`. Despite the spec's data-model.md describing a
single ZSET member holding JSON, the actual implementation uses a **ZSET index + a separate string
key per data point**:

- Index (sorted set): `history:{sessionID}:{saveName}:{dataType}`
  - score = `GameTimeID`, member = the stringified `GameTimeID` (`historyMemberKey`).
  - Using the game-time as the member makes `ZADD` idempotent/overwriting at the same game-time
    (handles save rollback — see spec User Story 4).
- Payload (string): `history:{sessionID}:{saveName}:{dataType}:data:{GameTimeID}`
  - value = JSON-encoded `DataPoint`.

Note: `cache.go:172` `historyKey` is duplicated logically against the live-state cache key
`stateKey = state:{sessionID}:{saveName}:{eventType}` (`cache.go:30`). History and live-state share
the `{sessionID}:{saveName}` partitioning.

### Storage operations (Redis verbs used)
- Write: `StoreHistoryPoint` -> `Set(dataKey)` then `ZAdd(indexKey, score=gameTimeID, member)`
  (`cache.go:188-220`). Early-returns silently if `IsSessionDeleted(sessionID)` (a tombstone key
  `deleted-session:{id}` with 24h TTL, `cache.go:14-26`).
- Read: `GetHistory` -> `ZRangeByScore(indexKey, min, max)` then a `Get` per member to load the
  JSON payload (`cache.go:225-269`). N+1 reads (one GET per point) — this is the hot path the
  SQLite move should collapse into a single ranged query.
- Prune: `PruneOldHistory` -> `ZRangeByScore(0, cutoff)`, delete each `:data:` key, then
  `ZRemRangeByScore(0, cutoff)` (`cache.go:319-354`).
- List saves: `GetHistorySaves` -> `List("history:{sessionID}:*")` + parse save name out of key
  (`cache.go:273-314`, `extractSaveName`). Relies on Redis KEYS-style scan.
- Clear all: `ClearHistoryData` -> `List("history:{sessionID}:*")` + `Del` each (`cache.go:153-170`).
  Called on session delete.

Redis primitives are in `api/pkg/db/key_value/client.go` (`ZAdd`, `ZRangeByScore`,
`ZRemRangeByScore`, `List`, `Set`, `Get`, `Del`).

## 4. Retention / eviction rules

- Single knob: `Config.MaxSampleGameDuration` (int64, seconds), from env
  `SD_MAX_SAMPLE_GAME_DURATION` (`api/pkg/config/environment.go:55-65`,
  `api/pkg/config/config.go:13`). Optional; if unset it stays 0 (no validation runs), and prune
  is a no-op (`PruneOldHistory` returns early when `maxDurationSeconds <= 0`). When set it must be
  a positive integer.
- Semantics are **GAME-TIME, not wall-clock**: retention window is measured in game-time seconds.
  Eviction cutoff = `currentGameTimeID - MaxSampleGameDuration`. All points with
  `GameTimeID <= cutoff` are removed (`cache.go:319-354`). If cutoff <= 0 nothing is pruned.
- Eviction runs inline on every history write (one prune call per stored point,
  `session_manager.go:300`), scoped to that one `{session, save, dataType}`. There is no background
  sweeper and no TTL on the history keys themselves.
- Retention is per session and applies uniformly to all saves/types of that session (the same
  duration value). Different saves under one session each get pruned against their own current
  game-time.

## 5. Save-name partitioning and rollback handling

- Data is partitioned per `saveName` (the game session/save name from `getSessionInfo`, tracked on
  the publisher state via `state.GetSaveName()`). Switching saves writes to a new key namespace; old
  save data is preserved and remains queryable (spec data-model.md "Save Name Change").
- Rollback (game-time jumps backward, detected by `GameTimeTracker.Update` returning a
  `TimeDiscontinuity`, `game_time.go:32-58`): the tracker logs it but does NOT delete data. Because
  the ZSET member is the game-time id, re-reaching an old game-time overwrites the prior "future"
  point at that score. The discontinuity struct is currently only logged, not acted upon for storage.

## 6. HTTP API surface (to be replaced by GraphQL)

Routes (`api/routers/routes/history.go`), both private + gated by `RequireSessionReady()`:

- `GET /v1/sessions/:id/history` -> `ListHistorySaves`
  Response `models.HistorySavesResponse { saveNames []string; currentSave string }`.
- `GET /v1/sessions/:id/history/:dataType` -> `GetHistory`
  Query params: `saveName` (default = session's current save name),
  `since` (int, non-negative; returns points with `gameTimeId > since`).
  Response `models.HistoryChunk { dataType, saveName, latestId, points []DataPoint }`
  (`api/models/models/history_chunk.go`). Points ordered ascending by `gameTimeId`.

Handler validates dataType against the allow-list and 404s on unknown session.

Note: the frontend service (`historyApi.ts:96-98`) also sends a `limit` query param, but the
backend `GetHistory` handler does NOT parse `limit` — it is silently ignored today. The handler also
does not implement server-side downsampling; it returns every raw point in range.

## 7. Frontend consumption — exact query shapes needed

`dashboard/src/services/historyApi.ts` + `dashboard/src/hooks/useHistoryData.ts`.

Pattern per chart: `useHistoryData<T>(sessionId, dataType, historyDataRange, historyWindowSize, saveName?)`.

Call sites (all reading from user `settings.historyDataRange` / `settings.historyWindowSize`):
- `overview-analytics-view.tsx:38-57`: `circuits`, `prodStats`, `sinkStats`.
- `production-view.tsx:264`: `prodStats`.

### Two-phase fetch (initial + incremental), driven by SSE
1. Initial load (`fetchInitialHistory`, `useHistoryData.ts:75-112`): fetch with NO `since` (full
   history for the save), then CLIENT-SIDE prune to `latestId - historyDataRange` (unless range
   is -1 = all time).
2. Incremental (`fetchIncrementalHistory`, `useHistoryData.ts:114-164`): triggered whenever the
   matching live context field updates via SSE AND session is online. Fetches with
   `since = lastKnownLatestId`, dedups by `gameTimeId`, merges, re-sorts ascending, and re-prunes
   the client window. This is effectively long-polling-keyed-by-SSE — the GraphQL design should
   replace it with a subscription that pushes new points (the live event already carries
   `GameTimeID`), plus a query for the initial window.

### Range / windowing semantics the new query layer must support
- `historyDataRange` (seconds, or `-1` = all time): presets `60,120,180,240,300,600,3600,28800,-1`
  plus arbitrary numbers (`types.ts:118-125`). Used to compute `since = currentGameTime - range`
  (server-side intent in `historyApi.ts:calculateSince:34-52`) and to client-prune.
- `historyWindowSize` (downsampling bucket, seconds): presets `0,1,5,10,30,60,300`
  (`types.ts:131-139`). `0` = auto (`max(1, floor(range/100))`, targeting ~100 points), `1` = raw,
  else fixed bucket. Downsampling is done ENTIRELY client-side today
  (`downsampleDataPoints`, `useHistoryData.ts:8-29`): bucket by
  `floor(gameTimeId / windowSize) * windowSize`, keep the LAST point per bucket.

### Query shapes the SQLite/GraphQL backend should be able to serve
1. List saves for a session (+ current save).
2. Get points for `{session, save, dataType}` with: optional `since` (gameTimeId >), optional time
   range `[minGameTime, maxGameTime]`, optional `limit`, ordered ascending, returning `latestId`.
3. (New, to fix N+1 + over-fetch) server-side downsample by window bucket so the client does not
   pull every raw 4s point over an 8h range. Today the frontend pulls raw and buckets in JS.

## 8. Open coupling to the wider refactor

- History shares the `{sessionID}:{saveName}` partition key with the live-state cache and depends on
  `GameTimeTracker` living in the polling publisher (in-memory, per publisher). In the
  single-process poller, the tracker stays in-process; persistence moves from Redis to SQLite.
- The "deleted session tombstone" (`deleted-session:{id}`, 24h TTL) exists to stop distributed
  pollers writing after delete. With a single in-process poller this race largely disappears; a
  SQLite FK / direct delete replaces both the tombstone and `ClearHistoryData`.
- `event.GameTimeID` on the SSE payload (`satisfactory_event.go:38`) is how clients track position;
  the GraphQL subscription for live data must keep carrying this id so the client can stitch
  subscription points onto the queried history window.
