# Reference Pattern: gqlgen + eventbus + Subscriptions (saffron-hive)

This document extracts the saffron-hive GraphQL backend as a reusable template for the
Satisfactory Dashboard refactor. Everything below is read directly from
`/Users/emikar/repos/saffron-hive`. saffron-hive uses gqlgen v0.17.89,
gorilla/websocket v1.5.3, gqlparser/v2 v2.5.32. The frontend is Svelte+urql there;
the same server-side contract maps 1:1 onto urql's React bindings + graphql-ws.

There are **no dataloaders** in saffron-hive. Resolvers call a narrow store interface
directly. This keeps the recipe simple and is appropriate for our app too.

---

## 1. gqlgen.yml shape

`/Users/emikar/repos/saffron-hive/api/gqlgen.yml` (verbatim):

```yaml
schema:
  - api/schema.graphql

exec:
  filename: internal/graph/generated.go
  package: graph

model:
  filename: internal/graph/model/models_gen.go
  package: graph   # NOTE: model package is internal/graph/model (see model.package below)

model:
  filename: internal/graph/model/models_gen.go
  package: model

resolver:
  layout: follow-schema
  dir: internal/graph
  package: graph
  filename_template: "{name}.resolvers.go"

autobind: []

nullable_input_omittable: true

models:
  DateTime:
    model:
      - github.com/99designs/gqlgen/graphql.Time
```

Key decisions to copy:
- **Single SDL file** at `api/schema.graphql` (948 lines in saffron-hive; one big file
  is fine). For us we can split per-domain if desired, but a single file is the
  reference default.
- `exec` (generated.go) and `model` (models_gen.go) live under `internal/graph`. The
  generated file is ~828 KB and committed.
- `resolver.layout: follow-schema` + `filename_template: "{name}.resolvers.go"` means
  gqlgen writes resolver stubs grouped by schema source file. saffron-hive ends up with
  a single `schema.resolvers.go` (all queries/mutations/subscriptions in one file)
  because the schema is one file.
- `autobind: []` — they do **not** autobind Go domain structs to GraphQL types. Every
  GraphQL type is a generated model in `model/models_gen.go`, and resolvers map domain
  structs -> generated models by hand (see helpers.go, `mapDeviceFromReader`,
  `mapActivityEvent`, etc.). This is the clean-break approach: GraphQL types are their
  own shape, not the Go internal structs.
- Custom scalar `DateTime` -> `graphql.Time`.

gqlgen is wired as a Go `tool` directive in go.mod (`tool github.com/99designs/gqlgen`),
so codegen runs via `go run github.com/99designs/gqlgen generate` (or `go tool gqlgen`).

---

## 2. Where SDL lives + directive + scalar declarations

`api/schema.graphql` top of file:

```graphql
scalar DateTime

"""
Marks a field as requiring an authenticated caller. The directive resolver
rejects the request with code UNAUTHENTICATED when no user is attached to the
request context. Default-deny: every Query / Mutation / Subscription field
should carry @auth unless it is intentionally public (login, createInitialUser,
setupStatus, me).
"""
directive @auth on FIELD_DEFINITION
```

Root types are plain `type Query`, `type Mutation`, `type Subscription`. Every field
carries `@auth` unless intentionally public. Example field shapes:

```graphql
type Query {
  device(id: ID!): Device @auth
  stateHistory(filter: StateHistoryFilter!): [StateSeries!]! @auth
  aggregatedStateHistory(filter: AggregatedStateHistoryFilter!): [AggregatedSeries!]! @auth
  activity(filter: ActivityFilter): [ActivityEvent!]! @auth
}

type Mutation {
  updateDevice(id: ID!, input: UpdateDeviceInput!): Device! @auth
  setDeviceState(deviceId: ID!, state: DeviceStateInput!): Device! @auth
  applyScene(sceneId: ID!): Scene! @auth
}

type Subscription {
  deviceStateChanged(deviceId: ID): DeviceStateEvent! @auth
  deviceAvailabilityChanged: DeviceAvailabilityEvent! @auth
  deviceAdded: Device! @auth
  deviceRemoved: ID! @auth
  logStream: LogEntry! @auth
  activityStream(advanced: Boolean): ActivityEvent! @auth
  effectStepActivated(runId: ID): EffectStepEvent! @auth
}
```

