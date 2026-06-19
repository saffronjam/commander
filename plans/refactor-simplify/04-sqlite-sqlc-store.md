# 04 — SQLite + sqlc + golang-migrate store

## Context

Today every durable and historical byte in the backend lives in Redis: session config
(`session:{id}`), settings (`global:settings`), the shared-password and access tokens
(`auth:password`, `auth:token:{tok}`), and the time-series history (a ZSET index plus a
JSON string per point under `history:{sid}:{save}:{type}`). The refactor goal #3 deletes
Redis entirely. Live data moves to in-process Go channels (plan 05); everything that must
survive a restart moves into a single embedded SQLite database written and read by the one
backend process.

This document is the store layer. It produces, end to end: `sqlc.yaml`; the
`internal/store/migrations/` directory with numbered up/down SQL for **all** stateful data
(sessions, auth, settings, and the history time-series); `internal/store/queries/*.sql`
with sqlc annotations; the generated `internal/store/sqlite/` package; the hand-written
`internal/store` wrapper (`*DB`, `execTx`, per-domain methods, retention loop); the
embed + migrate-on-startup runner using `modernc.org/sqlite` with WAL pragmas; the DB-file
volume in `compose.yml`; and the Makefile targets that hold the store's slice of `make
generate`.

This plan conforms to the authoritative contract in **08-data-model-and-schema.md**: the
table set, columns, indexes, sqlc overrides, and the canonical `make generate` recipe are
defined there; 04 turns them into migrations, queries, and the generated/hand-written store.
Where 04 previously disagreed with 08 (an extra `history_samples` name, runtime status
columns on `sessions`, AVG bucketing, `password_hash` naming), it now matches 08 exactly.

We copy the saffron-hive recipe (`/Users/emikar/repos/saffron-hive`) verbatim where it
fits. The one deliberate divergence is the **history table shape**: saffron-hive uses a
long-narrow EAV table (`device_id, field, value REAL, recorded_at`). Satisfactory's history
is five typed JSON payloads (`circuits`, `factoryStats`, `prodStats`, `generatorStats`,
`sinkStats`) keyed by **game-time seconds**, not wall-clock, with same-key overwrite as the
save-rollback dedup mechanism. We keep the JSON-blob-per-(session, save, type, gameTimeId)
model — it matches the existing `models.DataPoint` and the typed per-type GraphQL history
queries (plan 06/08, decision D-C/E-6) — while copying the reference's dual-index, raw +
bucketed query pair, and settings-driven retention loop. Retention stays **game-time** based
(the existing `SD_MAX_SAMPLE_GAME_DURATION` semantics), a clean adaptation of the reference's
wall-clock day-window pruner, not a copy of it. The resolver decodes the JSON `data` column
per `data_type` into the concrete `<Type>HistoryPoint` struct (plan 06); the store stays
payload-agnostic.

This store is consumed by: the GraphQL resolvers (plan 06) for queries/mutations, the
single in-process poller / history recorder (plan 05) for writes, and the migrate-on-boot
runner (plan 01/02). Live state never lands here — it lives only in the poller's in-memory
`LatestStore` and on the eventbus (decision: LIVE is ephemeral, 08).

## Settled design decisions

1. **Driver: `modernc.org/sqlite` (pure Go), `CGO_ENABLED=0`.** Import the driver for its
   side effect, use SQL driver name `"sqlite"`. This keeps the consolidated single-image
   build (plan 01) static. The reference's incidental `CGO_ENABLED=1` Dockerfile is not
   copied.

2. **sqlc reads migrations as the schema.** `sqlc.yaml` points `schema:` at
   `internal/store/migrations`. No separate `schema.sql`. The generated package
   `internal/store/sqlite/` is committed and CI-checked for drift (`make sqlc-check`).

3. **Migrate-on-startup, not a separate subcommand.** Unlike saffron-hive (which runs
   `app migrate up` as its own command), the consolidated single binary runs the iofs +
   `migrate.NewWithInstance` chain at the top of `serve` before `store.New`, then reuses
   the same `*sql.DB`. A `migrate` subcommand is still provided for ops (`up`/`down`/
   `version`), sharing the exact same runner. This is option (b) from ref-store §10 and is
   the simpler fit for one self-contained container.

4. **Two pragma strings.** Migrate path:
   `?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)`. Serve
   path adds `&_txlock=immediate` so `BeginTx` issues `BEGIN IMMEDIATE` — the history
   recorder writes concurrently with GraphQL reads, and deferred transactions return
   `SQLITE_BUSY` on lock-upgrade in a way `busy_timeout` does not cover. Under the capacity
   envelope (decision D-B: up to ~10 concurrent sessions, ~12 live types fast-tiered every
   few seconds + ~5 history writes/session) the single WAL writer is comfortable; beyond a
   few dozen sessions the single-writer model would need revisiting, which is explicitly out
   of scope.

5. **History is a JSON-payload table `history_points`, keyed by game-time (decision E-6).**
   One row per `(session_id, save_name, data_type, game_time_id)` with the full event payload
   as a JSON blob (`models.DataPoint.Data`); composite PRIMARY KEY, **no surrogate id, no
   `recorded_at`**. `INSERT ... ON CONFLICT DO UPDATE` reproduces the ZSET
   member-overwrite-at-same-game-time rollback dedup. `game_time_id` is an INTEGER (seconds of
   `TotalPlayDuration`), so ordering and range bounds are plain integer comparisons. `data_type`
   stays plain `TEXT` — it is **not** overridden to a typed enum at the sqlc layer (decision
   E-5); the resolver maps it to the GraphQL `HistoryDataType` enum.

6. **Retention is game-time, per (session, save, type), driven by a setting row, prunable
   live.** The cutoff is `currentGameTimeId - maxSampleGameDuration`. We seed the window
   into the `settings` table (`history.max_sample_game_duration`) so it is hot-reloadable,
   while `SD_MAX_SAMPLE_GAME_DURATION` becomes the bootstrap default that seeds the row on
   first migrate. A background retention loop replaces the current "prune inline on every
   write"; the recorder still passes the live `currentGameTimeId` so the loop knows each
   save's frontier.

7. **Typed string IDs via sqlc `overrides` — leaf packages only (decision E-5).**
   `sessions.id` and `history_points.session_id` map to `session.ID`; `auth_tokens.token`
   maps to `auth.Token`. Both are dependency-free `type X string` aliases in **leaf** packages
   (`internal/session`, `internal/auth`) so the generated params/rows are strongly typed
   without manual conversion and without import cycles, exactly as the reference maps
   `devices.id -> device.DeviceID`. **`history_points.data_type` is deliberately NOT
   overridden** — it stays `TEXT`/Go `string` in the store. There is no `models.*` override
   table.

8. **Bucketed history query for charting — keep-last, not AVG (decision E-6).** A `:many`
   server-side query keyed by `game_time_id / bucket_seconds` collapses the existing
   client-side `downsampleDataPoints` (history-persistence §7) into SQL. Because the payload
   is a heterogeneous JSON struct, not a flat scalar, bucketing keeps the **last** point per
   bucket (highest `game_time_id`); averaging heterogeneous JSON is impossible. The raw query
   returns whole JSON points; both shapes ship (see §7) and plan 06 chooses per-resolver. The
   wire-level argument is `maxPoints` (decision D-C/E-6); the resolver derives `bucket_seconds`
   from the requested range / `maxPoints` and passes it to the store.

9. **Auth cutover = CLEAN WIPE (decision D-A).** There is no Redis-to-SQLite data migration of
   the password or tokens. On first boot the DB is created empty; auth re-bootstraps to
   `SD_BOOTSTRAP_PASSWORD` (default `change-me`) with `is_default = 1`, and all previously
   issued access tokens are gone. This is an EXPLICIT, user-approved clean cutover, not an
   accidental loss of backward compatibility — see the RELEASE / UPGRADE NOTE in §9d. The
   store imports nothing from Redis.

---

## 1. Directory layout (files to ADD)

```
api/sqlc.yaml                              # see §11 on cwd
api/internal/store/
  migrations/
    001_initial_schema.up.sql
    001_initial_schema.down.sql
    002_history_points.up.sql
    002_history_points.down.sql
  queries/
    sessions.sql
    settings.sql
    auth.sql
    history.sql
  sqlite/                                  # GENERATED by sqlc (committed)
    db.go
    models.go
    querier.go
    sessions.sql.go
    settings.sql.go
    auth.sql.go
    history.sql.go
  migrations.go                            # //go:embed migrations/*.sql
  db.go                                    # *DB wrapper + execTx
  store.go                                 # domain param/result structs (hand-written)
  mapper.go                               # JSON (un)marshal + null helpers
  sessions.go                              # session domain methods
  settings.go                              # settings domain methods
  auth.go                                  # auth password + token domain methods
  history.go                               # history insert/query/prune domain methods
  retention.go                             # token prune + game-time history retention loop
  migration_test.go                        # up / up+down / idempotent against :memory:
