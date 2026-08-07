# Store

Durable state: instance meta, sessions, settings, auth (access key + tokens), and history samples.
SQLite via [sqlc](https://sqlc.dev) for the query layer and golang-migrate for the schema.

## Files

```
queries/*.sql        sqlc INPUT  — hand-written, one file per domain
migrations/*.sql     the schema  — numbered up/down pairs, embedded
sqlite/              sqlc OUTPUT — generated, never edit
store.go             domain types (Instance, AuthMode, Session, Setting, Token, HistoryPoint, HistoryQuery)
db.go                DB wrapper over the generated Queries, ErrNotFound, execTx
instance.go          the singleton instance row: setup state and auth mode
auth.go              access key + token methods
sessions.go          session CRUD
settings.go          key/value settings
history.go           history upsert, query (raw + bucketed), prune
retention.go         RunHistoryRetention / RunTokenPrune background loops
mapper.go            sqlite row -> domain conversion, bool <-> int64
migrations.go        //go:embed migrations/*.sql
```

## The instance table

A single row (`CHECK (id = 1)`) holding instance-wide meta. `initialized_at IS NULL` means first-run
setup has not completed; `auth_mode` is `open` or `password`. Two columns because they are two
independent facts: collapsing them would make "never set up" and "deliberately open" indistinguishable.

`CompleteInstanceSetup` updates `WHERE initialized_at IS NULL` and returns the affected row count, so
single-use claiming is enforced by the database rather than a read-then-write check.

Access tokens are keyed by `token_hash`, never the token. `store.Token.TokenHash` is
`auth.TokenHash`, a type distinct from `auth.Token`, so persisting a raw token does not compile.

Callers depend on `*store.DB`'s domain methods and never import `internal/store/sqlite`.

## sqlc

`api/sqlc.yaml` reads `queries/` against the schema in `migrations/`, emitting `sqlite/`. Run
`just sqlc` after editing a query; CI fails if the committed output drifts. sqlc **1.31.0** is the
pinned version — a different one may format the output differently.

The config overrides three column types so the generated code speaks the domain's types directly:
`sessions.id` and `history_points.session_id` → `session.ID`, `auth_tokens.token` → `auth.Token`.

Both `.sql` directories are carved out of the repo's blanket `*.sql` gitignore rule. A new `.sql`
directory here needs its own negation in `.gitignore` or the files will be silently untracked.

### Adding a query

1. Add it to the matching `queries/*.sql` with a `-- name: X :one|:many|:exec|:execrows` annotation.
2. Use `sqlc.arg(name)` when the Go parameter name should differ from the compared column — that is
   where names like `now`, `cutoff`, `since`, `to_id`, `lim`, `bucket_seconds` come from. A bare `?`
   takes its name from the column.
3. `just sqlc`.
4. Wrap it in a domain method on `*DB` in the matching `.go` file, wrapping errors and translating
   `sql.ErrNoRows` to `ErrNotFound`.

### Adding a migration

Add a numbered pair — `00N_name.up.sql` and `00N_name.down.sql`. They are embedded, so the binary
carries them; the server runs `Up` at boot (`pkg/db`), and `just migrate-up` / `migrate-down n` /
`migrate-version` drive the chain by hand. The down migration is not optional: `migrate-down` needs
it, and `just sqlc` reads the same directory as the schema, so an incomplete pair breaks generation.

## History

One row per `(session_id, data_type, game_time_id)`, with the sample as opaque JSON in
`data`. The resolver decodes `data` per `data_type`; the store never interprets it.

- Writes are upserts, so replaying game time after a save rollback overwrites rather than duplicates.
- A session is pinned to one save (`sessions.save_name`, `CHECK (save_name <> '')`), so history
  needs no save in its key: one session is one series per data type.
- `QueryHistory` returns raw points ascending, or, when `BucketSeconds > 0`, the last point per
  bucket (downsampling for charts). `Limit <= 0` means unlimited; `ToID <= 0` becomes `maxGameTimeID`.
  Both forms keep the **newest** points when `Limit` trims the result, which is why each is a
  descending inner select re-sorted ascending on the way out.
- `RunHistoryRetention` trims each series past `SD_MAX_SAMPLE_GAME_DURATION` of game time;
  `RunTokenPrune` deletes expired tokens hourly. Both are started from `cmd.Create`.

## Concurrency

The serve DSN sets WAL, a 5s busy timeout, foreign keys, and `_txlock=immediate`, because the poller
writes history while resolvers read. Keep domain methods single-statement where possible; use
`execTx` when a method genuinely needs several statements to be atomic.