Pattern to note: subscriptions take an **optional filter argument** (`deviceId: ID`)
and the resolver filters server-side. Each subscription returns a single concrete
event type, never a union.

---

## 3. Resolver struct + dependency injection

`internal/graph/resolver.go`. The root `Resolver` is a plain struct holding every
dependency as an **interface** (narrow, defined in this package, satisfied structurally
by the real implementations). This is the central DI seam.

```go
type Resolver struct {
	StateReader  device.StateReader   // in-memory live state snapshot
	Store        GraphStore           // SQLite store (narrow interface)
	EventBus     eventbus.EventBus    // live channel bus
	LogBuffer    *logging.Buffer      // fanout-backed ring buffer
	ActivityBuffer *activity.Buffer
	AlarmBuffer  *alarms.Buffer
	Auth         *auth.Service
	// ... more domain services
}
```

`GraphStore` is a hand-written interface listing **only** the store methods resolvers
call (devices, scenes, automations, state history, settings, users, ...). `*store.DB`
satisfies it implicitly. This keeps the graph package decoupled from the concrete
sqlc store and trivially mockable in tests.

The generated `generated.go` declares `QueryResolver`, `MutationResolver`,
`SubscriptionResolver` interfaces and calls back into root via thin wrappers
(`schema.resolvers.go` tail):

```go
func (r *Resolver) Mutation() MutationResolver         { return &mutationResolver{r} }
func (r *Resolver) Query() QueryResolver               { return &queryResolver{r} }
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
```

So every resolver method has access to all deps via the embedded `*Resolver`.

---

## 4. eventbus channel design (the live-data bus)

`internal/eventbus/` — this is the in-process bus that replaces Redis streams.

### Event envelope (`eventbus.go`)

```go
type EventType string

const (
	EventDeviceStateChanged        EventType = "device.state_changed"
	EventDeviceAvailabilityChanged EventType = "device.availability_changed"
	EventDeviceAdded               EventType = "device.added"
	EventDeviceRemoved             EventType = "device.removed"
	// ...
)

type Event struct {
	Type      EventType
	DeviceID  string
	Timestamp time.Time
	Payload   any            // typed struct, type-asserted by consumers
}

type Publisher interface  { Publish(event Event) }
type Subscriber interface {
	Subscribe(eventTypes ...EventType) <-chan Event
	Unsubscribe(ch <-chan Event)
}
type EventBus interface { Publisher; Subscriber }
```

The `Payload any` carries a typed struct per event type (e.g.
`EffectStepActivatedEvent`, `device.DeviceStateChange`). Consumers type-assert it and
skip on mismatch.

### Implementation (`channel.go`) — topic-filtered fan-out with drop-on-full backpressure

```go
const defaultBufferSize = 256

type ChannelBus struct {
	mu         sync.RWMutex
	bufferSize int
	subs       map[<-chan Event]*channelSub
}
type channelSub struct {
	ch    chan Event
	types map[EventType]struct{}
}

func (b *ChannelBus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, sub := range b.subs {
		if _, ok := sub.types[event.Type]; !ok {
			continue
		}
		select {
		case sub.ch <- event:
		default:
			logger.Warn("dropping event for full subscriber channel", "event_type", event.Type)
		}
	}
}

func (b *ChannelBus) Subscribe(eventTypes ...EventType) <-chan Event {
	ch := make(chan Event, b.bufferSize)
	types := make(map[EventType]struct{}, len(eventTypes))
	for _, t := range eventTypes {
		types[t] = struct{}{}
	}
	b.mu.Lock()
	b.subs[ch] = &channelSub{ch: ch, types: types}
	b.mu.Unlock()
	return ch
}

func (b *ChannelBus) Unsubscribe(ch <-chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if sub, ok := b.subs[ch]; ok {
		delete(b.subs, ch)
		close(sub.ch)
	}
}
```

