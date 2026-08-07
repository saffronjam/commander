# GraphQL layer

gqlgen resolvers for `api/schema.graphql`. The schema is the contract; everything here is either
generated from it or hand-written against it.

## Files

| File | Owner | Purpose |
| --- | --- | --- |
| `generated.go`, `model/models_gen.go` | gqlgen | regenerate with `just gqlgen`, never edit |
| `schema.resolvers.go` | hand-written | root resolver wiring only (`Query()`, `Mutation()`, `Subscription()`) |
| `resolver.go` | hand-written | `Resolver` struct + the `GraphStore` / `Snapshotter` / `Poller` interfaces it depends on |
| `resolvers_snapshot*.go` | hand-written | per-domain snapshot queries, read from `Snapshotter` |
| `resolvers_subscription*.go` | hand-written | per-domain live subscriptions, read from the eventbus |
| `resolvers_config.go` | hand-written | auth, sessions, settings — queries and mutations |
| `resolvers_history.go` | hand-written | `<domain>History` queries, read from the store |
| `mappers_*.go` | hand-written | `models.*` → `model.*` conversion, one file per domain group |
| `graphstore.go` | hand-written | `StoreAdapter`: `*store.DB` → `GraphStore` |
| `directive.go` | hand-written | the `@auth` directive |
| `httpcontext.go` | hand-written | response writer + client IP in context (cookie writing) |
| `error_presenter.go` | hand-written | `ErrorPresenter` and `RecoverFunc` |

`gqlgen.yml` deliberately has **no `resolver:` section**. Resolvers are hand-split across
`resolvers_*.go`, so gqlgen only owns the exec and the models — `just gqlgen` regenerates those two
outputs and leaves everything else alone. Do not add a `resolver:` block back; it would re-stub every
method into `schema.resolvers.go` and the package would stop compiling.

## Resolver dependencies

`Resolver` holds narrow interfaces rather than concrete types, so resolvers can be tested without a
database or a poller:

- `GraphStore` — the slice of `store.DB` the resolvers use (sessions, settings, history).
- `Snapshotter` — the poller's in-memory state: `Latest`, `Stage`, `Connectivity`.
- `Poller` — lifecycle and live probes: `PreviewSession`, `StartSession`, `StopSession`,
  `RestartSession`.
- `EventBus` — `eventbus.Subscriber` only. Resolvers never publish.

## Subscription pattern

Every `<domain>Changed` resolver follows the same shape, and new ones should too:

1. `EventBus.SubscribeDomain(sessionID, dataType)`.
2. Start a goroutine that `defer close(out)` and `defer r.EventBus.Unsubscribe(ch)`.
3. **Forward the latest snapshot first** (`Snapshot.Latest`), so a new subscriber renders
   immediately instead of waiting for the next poll tick.
4. Loop on `select` over `ctx.Done()` and the bus channel, type-asserting
   `evt.Payload.(eventbus.SatisfactoryEvent)` then `se.Data.(*models.T)`, and mapping before sending.
5. Every send is itself a `select` against `ctx.Done()` so a disconnecting client cannot wedge the
   goroutine.

Skip malformed payloads with `continue`; return on a closed channel. Payloads carry typed Go values,
never JSON.

## Mappers

Mapping is one-directional: `models.*` → `model.*`. Enum conversion happens here too — domain enums
are lowercase strings, GraphQL enums are SCREAMING_SNAKE. Put a new mapper in the `mappers_*.go` file
matching its domain group (`common`, `config`, `infra`, `power`, `vehicles`, `world`) rather than
creating a new file per type.

## Auth

`@auth` on a schema field routes through `AuthDirective`, which rejects with a `UNAUTHENTICATED`
extension unless `auth.UserFromContext` finds a caller. The caller is attached upstream by
`authMiddleware` in `cmd/server.go` (HTTP) or the websocket init func, both reading the same
`sd_access_token` cookie. Guard every field that exposes session data or mutates state.