api/internal/migrate/migrate.go            # shared up|down|version runner
api/internal/session/id.go                 # type ID string (leaf, dependency-free)
api/internal/auth/token.go                 # type Token string (leaf, dependency-free)
```

Note on module path: the existing backend module root is `api/` (its `go.mod` lives there).
All new packages are under `api/internal/...`; import path prefix is the module path in
`api/go.mod` (referred to below as `<module>`). The historical worker store
(`api/service/session/cache.go`, `api/service/session/store.go`,
`api/service/settings/service.go`, `api/service/auth/auth.go`) are DELETED and replaced by
calls into `<module>/internal/store` (handled in plans 02/03/06).

Separation of concerns (identical to the reference):
- `internal/store/sqlite/` is 100% sqlc-generated, committed, never hand-edited.
- `internal/store/*.go` are hand-written wrappers exposing **domain types**
  (`store.HistoryPoint`, `store.Session`, `store.Token`) and converting to/from the
  generated `sqlite.*Params`/`sqlite.*Row` internally. Callers never import the `sqlite`
  package.
- Consumers (poller, recorder, resolvers) depend on **narrow interfaces they declare
  locally**; `*store.DB` satisfies them structurally. No fat repository interface.

---

## 2. sqlc.yaml

Overrides are leaf-package only (decision E-5); `data_type` is NOT overridden.

```yaml
version: "2"
sql:
  - engine: "sqlite"
    schema: "internal/store/migrations"
    queries: "internal/store/queries"
    gen:
      go:
        package: "sqlite"
        out: "internal/store/sqlite"
        emit_interface: true
        emit_pointers_for_null_types: true
        overrides:
          - column: "sessions.id"
            go_type: "<module>/internal/session.ID"
          - column: "history_points.session_id"
            go_type: "<module>/internal/session.ID"
          - column: "auth_tokens.token"
            go_type: "<module>/internal/auth.Token"
```

`emit_pointers_for_null_types: true` makes nullable columns map to `*T`. All columns in this
schema are `NOT NULL`, so the only effect today is harmless; `mapper.go` still carries the
reference's `boolToNullInt64`/`nullInt64ToBool` helpers (free) in case a later migration
relaxes a column. `session.ID`/`auth.Token` are thin `type X string` aliases declared in
small leaf packages (`internal/session`, `internal/auth`) that import nothing from
`internal/store`; they replace the bare `string` IDs and keep the generated code typed.
**`history_points.data_type` is intentionally absent from `overrides`** — it stays `string`
in the generated params/rows and is mapped to the GraphQL `HistoryDataType` enum in the
resolver (decision E-5).

---

## 3. Migrations

### 3a. `001_initial_schema.up.sql` — sessions, settings, auth

Columns match 08's authoritative table set exactly: `sessions` carries only durable config;
the runtime status (`isOnline`/`isDisconnected`/`stage`) is NOT stored — it is a resolver
field read from the poller's in-memory state (08 "Models that do not cleanly fit" #1).
`auth_password` uses `hash` (decision E-7), and `auth_tokens` carries the superset columns
for sliding expiry + rate-limit context.

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    session_name TEXT NOT NULL DEFAULT '',
    is_paused INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE auth_password (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hash TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_tokens (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    client_ip TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);

INSERT INTO settings (key, value) VALUES ('log_level', 'INFO');
```

Notes:
- `sessions` stores only `id/name/address/session_name/is_paused/created_at` (08). The
  GraphQL `Session.isOnline`/`isDisconnected`/`stage` are **resolver fields** read from the
  poller's in-memory map and streamed live by `connectivityChanged`; they are never columns.
  `consecutiveFailures` is likewise pure in-memory poller state. This removes the previous
  draft's `is_online`/`is_disconnected` columns and the `UpdateSessionRuntime` write of them.
- `auth_password` is a singleton (`CHECK (id = 1)`); `is_default` replaces the
  `IsUsingDefaultPassword` Redis read (redis-inventory §5). The bootstrap default
  (`change-me` / `SD_BOOTSTRAP_PASSWORD`) is NOT seeded by the migration — it is bcrypt-hashed
  at runtime, so the serve boot path calls `EnsureBootstrapPassword` (§8) which inserts the row
  if absent. Seeding a fixed hash in SQL would pin a salt; do it in Go. The column is `hash`
  (decision E-7), not `password_hash`.
- `auth_tokens` carries the superset columns (decision E-7): `token` PK, `created_at`,
  `last_used`, `expires_at`, `client_ip`. `expires_at` reimplements Redis's 7-day token TTL;
  `GetValidToken` checks `expires_at > now` on read (lazy expiry), `RefreshToken` bumps
  `last_used`/`expires_at` (sliding expiration), and a periodic prune (§9) deletes expired
  rows. `client_ip` gives the login rate-limiter its context. `idx_auth_tokens_expires_at`
  serves the prune.

### 3b. `001_initial_schema.down.sql`

```sql
DROP INDEX IF EXISTS idx_auth_tokens_expires_at;
DROP TABLE IF EXISTS auth_tokens;
DROP TABLE IF EXISTS auth_password;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS sessions;
```

### 3c. `002_history_points.up.sql` — the time-series table (decision E-6)

```sql
CREATE TABLE history_points (
    session_id   TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    save_name    TEXT    NOT NULL,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL,
    PRIMARY KEY (session_id, save_name, data_type, game_time_id)
);

INSERT OR IGNORE INTO settings (key, value)
    VALUES ('history.max_sample_game_duration', '0');
```

Design points:
- The table is `history_points` (decision E-6) — never `history_samples`. **No surrogate
  `id`, no `recorded_at`**: retention is game-time based, so a wall-clock column is dead weight.
- **Composite PRIMARY KEY** `(session_id, save_name, data_type, game_time_id)` gives the same
  idempotent-overwrite-at-same-game-time behavior the ZSET member provided (rollback dedup,
  history-persistence §5). It is also an implicit covering index for the primary range query
  (filter the first three, range on the fourth) and for the prune. **Decision: ship only the
  PK** — no secondary index. 08 §"Design points" permits at most one extra index; the PK
  prefix already covers both the range read
  (`WHERE session_id=? AND save_name=? AND data_type=? AND game_time_id > :since ORDER BY game_time_id`)
  and the prune (`... AND game_time_id <= :cutoff`), so none is added. If a profiler later
  disagrees, add at most one — see Risks.
- `save_name` participates in the PK (decision E-11), replacing the Redis key-prefix
  partitioning from commit `0a12da8` ("include save name in state cache keys"). It is a
  mandatory key segment everywhere: the in-memory `LatestStore` key, this composite PK, and
  the per-`(session, save, dataType)` eventbus topic.
- `ON DELETE CASCADE` from `sessions(id)` replaces both `ClearHistoryData` and the
  deleted-session tombstone (redis-inventory §7/§8): deleting a session row removes its
  history. Foreign keys require `PRAGMA foreign_keys=ON` per connection — added to both pragma
  strings (§6).
- `data TEXT` holds the JSON-encoded event payload (`models.DataPoint.Data`). SQLite has no
  native JSON type; TEXT + the `json_extract`/`json_each` functions is the idiom. The resolver
  (plan 06) `json.Unmarshal`s it per `data_type` into the concrete `<Type>HistoryPoint`
  struct; the store never inspects the payload.
- The seeded `history.max_sample_game_duration = 0` mirrors the current "unset = no prune"
  default; the boot path overwrites it from `SD_MAX_SAMPLE_GAME_DURATION` only if that env is
  set and the row is still at its default (§9).

### 3d. `002_history_points.down.sql`

```sql
DELETE FROM settings WHERE key = 'history.max_sample_game_duration';
DROP TABLE IF EXISTS history_points;
```

### Migration conventions (ported verbatim from ref-store §3)

- Files: `NNN_snake_case_name.{up,down}.sql`, zero-padded sequential `NNN`. golang-migrate's
  iofs parses `version_name.direction.sql`.
- Every up has a matching down that fully reverses it; `TestMigrateUpDown` (§10) enforces it.
- The ledger is **append-only**: never edit a committed migration, add a new one.
- Migrations may seed data (`INSERT ... VALUES`), as the settings rows above do.

---

## 4. queries/*.sql

### `sessions.sql`

`UpdateSession` is the only mutating session query (the user-facing patch from the GraphQL
`updateSession` mutation). There is no `UpdateSessionRuntime` — runtime status is poller
in-memory state, not a DB column (08).

```sql
-- name: CreateSession :exec
INSERT INTO sessions (id, name, address, created_at)
VALUES (sqlc.arg('id'), sqlc.arg('name'), sqlc.arg('address'), CURRENT_TIMESTAMP);

-- name: GetSession :one
SELECT id, name, address, session_name, is_paused, created_at
FROM sessions WHERE id = sqlc.arg('id');

-- name: ListSessions :many
SELECT id, name, address, session_name, is_paused, created_at
FROM sessions ORDER BY created_at ASC;

-- name: UpdateSession :exec
UPDATE sessions
SET name = sqlc.arg('name'),
    address = sqlc.arg('address'),
    is_paused = sqlc.arg('is_paused')
WHERE id = sqlc.arg('id');

-- name: UpdateSessionSaveName :exec
UPDATE sessions
SET session_name = sqlc.arg('session_name')
WHERE id = sqlc.arg('id');

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = sqlc.arg('id');
```

`UpdateSessionSaveName` persists the durable `session_name` (the active save) when the poller
observes a save change — it is the one piece of poller-observed state that is genuinely
durable config (it keys history partitioning) and so warrants a column write, unlike the
transient `isOnline`/`isDisconnected`/`stage` which stay in memory.

### `settings.sql` (copied from reference)

```sql
-- name: GetSetting :one
SELECT key, value FROM settings WHERE key = ?;

-- name: ListSettings :many
SELECT key, value FROM settings;

-- name: UpsertSetting :exec
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
```

### `auth.sql`

Column is `hash` (decision E-7).

```sql
-- name: GetAuthPassword :one
SELECT hash, is_default, updated_at FROM auth_password WHERE id = 1;

-- name: UpsertAuthPassword :exec
INSERT INTO auth_password (id, hash, is_default, updated_at)
VALUES (1, sqlc.arg('hash'), sqlc.arg('is_default'), CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE
    SET hash = excluded.hash,
        is_default = excluded.is_default,
        updated_at = excluded.updated_at;

-- name: InsertToken :exec
INSERT INTO auth_tokens (token, created_at, last_used, expires_at, client_ip)
VALUES (sqlc.arg('token'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        CAST(sqlc.arg('expires_at') AS TIMESTAMP), sqlc.arg('client_ip'));

-- name: GetValidToken :one
SELECT token, created_at, last_used, expires_at, client_ip
FROM auth_tokens
WHERE token = sqlc.arg('token')
  AND expires_at > CAST(sqlc.arg('now') AS TIMESTAMP);

-- name: TouchToken :exec
UPDATE auth_tokens
SET last_used = CURRENT_TIMESTAMP,
    expires_at = CAST(sqlc.arg('expires_at') AS TIMESTAMP),
    client_ip = sqlc.arg('client_ip')
WHERE token = sqlc.arg('token');

-- name: DeleteToken :exec
DELETE FROM auth_tokens WHERE token = sqlc.arg('token');

-- name: RunTokenPrune :execrows
DELETE FROM auth_tokens WHERE expires_at <= CAST(sqlc.arg('now') AS TIMESTAMP);
```

`GetValidToken` enforces lazy `expires_at > now` expiry on read; `TouchToken` is the sliding
expiration (bumps `last_used` + `expires_at` + `client_ip`); `RunTokenPrune` is the periodic
sweep (§9a).

### `history.sql`

```sql
-- name: UpsertHistoryPoint :exec
INSERT INTO history_points (session_id, save_name, data_type, game_time_id, data)
VALUES (
    sqlc.arg('session_id'),
    sqlc.arg('save_name'),
    sqlc.arg('data_type'),
    sqlc.arg('game_time_id'),
    sqlc.arg('data')
)
ON CONFLICT(session_id, save_name, data_type, game_time_id)
DO UPDATE SET data = excluded.data;

-- name: ListHistorySaves :many
SELECT DISTINCT save_name
FROM history_points
WHERE session_id = sqlc.arg('session_id')
ORDER BY save_name ASC;

-- name: GetLatestGameTimeId :one
SELECT COALESCE(MAX(game_time_id), 0) AS latest_id
FROM history_points
WHERE session_id = sqlc.arg('session_id')
  AND save_name = sqlc.arg('save_name')
  AND data_type = sqlc.arg('data_type');

-- name: QueryHistoryRaw :many
-- Returns whole JSON points for one (session, save, dataType) with game_time_id
-- strictly greater than 'since' (pass since = -1 for full history) and at most
-- 'to_id' (pass a large sentinel for open-ended). Ordered ascending by game
-- time. lim <= 0 means unlimited.
SELECT game_time_id, data
FROM history_points
WHERE session_id = sqlc.arg('session_id')
  AND save_name = sqlc.arg('save_name')
  AND data_type = sqlc.arg('data_type')
  AND game_time_id > CAST(sqlc.arg('since') AS INTEGER)
  AND game_time_id <= CAST(sqlc.arg('to_id') AS INTEGER)
ORDER BY game_time_id ASC
LIMIT IIF(CAST(sqlc.arg('lim') AS INTEGER) > 0, CAST(sqlc.arg('lim') AS INTEGER), -1);

-- name: QueryHistoryBucketed :many
-- Downsamples by integer game-time bucket. Per bucket returns the LAST point
-- (highest game_time_id) — matching the existing client-side downsampler which
-- keeps the last sample per bucket. Keep-last, never AVG (the payload is a whole
-- heterogeneous JSON struct). bucket_seconds must be > 0.
SELECT hp.game_time_id, hp.data
FROM history_points hp
JOIN (
    SELECT MAX(game_time_id) AS max_id
    FROM history_points
    WHERE session_id = sqlc.arg('session_id')
      AND save_name = sqlc.arg('save_name')
      AND data_type = sqlc.arg('data_type')
      AND game_time_id > CAST(sqlc.arg('since') AS INTEGER)
      AND game_time_id <= CAST(sqlc.arg('to_id') AS INTEGER)
    GROUP BY game_time_id / CAST(sqlc.arg('bucket_seconds') AS INTEGER)
) b ON hp.game_time_id = b.max_id
WHERE hp.session_id = sqlc.arg('session_id')
  AND hp.save_name = sqlc.arg('save_name')
  AND hp.data_type = sqlc.arg('data_type')
ORDER BY hp.game_time_id ASC;

-- name: PruneHistoryOlderThan :execrows
DELETE FROM history_points
WHERE session_id = sqlc.arg('session_id')
  AND save_name = sqlc.arg('save_name')
  AND data_type = sqlc.arg('data_type')
  AND game_time_id < CAST(sqlc.arg('cutoff') AS INTEGER);
```

Query-shape rationale (cross-ref history-persistence §6/§7, 08 §"Per-type history queries"):
- `QueryHistoryRaw` covers the existing two-phase fetch: initial load (`since = -1`) and
  incremental (`since = lastKnownLatestId`), the `gameTimeId > since` semantics the REST
  handler used, plus an upper bound `to_id` and a `lim`. The GraphQL `<domain>History`
  resolvers (plan 06) pass the window from the `since`/`maxPoints` arguments.
- `GetLatestGameTimeId` returns the latest `game_time_id` for a series so the client can stitch
  live subscription points (which still carry `GameTimeID`) onto a queried window. On WS
  reconnect the client re-runs each `<domain>History` query with `since=<latest gameTimeId>`
  and re-snapshots live state via the snapshot queries (decision E-9 — there is no dedicated
  `historyAppended` subscription).
- `QueryHistoryBucketed` keeps the **LAST** point per bucket (not AVG, decision E-6) because
  the payload is whole JSON, not a scalar; this matches `downsampleDataPoints`
  (history-persistence §7) which keeps the last point per `floor(gameTimeId/windowSize)`
  bucket. It eliminates the over-fetch where the client pulled every raw 4 s point across an
  8 h range. The resolver derives `bucket_seconds` from the requested range / `maxPoints` and
  passes it in.
- `ListHistorySaves` replaces `GetHistorySaves` (the Redis `KEYS` scan) with `SELECT DISTINCT`.
  It backs the GraphQL `historySaves(sessionId: ID!): [String!]!` query (08).
- `PruneHistoryOlderThan` is per (session, save, type) with a game-time cutoff — the retention
  loop computes `cutoff = currentGameTimeId - maxSampleGameDuration` per save (§9).

sqlc annotation reference (ref-store §7): `:one` single row, `:many` slice, `:exec` no rows,
`:execrows` returns `int64` rows-affected (all prunes). `CAST(sqlc.arg('x') AS INTEGER/TIMESTAMP)`
pins the Go param type. `IIF(... > 0, ..., -1)` uses SQLite's `-1` = unlimited.

---

## 5. The *DB wrapper — `internal/store/db.go`

Copied from the reference (db.go), only the import path changes:

```go
package store

import (
    "context"
    "database/sql"
    "fmt"

    "<module>/internal/store/sqlite"
)

type DB struct {
    q  *sqlite.Queries
    db *sql.DB
}

func New(db *sql.DB) *DB {
    return &DB{q: sqlite.New(db), db: db}
}

func (s *DB) execTx(ctx context.Context, fn func(*sqlite.Queries) error) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }
    if err := fn(s.q.WithTx(tx)); err != nil {
        _ = tx.Rollback()
        return err
    }
    return tx.Commit()
}
```

Single-statement domain methods call `s.q.<Method>` directly; multi-statement ones use
`execTx`. None of the queries above need a transaction today (each is one statement), so
`execTx` is carried for parity / future use (e.g. a future "delete session and drain its
history in one tx" — though the FK cascade already covers that).

---

## 6. Embed + migrate-on-startup runner

### 6a. `internal/store/migrations.go`

```go
package store

import "embed"

// Migrations contains the embedded migration SQL files.
//
//go:embed migrations/*.sql
var Migrations embed.FS
```

### 6b. `internal/migrate/migrate.go` (shared runner)

Ported from the reference cmd/migrate, with the DB path coming from config and the boot
helper added:

```go
package migrate

import (
    "context"
    "database/sql"
    "fmt"

    "github.com/golang-migrate/migrate/v4"
    "github.com/golang-migrate/migrate/v4/database/sqlite"
    "github.com/golang-migrate/migrate/v4/source/iofs"
    "<module>/internal/store"
    _ "modernc.org/sqlite"
)

const migratePragmas = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"

func newMigrator(db *sql.DB) (*migrate.Migrate, error) {
    src, err := iofs.New(store.Migrations, "migrations")
    if err != nil {
        return nil, fmt.Errorf("create migration source: %w", err)
    }
    drv, err := sqlite.WithInstance(db, &sqlite.Config{})
    if err != nil {
        return nil, fmt.Errorf("create migration db driver: %w", err)
    }
    return migrate.NewWithInstance("iofs", src, "sqlite", drv)
}

// Up applies all pending migrations against an already-open *sql.DB. Used by
// the serve boot path so the runner and the app share one handle and pragmas.
func Up(db *sql.DB) error {
    m, err := newMigrator(db)
    if err != nil {
        return err
    }
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return fmt.Errorf("migrate up: %w", err)
    }
    return nil
}

// Run is the CLI subcommand entrypoint: opens its own handle to dbPath and runs
// up|down|version.
func Run(_ context.Context, dbPath, direction string, steps int) error {
    db, err := sql.Open("sqlite", dbPath+migratePragmas)
    if err != nil {
        return fmt.Errorf("open database: %w", err)
    }
    defer func() { _ = db.Close() }()

    m, err := newMigrator(db)
    if err != nil {
        return err
    }
    switch direction {
    case "up":
        if steps > 0 {
            err = m.Steps(steps)
        } else {
            err = m.Up()
        }
    case "down":
        n := 1
        if steps > 0 {
            n = steps
        }
        err = m.Steps(-n)
    case "version":
        v, dirty, verr := m.Version()
        if verr != nil {
            return fmt.Errorf("get version: %w", verr)
        }
        fmt.Printf("version=%d dirty=%t\n", v, dirty)
        return nil
    default:
        return fmt.Errorf("unknown direction %q", direction)
    }
    if err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

### 6c. Serve boot wiring (plan 02 owns the command, this is the store contract)

```go
dsn := cfg.DBPath + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)&_txlock=immediate"
db, err := sql.Open("sqlite", dsn)
if err != nil { return err }
if err := migrate.Up(db); err != nil { return err }
st := store.New(db)
```

`migrate.Up(db)` runs against the same handle, then `store.New(db)` wraps it. `ErrNoChange`
is treated as success so re-runs are idempotent. On a first boot against an empty DB this
creates the schema and leaves auth empty; `EnsureBootstrapPassword` (§8) then seeds the
clean-wipe bootstrap row (decision D-A).

`migrate.ErrNoChange` handling, `iofs.New(Migrations, "migrations")`, and
`migrate.NewWithInstance` reusing the open `*sql.DB` are all copied unchanged from the
reference (ref-store §4).

---

## 7. Domain types & methods — `internal/store/store.go` + per-domain files

`store.go` holds hand-written param/result structs (callers never see `sqlite.*`). The
`Session` struct carries only durable columns; runtime status is supplied by the poller, not
the store.

```go
package store

import "time"

type Session struct {
    ID          string
    Name        string
    Address     string
    SessionName string
    IsPaused    bool
    CreatedAt   time.Time
}

type Setting struct {
    Key   string
    Value string
}

type AuthPassword struct {
    Hash      string
    IsDefault bool
    UpdatedAt time.Time
}

type Token struct {
    Token     string
    CreatedAt time.Time
    LastUsed  time.Time
    ExpiresAt time.Time
    ClientIP  string
}

type HistoryPoint struct {
    GameTimeID int64
    Data       []byte
}

type HistoryQuery struct {
    SessionID     string
    SaveName      string
    DataType      string
    Since         int64
    ToID          int64
    Limit         int
    BucketSeconds int
}
```

Per-domain wrappers convert. Example `history.go` (mirrors the reference's `history.go`
bucket/raw branch, but integer-keyed and JSON-payloaded):

```go
package store

import (
    "context"
    "fmt"

    "<module>/internal/store/sqlite"
)

const maxGameTimeID = int64(1) << 62

// UpsertHistoryPoint writes one history sample, overwriting any existing point
// at the same game time (save-rollback dedup).
func (s *DB) UpsertHistoryPoint(ctx context.Context, sessionID, saveName, dataType string, gameTimeID int64, data []byte) error {
    if err := s.q.UpsertHistoryPoint(ctx, sqlite.UpsertHistoryPointParams{
        SessionID:  sessionID,
        SaveName:   saveName,
        DataType:   dataType,
        GameTimeID: gameTimeID,
        Data:       string(data),
    }); err != nil {
        return fmt.Errorf("upsert history point: %w", err)
    }
    return nil
}

// QueryHistory returns history points for one series. When q.BucketSeconds > 0
// the result is downsampled to the last point per bucket; otherwise raw points
// are returned in ascending game-time order.
func (s *DB) QueryHistory(ctx context.Context, q HistoryQuery) ([]HistoryPoint, error) {
    toID := q.ToID
    if toID <= 0 {
        toID = maxGameTimeID
    }
    if q.BucketSeconds > 0 {
        rows, err := s.q.QueryHistoryBucketed(ctx, sqlite.QueryHistoryBucketedParams{
            SessionID:     q.SessionID,
            SaveName:      q.SaveName,
            DataType:      q.DataType,
            Since:         q.Since,
            ToID:          toID,
            BucketSeconds: int64(q.BucketSeconds),
        })
        if err != nil {
            return nil, fmt.Errorf("query history bucketed: %w", err)
        }
        return toHistoryPoints(rows), nil
    }
    rows, err := s.q.QueryHistoryRaw(ctx, sqlite.QueryHistoryRawParams{
        SessionID: q.SessionID,
        SaveName:  q.SaveName,
        DataType:  q.DataType,
        Since:     q.Since,
        ToID:      toID,
        Lim:       int64(q.Limit),
    })
    if err != nil {
        return nil, fmt.Errorf("query history raw: %w", err)
    }
    return toHistoryPoints(rows), nil
}

// PruneHistoryOlderThan deletes points below the game-time cutoff for one series
// and returns the number removed.
func (s *DB) PruneHistoryOlderThan(ctx context.Context, sessionID, saveName, dataType string, cutoff int64) (int64, error) {
    n, err := s.q.PruneHistoryOlderThan(ctx, sqlite.PruneHistoryOlderThanParams{
        SessionID: sessionID,
        SaveName:  saveName,
        DataType:  dataType,
        Cutoff:    cutoff,
    })
    if err != nil {
        return 0, fmt.Errorf("prune history: %w", err)
    }
    return n, nil
}
```

`toHistoryPoints` is a small generic-ish helper in `mapper.go` building `[]HistoryPoint`
from either row type (both expose `GameTimeID int64` and `Data string`). `auth.go`,
`sessions.go`, `settings.go` follow the same convert-and-wrap shape; `settings.go` is a
verbatim copy of the reference (GetSetting/ListSettings/UpsertSetting). `auth.go` adds an
`EnsureBootstrapPassword` (§8). The resolver layer (plan 06) decodes `HistoryPoint.Data` per
`data_type` into the concrete `<Type>HistoryPoint` struct; the store returns raw bytes.

The recorder (plan 05) depends only on a narrow interface it declares locally:

```go
type historyStore interface {
    UpsertHistoryPoint(ctx context.Context, sessionID, saveName, dataType string, gameTimeID int64, data []byte) error
}
```

`*store.DB` satisfies it structurally.

---

## 8. Auth bootstrap (replaces `InitializePassword`; decision D-A clean wipe)

The Redis `InitializePassword` (set `change-me` bcrypt if `auth:password` absent) becomes a
SQLite-only bootstrap. On a first boot against an empty DB there is no migrated password or
token — the row simply does not exist, so this seeds it:

```go
// EnsureBootstrapPassword inserts the bootstrap password row if none exists,
// hashing the configured bootstrap password and marking it as default.
func (s *DB) EnsureBootstrapPassword(ctx context.Context, bootstrapPlaintext string) error {
    _, err := s.q.GetAuthPassword(ctx)
    if err == nil {
        return nil
    }
    if !errors.Is(err, sql.ErrNoRows) {
        return fmt.Errorf("check auth password: %w", err)
    }
    hash, err := bcrypt.GenerateFromPassword([]byte(bootstrapPlaintext), bcrypt.DefaultCost)
    if err != nil {
        return fmt.Errorf("hash bootstrap password: %w", err)
    }
    return s.UpsertAuthPassword(ctx, string(hash), true)
}
```

Called once on serve boot after `store.New`, with `bootstrapPlaintext = SD_BOOTSTRAP_PASSWORD`
(default `change-me`). `ChangePassword` calls `UpsertAuthPassword(hash, false)`.
`IsUsingDefaultPassword` reads `AuthPassword.IsDefault`. Token TTL constant
(`GetTokenTTL() = 7*24h`) stays a Go const used by both `InsertToken` (`expires_at = now + ttl`)
and the auth cookie max-age (redis-inventory §5). There is no Redis import anywhere in the
auth path.

---

## 9. Retention loops — `internal/store/retention.go`

Two pruners: a wall-clock token prune and a game-time history prune unique to Satisfactory.

### 9a. Token prune (wall-clock, fixed interval)

Tokens prune by `expires_at <= now`, not a day-window, so a fixed-interval ticker is simpler
than the reference's settings-driven day loop. Ship a small dedicated
`RunTokenPrune(ctx, logger, store)` that calls the `RunTokenPrune` query with `time.Now()`
roughly every hour (decision E-7's periodic sweep). Lazy `expires_at > now` on read
(`GetValidToken`) already keeps expired tokens from validating; this loop just reclaims rows.

```go
// RunTokenPrune deletes expired auth tokens on a fixed interval (~1h). Lazy
// expiry on read already rejects them; this reclaims the rows.
func RunTokenPrune(ctx context.Context, logger *slog.Logger, store TokenPruneStore, interval time.Duration) {
    if interval <= 0 {
        interval = time.Hour
    }
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if _, err := store.RunTokenPrune(ctx, time.Now()); err != nil {
                logger.Error("token prune failed", "error", err)
            }
        }
    }
}
```

### 9b. History prune (game-time, Satisfactory-specific)

The history retention window is **game-time seconds**, read live from the
`history.max_sample_game_duration` setting. The poller is the only source of the current
game-time per (session, save), so the retention call is driven by the poller/recorder, not a
standalone wall-clock ticker. Concrete shape:

```go
// HistoryFrontier reports the latest game time observed per active series.
type HistoryFrontier interface {
    Series() []HistorySeriesKey
    CurrentGameTime(key HistorySeriesKey) int64
}

type HistorySeriesKey struct {
    SessionID string
    SaveName  string
    DataType  string
}

// RunHistoryRetention prunes each active series to currentGameTime - window on a
// fixed interval. The window is re-read from settings every tick so the user can
// change SD_MAX_SAMPLE_GAME_DURATION's stored value without a restart. window <= 0
// disables pruning (matches the legacy "unset" behaviour).
func RunHistoryRetention(ctx context.Context, logger *slog.Logger, store HistoryRetentionStore, frontier HistoryFrontier, interval time.Duration) {
    if interval <= 0 {
        interval = time.Minute
    }
    ticker := time.NewTicker(interval)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            window := historyWindow(ctx, store)
            if window <= 0 {
                continue
            }
            for _, key := range frontier.Series() {
                cutoff := frontier.CurrentGameTime(key) - window
                if cutoff <= 0 {
                    continue
                }
                if _, err := store.PruneHistoryOlderThan(ctx, key.SessionID, key.SaveName, key.DataType, cutoff); err != nil {
                    logger.Error("prune history failed", "session", key.SessionID, "save", key.SaveName, "type", key.DataType, "error", err)
                }
            }
        }
    }
}

func historyWindow(ctx context.Context, store HistoryRetentionStore) int64 {
    setting, err := store.GetSetting(ctx, "history.max_sample_game_duration")
    if err != nil {
        return 0
    }
    n, err := strconv.ParseInt(setting.Value, 10, 64)
    if err != nil || n < 0 {
        return 0
    }
    return n
}
```

This replaces the current "prune inline on every write" (history-persistence §4). Moving it
to a periodic loop drops one DELETE per insert from the hot path. The default interval (1
minute) is far finer than a wall-clock day default because game-time advances continuously;
plan 05 owns where `HistoryFrontier` is implemented (the poller's `GameTimeTracker`).

### 9c. Seeding the window from env on boot

`SD_MAX_SAMPLE_GAME_DURATION` (kept in config — redis-inventory §172) becomes the bootstrap
seed: on serve boot, if the env is set and the stored setting is still its default `0`,
`UpsertSetting("history.max_sample_game_duration", env)`. After that the setting row is the
source of truth (hot-reloadable). This keeps the existing env contract while making the value
adjustable at runtime.

### 9d. RELEASE / UPGRADE NOTE — auth clean wipe (decision D-A)

This refactor replaces Redis with SQLite as the auth store. **There is NO migration of the
existing password or access tokens.** On first boot against an empty SQLite DB:

- auth re-bootstraps to `SD_BOOTSTRAP_PASSWORD` (default `change-me`) with `is_default = 1`
  (§8);
- all previously issued access tokens are gone (every client must log in again);
- **the operator MUST re-set their password after upgrade.**

This is an EXPLICIT, user-approved clean cutover (closes critic B4 / decision D.1) — it is not
an accidental loss of backward compatibility. 01/02/06 surface the same note in the
deployment/upgrade docs. The store layer imports nothing from Redis; the old Redis auth keys
are simply discarded.

---

## 10. Tests — `internal/store/migration_test.go`

Copy the reference's three migration tests verbatim (ref-store §4c), retargeted to `:memory:`
and the new module path:

```go
func openMemory(t *testing.T) *sql.DB {
    db, err := sql.Open("sqlite", ":memory:?_pragma=foreign_keys(ON)")
    if err != nil { t.Fatal(err) }
    return db
}

func migrator(t *testing.T, db *sql.DB) *migrate.Migrate {
    src, err := iofs.New(store.Migrations, "migrations")
    if err != nil { t.Fatal(err) }
    drv, err := sqlite.WithInstance(db, &sqlite.Config{})
    if err != nil { t.Fatal(err) }
    m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
    if err != nil { t.Fatal(err) }
    return m
}
```

- `TestMigrateUp` — `m.Up()` returns nil/ErrNoChange.
- `TestMigrateUpDown` — `Up()` then `Steps(-n)` down to 0, asserting full reversal (the
  safety net for the append-only ledger). This is also the CI migration up/down check
  (decision E-10).
- `TestMigrateUpIdempotent` — second `Up()` is a no-op (`ErrNoChange`).

Add focused domain tests (`history_test.go`) asserting: same-`game_time_id` upsert overwrites
(rollback dedup); `QueryHistoryRaw` honors `since`/`to_id`/`lim`; `QueryHistoryBucketed` keeps
the **last** point per bucket; `PruneHistoryOlderThan` removes below cutoff and returns the
count; FK cascade removes history when a session row is deleted; `GetValidToken` rejects an
expired token and `RunTokenPrune` reclaims it.

This is the RECOMMENDED light store-level scope (decision E-10); the eventbus/subscription
teardown tests live with plans 05/06, and the boot→query+mutation+subscription e2e smoke is a
cross-cutting test owned at the app level. The manual two-session run remains the functional
gate.

---

## 11. Makefile / tooling targets (files to CHANGE)

The store's slice of the canonical `make generate` recipe is **step (2): `sqlc generate`**.
Doc 08 OWNS the full three-step pipeline (decision E-8):

```make
generate:
	cd api && go tool gqlgen generate    # (1) owned by 06/08 — emits resolver stubs + schema.graphql
	cd api && sqlc generate               # (2) THIS PLAN — regenerates internal/store/sqlite/*
	cd dashboard && bun run codegen       # (3) owned by 07/08 — client-preset reads gqlgen's schema
```

04 owns only step (2). tygo, `api/export/tygo.yml`, and `dashboard/src/apiTypes.ts` are
DELETED (owned by 08/07); this plan does not carry any tygo target. The store's targets:

```make
SQLC_VERSION ?= v1.31.0

sqlc:
	@command -v sqlc >/dev/null 2>&1 || { echo "sqlc not installed (want $(SQLC_VERSION))"; exit 1; }
	cd api && sqlc generate

sqlc-check: sqlc
	@cd api && git diff --exit-code internal/store/sqlite || { echo "sqlc output drift — run 'make sqlc'"; exit 1; }

migrate-up:
	cd api && go run . migrate up

migrate-down-n:
	cd api && go run . migrate down $(N)

migrate-up-n:
	cd api && go run . migrate up $(N)

migrate-version:
	cd api && go run . migrate version

migrate-new:
	@test -n "$(NAME)" || { echo "usage: make migrate-new NAME=add_foo"; exit 1; }
	@next=$$(ls api/internal/store/migrations | grep -oE '^[0-9]+' | sort -n | tail -1 | awk '{printf "%03d", $$1+1}'); \
	touch api/internal/store/migrations/$${next}_$(NAME).up.sql api/internal/store/migrations/$${next}_$(NAME).down.sql; \
	echo "created $${next}_$(NAME).{up,down}.sql"
```

`sqlc.yaml` lives at `api/sqlc.yaml` (paths inside it are relative to it, so `cd api && sqlc
generate`). `make sqlc-check` wires into the lint/pre-commit aggregate as the sqlc drift guard.
`sqlc generate` is wired as step (2) of `make generate` (08); a single `make generate`
regenerates the Go store and the GraphQL surfaces in the fixed order.

The CLAUDE.md rule "run `make generate` after any changes to Go model structs" is restated by
06/07/08 to mean: run the three-step pipeline after a change to `api/schema.graphql` OR to
`internal/store/queries/*.sql` / `internal/store/migrations/*.sql`. The same edits delete the
stale mock-mode references (decision D-D — no mock poller exists, `Config.Mock` never existed).

go.mod additions (CHANGE `api/go.mod`):
- `github.com/golang-migrate/migrate/v4`
- `modernc.org/sqlite`
- REMOVE `github.com/redis/go-redis/v9` (plan 03 owns the deletion; flagged here because the
  store replaces its last legitimate use).

---

## 12. compose.yml (files to CHANGE)

Drop the `redis` service and its volume; add a named volume for the SQLite file under the
single consolidated `app` image (plan 01 renames `api` -> single image). The store's only
compose contribution is the DB path + persistent volume:

```yaml
services:
  app:
    build:
      context: .
    container_name: satisfactory-dashboard
    ports:
      - "8081:8081"
    environment:
      - SD_BOOTSTRAP_PASSWORD=${SD_BOOTSTRAP_PASSWORD:-change-me}
      - SD_MAX_SAMPLE_GAME_DURATION=${SD_MAX_SAMPLE_GAME_DURATION:-0}
      - SD_DB_PATH=/data/satisfactory-dashboard.db
    volumes:
      - db-data:/data
    restart: unless-stopped

volumes:
  db-data:
```

`SD_DB_PATH` is a new config field (`Config.DBPath`, default `satisfactory-dashboard.db` for
local dev; `/data/...` in compose). It feeds both the migrate runner and the serve `sql.Open`
DSN. The WAL `-wal`/`-shm` sidecar files live next to it on the same volume automatically.

---

## 13. Ordered migration steps

1. Add `api/internal/session` (`type ID string`) + `api/internal/auth` (`type Token string`)
   leaf packages with the typed aliases referenced by sqlc overrides (dependency-free).
2. Add `api/sqlc.yaml` (§2) and the four `queries/*.sql` files (§4).
3. Add `internal/store/migrations/001_*` and `002_*` (§3) and `migrations.go` (§6a).
4. `make sqlc` to generate `internal/store/sqlite/`; commit the output.
5. Add `db.go`, `store.go`, `mapper.go`, and per-domain `sessions.go`/`settings.go`/`auth.go`/
   `history.go` (§5, §7, §8).
6. Add `internal/migrate/migrate.go` (§6b) and `retention.go` (§9).
7. Add `migration_test.go` + `history_test.go` (§10); run `go test ./internal/store/...`.
8. Add `Config.DBPath` (`SD_DB_PATH`); keep `MaxSampleGameDuration`/`SD_MAX_SAMPLE_GAME_DURATION`.
9. Wire the serve boot path (§6c) + `EnsureBootstrapPassword` (§8) + env-seed of the
   retention window (§9c) — coordinated with plan 02 (serve command) and plan 03 (deleting
   the Redis services that previously held this state).
10. Add the Makefile targets (§11) and the compose volume (§12).
11. Hand off to plans 05/06: the recorder writes via `UpsertHistoryPoint`; resolvers read via
    `QueryHistory`/`ListHistorySaves`/`GetLatestGameTimeId`/`ListSessions`/`GetSetting`/auth
    methods and decode `HistoryPoint.Data` into `<Type>HistoryPoint`; the poller writes
    `UpdateSessionSaveName` on save change and implements `HistoryFrontier` and supplies the
    in-memory `isOnline`/`isDisconnected`/`stage` to the `Session` resolver fields.

---

## Risks

- **JSON-blob history vs scalar series.** Keeping `data` as opaque JSON preserves the existing
  contract and the rollback-overwrite semantics, but means the bucketed query can only thin
  points (keep-last, decision E-6), not compute AVG over a metric. Averaging heterogeneous JSON
  is impossible. Mitigation: the keep-last bucketer matches today's client downsampler exactly,
  so no current behavior regresses; the resolver re-hydrates the whole struct per point.
- **Game-time retention is poller-coupled.** `RunHistoryRetention` needs a `HistoryFrontier`
  from the poller; if the poller is paused/offline the frontier stalls and pruning pauses
  (acceptable — game-time isn't advancing either). The dependency must be wired in plan 05.
- **FK cascade requires `foreign_keys=ON` per connection.** Both DSNs include
  `_pragma=foreign_keys(ON)`; the test DSN must too, or the cascade test silently passes
  without enforcing. Called out in §10.
- **Single-writer assumption.** WAL + one in-process writer (the poller) + many readers
  (resolvers) is the design point at the ~10-session capacity envelope (decision D-B);
  `_txlock=immediate` + `busy_timeout(5000)` cover contention. Beyond a few dozen sessions a
  second writer / write queue would be needed — explicitly out of scope.
- **Runtime status is not durable.** `Session.isOnline`/`isDisconnected`/`stage` live only in
  poller memory and are gone on restart until the poller re-establishes connectivity; the
  GraphQL `Session` resolver reads them from the poller, not the DB (08). This is intentional —
  they are transient, not config.
- **sqlc override import cycle.** The override types live in tiny leaf packages
  (`internal/session`, `internal/auth`) that must not import `internal/store` — keep them
  dependency-free aliases. `data_type` is NOT overridden (decision E-5), so no enum package is
  pulled into the store.

---

## How this satisfies the done-criteria

- **No Redis as a store.** Every stateful Redis object from redis-inventory (§1 settings,
  §5 auth password+tokens, §6 sessions, §8 history) now has a SQLite table; the live cache
  (§1 state) and streams (§2/§3) move to channels (plans 05/06), and the lease/tombstone
  subsystems (§7/§9) are deleted (plan 02). After this plan, the only remaining Redis
  references are the ones plan 03 deletes. The auth cutover is a clean wipe (decision D-A), not
  a migration.
- **sqlc + migration files are used.** `sqlc.yaml` + `queries/*.sql` generate
  `internal/store/sqlite/` (step (2) of the canonical `make generate`, 08); numbered up/down
  migrations embedded via `iofs` + golang-migrate are the schema source of truth, applied on
  boot. Tables/columns/indexes/overrides match 08 exactly: `history_points` (composite PK,
  JSON `data`, no surrogate id/`recorded_at`), `auth_password (hash, is_default, updated_at)`,
  `auth_tokens (token, created_at, last_used, expires_at, client_ip)`, `sessions` durable-only.
- **History persists in SQLite and is queryable.** `history_points` + the raw/bucketed/prune
  queries back the typed per-type GraphQL `<domain>History` queries (plan 06), honoring
  `SD_MAX_SAMPLE_GAME_DURATION` via the settings-driven `RunHistoryRetention` loop; `data_type`
  stays TEXT and is mapped to the `HistoryDataType` enum in the resolver (decision E-5).
- **CGO-free.** `modernc.org/sqlite` keeps `CGO_ENABLED=0`, so the consolidated single-image
  build (plan 01) stays static.
</content>
</invoke>