Design properties to copy:
- **Per-subscriber buffered channel** (default 256). Each `Subscribe` returns a fresh
  channel; the bus keeps a registry keyed by the channel.
- **Topic filtering at subscribe time**: a subscriber names the event types it wants;
  `Publish` skips subscribers not registered for that type.
- **Backpressure = drop newest for that subscriber only** (the `select { ... default: }`
  non-blocking send). A slow subscriber never blocks the publisher or other
  subscribers. This is the explicit policy: live data is lossy under pressure, never
  blocking. For us this is exactly right — a stalled browser tab must not stall the
  poller.
- **Unsubscribe closes the channel**, which is the teardown signal consumers loop on
  (`case evt, ok := <-ch; if !ok { return }`).
- Mutex-guarded map; `Publish` takes RLock, mutating ops take Lock.

### `pubsub.Fanout[T]` — the typed, topicless variant (`internal/pubsub/fanout.go`)

For streams that are a single firehose with no per-type routing (logs, activity feed,
alarms), saffron-hive uses a generic `Fanout[T]` instead of the eventbus:

```go
const DefaultSubscriberBuffer = 64

type Fanout[T any] struct {
	bufSize int
	mu      sync.Mutex
	subs    map[*fanoutSub[T]]struct{}
}

func (f *Fanout[T]) Publish(v T) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for sub := range f.subs {
		select {
		case sub.ch <- v:
		default:           // drop for slow subscriber only
		}
	}
}

func (f *Fanout[T]) Subscribe() (<-chan T, func()) {
	sub := &fanoutSub[T]{ch: make(chan T, f.bufSize)}
	f.mu.Lock()
	f.subs[sub] = struct{}{}
	f.mu.Unlock()
	var once sync.Once
	unsub := func() { once.Do(func() {
		f.mu.Lock(); delete(f.subs, sub); f.mu.Unlock()
	}) }
	return sub.ch, unsub
}
```

Note the difference in teardown contract: `Fanout.Subscribe` returns
`(<-chan T, unsubFunc)` and the **subscriber** owns the channel (unsub does NOT close
it — it just deregisters; the resolver goroutine `close()`s its own `out`). The
eventbus instead closes the channel inside `Unsubscribe`. Both work; pick one
convention and apply uniformly. `logging.Buffer`/`activity.Buffer`/`alarms.Buffer` each
wrap a `pubsub.Fanout` plus a ring buffer of recent items.

**Recommendation for our refactor:** use the topic-filtered `ChannelBus` for the live
factory/game state stream (where consumers want specific event types), and `Fanout[T]`
for any topicless firehose (e.g. a raw "offline event" feed) if needed. We likely only
need one bus.

---

## 5. The bridge: eventbus -> Subscription resolver

This is the core pattern. Every subscription resolver follows an identical shape
(`internal/graph/schema.resolvers.go`, e.g. `DeviceStateChanged` at line 2174):

```go
func (r *subscriptionResolver) DeviceStateChanged(ctx context.Context, deviceID *string) (<-chan *model.DeviceStateEvent, error) {
	ch := r.EventBus.Subscribe(eventbus.EventDeviceStateChanged)  // 1. subscribe to bus
	out := make(chan *model.DeviceStateEvent, 1)                   // 2. typed output channel

	go func() {
		defer close(out)                       // 3a. close output on exit (signals gqlgen done)
		defer r.EventBus.Unsubscribe(ch)       // 3b. deregister from bus

		for {
			select {
			case <-ctx.Done():                 // 4. client disconnect -> ctx cancelled by gqlgen
				return
			case evt, ok := <-ch:
				if !ok {                       // 5. bus closed our channel
					return
				}
				if deviceID != nil && evt.DeviceID != *deviceID {
					continue                   // 6. server-side filter on the optional arg
				}
				state := resolveDeviceStateFromReader(r.StateReader, device.DeviceID(evt.DeviceID))
				if state == nil {
					continue
				}
				select {                       // 7. forward, but respect cancellation
				case out <- &model.DeviceStateEvent{DeviceID: evt.DeviceID, State: state}:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return out, nil                            // 8. gqlgen reads from out until closed
}
```

The recipe, generalized:
1. `r.EventBus.Subscribe(<types>)` to get the raw `<-chan Event`.
2. Make a small (cap 1 or 16) typed `out` channel of the generated model type.
3. Spawn one goroutine per client subscription. `defer close(out)` +
   `defer r.EventBus.Unsubscribe(ch)`.
4. Loop on `select` over `ctx.Done()` and the bus channel.
5. **`ctx` is the per-subscription context gqlgen derives from the websocket
   connection.** When the graphql-ws client sends `complete` or the socket drops,
   gqlgen cancels this ctx, the goroutine returns, `out` is closed (telling gqlgen the
   stream ended), and the bus subscription is removed. This is the entire teardown
   story — verified by `TestSubscriptionClientDisconnect` which cancels ctx and asserts
   `out` closes.
6. Apply the optional filter argument server-side (`continue` on mismatch).
7. Map the domain payload -> generated GraphQL model (often re-reading current state
   from `StateReader`, not trusting the event payload alone — the event is a "something
   changed for device X" trigger, then the resolver reads the authoritative current
   state). The forward send is itself a `select` with `ctx.Done()` so a slow client
   cannot wedge the goroutine.
8. Return `out, nil`.

Fanout-backed subscriptions (`LogStream`, `ActivityStream`, `AlarmEvent`) are identical
except step 1/3b use `ch, unsub := r.LogBuffer.Subscribe()` / `defer unsub()`.

**Producer side:** anything that mutates live state calls `bus.Publish(eventbus.Event{...})`.
In our refactor the single in-process poller publishes on every poll diff; mutations
that change state also publish. The `history.RunRecorder` is itself just another
subscriber (see §7) — persistence and live streaming are decoupled consumers of the
same bus.

---

## 6. Server transport wiring (gqlgen handler, websocket, auth)

`cmd/serve/serve.go` around line 222-262. This is the consolidation target: one Go
binary, one mux, GraphQL over HTTP POST/GET + websocket, embedded SPA, no nginx, no
Redis.

```go
resolver := &graph.Resolver{
	StateReader: memStore,
	Store:       sqlStore,
	EventBus:    bus,
	// ... all deps
}

gqlSrv := handler.New(graph.NewExecutableSchema(graph.Config{
	Resolvers: resolver,
	Directives: graph.DirectiveRoot{
		Auth: graph.AuthDirective,          // wire the @auth directive
	},
}))
gqlSrv.AddTransport(transport.GET{})
gqlSrv.AddTransport(transport.POST{})
gqlSrv.AddTransport(transport.Websocket{   // graphql-ws subscriptions
	InitFunc: wsInitFunc(authSvc, sqlStore),
	Upgrader: websocket.Upgrader{
		CheckOrigin: originChecker(cfg.AllowedOrigins),
	},
})
gqlSrv.Use(extension.FixedComplexityLimit(MaxQueryComplexity))
gqlSrv.SetErrorPresenter(graph.ErrorPresenter)

mux := http.NewServeMux()
mux.Handle("/graphql", auth.ClientIPMiddleware(...)(
	auth.RequestGuard(auth.MaxGraphQLRequestBytes)(
		auth.Middleware(authSvc, sqlStore)(gqlSrv),   // HTTP auth -> ctx
	),
))
mux.HandleFunc("/health", ...)
staticFS, _ := fs.Sub(webDist, "webdist")             // embedded SPA
mux.Handle("/", spaFallbackHandler(staticFS))         // SPA fallback to index.html
```

Note `handler.New` (not `handler.NewDefaultServer`) so transports are added explicitly
— required to register `transport.Websocket` for subscriptions. The same `gqlSrv`
handler serves queries/mutations (POST/GET) and subscriptions (Websocket).

### SPA embed (deployment consolidation, ref for plan 01)

```go
//go:embed all:webdist
var webDist embed.FS
```

The built frontend is copied into `cmd/serve/webdist` at build time and embedded into
the binary; `spaFallbackHandler` serves static files and falls back to `index.html`
for client routes. This is exactly the single-container model we want.

---

## 7. History recorder = a bus subscriber that writes SQLite

`internal/history/recorder.go`. This shows the live/history split cleanly: history is
NOT a separate code path off the poller; it's just another consumer of the same bus.

```go
func RunRecorder(ctx context.Context, bus eventbus.Subscriber, s historyStore) {
	ch := bus.Subscribe(eventbus.EventDeviceStateChanged)
	defer bus.Unsubscribe(ch)
	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-ch:
			if !ok { return }
			handleState(ctx, s, evt)   // decompose -> InsertStateSample rows
		}
	}
}
```

`historyStore` is again a narrow interface (`InsertStateSample`,
`PruneDeviceStateSamplesOlderThan`, `GetSetting`) satisfied by `*store.DB`. Each state
change is decomposed into one row per non-nil scalar field (`history/fields.go` defines
the canonical field-name whitelist `AllFields`, shared by the recorder, the
`stateHistory` query resolver, and the frontend field picker). Retention runs on a
separate prune loop (`retention.go`).

Mapping to us: the poller publishes a "state changed" event; the recorder subscribes
and writes the history sample rows; the `stateHistory`/`aggregatedStateHistory` query
resolvers read those rows back from SQLite. Live subscribers get the same event in
parallel. One producer, N independent consumers.

---

## 8. Auth: directive + context injection (HTTP and WS paths)

Two entry points both land a `auth.CtxUser` in the request/connection context, then a
single `@auth` directive enforces presence per-field.

**HTTP path** (`auth.Middleware`, `internal/auth/middleware.go`): parse JWT from header,
look the user up in SQLite, `next.ServeHTTP(w, r.WithContext(WithUser(ctx, user)))`. It
deliberately **does not reject** unauthenticated requests itself — it just attaches the
user if present and lets the `@auth` directive reject. It also skips websocket upgrades
(`if isWebSocketUpgrade(r) { next; return }`) so the WS init func owns auth for sockets.

**Websocket path** (`wsInitFunc`, `serve.go:364`): graphql-ws sends an init payload with
`connectionParams`. The init func reads `authToken`, parses the JWT, reloads the user
from SQLite (so `must_change_password` is fresh), checks token version (revocation),
and returns a context carrying the user:

```go
func wsInitFunc(svc *auth.Service, lookup auth.UserLookup) transport.WebsocketInitFunc {
	return func(ctx context.Context, init transport.InitPayload) (context.Context, *transport.InitPayload, error) {
		token, _ := init["authToken"].(string)
		if token == "" { return ctx, nil, errors.New("missing authToken") }
		claims, err := svc.Parse(token)
		if err != nil { return ctx, nil, errors.New("invalid or expired token") }
		u, err := lookup.GetUserByID(ctx, claims.UserID)
		if err != nil { return ctx, nil, errors.New("user not found") }
		if claims.TokenVersion != u.TokenVersion { return ctx, nil, errors.New("session revoked") }
		return auth.WithUser(ctx, auth.CtxUser{ ID: u.ID, /* ... */ }), nil, nil
	}
}
```

**The directive** (`internal/graph/directive.go`) is registered via
`graph.Config{Directives: graph.DirectiveRoot{Auth: graph.AuthDirective}}` and runs for
every field tagged `@auth`:

```go
func AuthDirective(ctx context.Context, _ any, next graphql.Resolver) (any, error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, &gqlerror.Error{Message: "authentication required",
			Extensions: map[string]any{"code": "UNAUTHENTICATED"}}
	}
	// optional: forced-password-change allowlist gating
	return next(ctx)
}
```

Because the directive reads the user from ctx, **the same directive enforces auth for
queries, mutations, AND subscriptions** uniformly — the only difference is where the
user got injected (HTTP middleware vs WS init func). For subscriptions, the user is
attached once at connect time and lives for the whole socket.

**Error presenter** (`internal/graph/error_presenter.go`): scrubs gqlgen parse/validation
error messages for unauthenticated callers (so the schema can't be reconstructed via
introspection-by-error), passes resolver errors through verbatim. Wired with
`gqlSrv.SetErrorPresenter(graph.ErrorPresenter)`.

---

## 9. Translating to our React frontend (plan 07 hand-off)

saffron-hive's client is Svelte+urql, but the server contract is framework-agnostic.
The React equivalents:
- urql React bindings (`urql` package + `Provider`, `useQuery`, `useMutation`,
  `useSubscription`).
- `@graphql-codegen/client-preset` against `api/schema.graphql` to generate typed
  documents (replaces our current tygo Go->TS generation).
- `graphql-ws` as the subscription transport; configure urql's `subscriptionExchange`
  to use a `graphql-ws` `createClient` with `connectionParams: () => ({ authToken })`
  — this is exactly what `wsInitFunc` reads server-side.
- Per-page "smart" queries: each route declares a query selecting exactly the fields it
  renders; live views additionally open a `useSubscription` whose document mirrors the
  matching `Subscription` field. The query fetches the initial snapshot; the
  subscription streams deltas.

---

## 10. Concrete recipe checklist for our refactor

1. `api/schema.graphql`: one SDL file. Declare `scalar DateTime`, `directive @auth`,
   `type Query/Mutation/Subscription`. Tag every field `@auth` except public ones.
2. `gqlgen.yml`: copy saffron-hive's verbatim (paths under `internal/graph`,
   `model.package: model`, `DateTime -> graphql.Time`, `autobind: []`,
   `resolver.layout: follow-schema`). Run codegen via the go.mod `tool` directive.
3. `internal/eventbus`: copy `EventType` consts + `Event` envelope + `ChannelBus`
   (topic-filtered, 256-buffer, drop-on-full). Define our event types (poll diff,
   offline, etc.).
4. `internal/graph/resolver.go`: `Resolver` struct with interface-typed deps
   (`Store GraphStore`, `EventBus eventbus.EventBus`, `StateReader`, `Auth`). Define a
   narrow `GraphStore` interface = only the sqlc store methods resolvers use.
5. Subscription resolvers: one goroutine per client, `Subscribe`/`defer Unsubscribe`,
   `select` on `ctx.Done()` + bus channel, server-side filter on optional args, forward
   with a `ctx.Done()`-guarded send, `defer close(out)`. Copy the `DeviceStateChanged`
   shape.
6. Query resolvers: read history/config from the sqlc store. Mutations: write store +
   `bus.Publish` the resulting change.
7. `internal/history` recorder: a bus subscriber that writes SQLite samples;
   independent of live streaming.
8. `cmd/serve`: `handler.New` + `transport.GET/POST/Websocket`, `graph.Config` with the
   `@auth` directive, `SetErrorPresenter`, HTTP `auth.Middleware` + WS `InitFunc` both
   injecting the user into ctx. Embed the built SPA via `//go:embed` + SPA fallback.
9. Tests: copy `subscription_test.go` patterns — publish on a `NewChannelBus`, assert
   the resolver's `out` channel delivers/filters, and `TestSubscriptionClientDisconnect`
   (cancel ctx, assert `out` closes) for teardown.
