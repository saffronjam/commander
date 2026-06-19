# 05 — In-process Eventbus on Go Channels

## Context

Today every live update travels through Redis pub/sub. The single poll handler in
`api/worker/session_manager.go` does three things on each FRM poll result: caches the
latest value (`state:` key), persists history (`history:` ZSET) for five types, and
`kvClient.Publish("satisfactory_events:{sessionID}", json)`. Browsers open an SSE
connection per tab; `api/routers/api/v1/events_sse.go` opens a *separate Redis SUBSCRIBE
per connection* with a 1000-element buffer, feeds messages into a per-connection
`CoalescingQueue` (latest-message-per-event-type, drop stale), and streams them out via
`gin.Stream`. Connectivity is signalled both as a persisted session flag
(`IsOnline` / `IsDisconnected`) and as a live `satisfactoryApiCheck` event riding the
same pub/sub channel. Settings changes ride a second Redis channel (`settings_changed`).

This plan replaces all of that with one in-process eventbus built on Go channels,
modeled on saffron-hive's `internal/eventbus` `ChannelBus` and `internal/pubsub.Fanout[T]`
(see research `ref-graphql.md` §4–5). The poller (plan 02) becomes the sole producer; the
gqlgen subscription resolvers (plan 06) become the consumers. There is exactly one process,
so there is no cross-instance broadcast to preserve — the bus is purely in-memory fan-out.

The bus stays **generic**: it carries typed Go values inside an `Event.Payload any`
envelope — never JSON, never the GraphQL model types. Plan 06's per-domain resolvers do the
mapping from a topic to a typed `<domain>Changed` payload. Doc 08 is the authoritative
type/field/table catalog; this plan conforms to it. In particular, decision D-C makes the
GraphQL surface **fully typed per domain** — there is no single `liveState` object, no
opaque `data` field, and no JSON/Any scalar on the wire. The eventbus is the internal
transport behind those typed per-domain `<domain>Changed` subscriptions; the typing happens
in the resolver, not on the bus.

This document owns: the bus package (topic taxonomy, envelope, publish/subscribe API,
fan-out, buffering, slow-consumer policy, per-client teardown), the latest-state snapshot
accessor that backs the initial subscription payload, and the producer/consumer contract
between the poller and the subscription resolvers. It does **not** own the GraphQL schema
or resolver wiring (plan 06, conforming to 08), the SQLite history recorder (plan 04/08),
or poller internals (plan 02) beyond the single line where the poller calls `bus.Publish`.

There is **no mock mode** (decision D-D): `Config.Mock` never existed in code and no mock
poller is built, so this plan describes exactly one producer — the live in-process poller.
No plan may assume a mock producer onto the bus.

Relevant research: `live-dataflow.md` §2, §6, §9, §10; `redis-inventory.md` §2, §3;
`ref-graphql.md` §4, §5.

## Settled design decisions

1. **One bus instance per process, keyed by `(session, save, dataType)` at the topic
   level — not one bus per session.** A single `*eventbus.Bus` is constructed in `cmd/`
   and injected into both the `SessionManager` (producer) and the GraphQL `Resolver`
   (consumer). Session/save/type isolation is achieved by carrying those three keys on
   every event and filtering at subscribe time, exactly as saffron-hive carries `DeviceID`.
   This avoids a registry-of-buses lifecycle problem when sessions come and go.

2. **Topic = (SessionID, SaveName, DataType).** A subscriber names the `DataType`s it
   wants and pins a single session; `Publish` skips any subscriber whose `DataType` set
   excludes the event, or whose pinned session differs. This is the routing surface behind
   the per-domain `<domain>Changed` subscriptions (decision D-C): each typed subscription
   pins exactly one `DataType`. `SaveName` is part of the key (decision E-11) so a save-name
   switch never bleeds one save's live state into another's stream; it preserves commit
   `0a12da8` ("include save name in state cache keys"). This replaces the single Redis
   channel-name-per-session scheme (`satisfactory_events:{sessionID}`) and the separate
   `settings_changed` channel with one typed taxonomy.

3. **Per-subscriber buffered channel, drop-newest on full (lossy live data).** Copy
   saffron-hive's non-blocking `select { case ch <- e: default: warn+drop }`. A stalled
   browser tab must never block the poller or other subscribers. Live data is allowed to be
   lossy under pressure; history (SQLite, plan 04) is the durable path. Default buffer 256.

4. **Coalesce-latest-per-type moves into the subscription resolver, not the bus.** The
   current `CoalescingQueue` (latest-per-`SatisfactoryEventType`, drop stale) is
   per-SSE-connection backpressure. With per-domain subscriptions each resolver streams a
   single `DataType`, so "latest-per-type" degenerates to "keep only the newest pending
   event for this one domain". We keep that *exact* semantic but relocate it next to the
   resolver's forward loop, because coalescing is per-consumer policy, not bus policy. The
   bus stays a dumb fan-out; the resolver collapses a burst of same-domain events to the
   latest before forwarding. This keeps the bus identical to the reference and preserves the
   "only the latest state per type matters" guarantee.

5. **Latest-state snapshot lives in the poller and is exposed through the bus's owner, not
   stored in the bus.** The Redis `state:` cache becomes an in-memory
   `map[(sessionID, saveName, dataType)]SatisfactoryEvent` (`LatestStore`) owned by the
   `SessionManager`, updated on every poll *before* publishing. It backs two reads: the
   typed per-domain snapshot **queries** (plan 06; e.g. `Query.circuits`, `Query.factoryStats`)
   that drive first paint, and a subscription resolver's first forwarded payload (mirroring
   how SSE + `/state` work together today). The bus itself holds no state — it is fan-out
   only. The `save_name` segment in the key is mandatory (decision E-11).

6. **Offline/online is a first-class topic, not a side channel.** The 5-failure threshold
   logic in `frm_client` (`live-dataflow.md` §6) fires a `Connectivity` event onto the bus
   carrying `{SessionID, Online bool}`. The persisted `is_online` / `is_disconnected`
   columns (SQLite, plan 04) are updated by the same code path; the live transition is the
   bus event. Plan 06 bridges this topic to the typed `connectivityChanged(sessionId): ConnectivityStatus!`
   subscription (08). The poller flips its own tick set between full/light mode internally —
   no goroutine teardown/restart, no Redis recovery dance.

7. **Settings changes use the same bus, kind `SettingsChanged`, but do NOT reach the wire.**
   The `settings_changed` Redis channel collapses to one in-process event kind
   (`redis-inventory.md` §3). Per decision D-C / 08 there is **no `settingsChanged` GraphQL
   subscription** — settings changes are surfaced to the client by a refetch after the
   `updateSettings` mutation. This kind exists purely for the in-process log-level listener
   (plan 03) and is never bridged to a subscription resolver. (Plan 03 decides whether the
   listener subscribes to this kind or settings `Update()` applies the log-level change
   directly; this plan only reserves the kind.)

8. **Unsubscribe closes the channel; consumers loop on `ok`.** We adopt the `ChannelBus`
   teardown convention (`Unsubscribe(ch)` closes `ch`) rather than the `Fanout[T]`
   return-an-unsub-func convention, and apply it uniformly. Per-client teardown is driven by
   the gqlgen-derived subscription `ctx`: when the graphql-ws client sends `complete` or the
   socket drops, `ctx` is cancelled, the resolver goroutine returns, `defer close(out)`
   signals gqlgen the stream ended, and `defer bus.Unsubscribe(ch)` deregisters from the bus.

9. **No generics-per-domain on the bus; one `Event` envelope with `Payload any`.** Consumers
   type-assert `Payload` and `continue` on mismatch, matching the reference `Event` envelope.
   The existing `SatisfactoryEventType` string constants become the `DataType` set verbatim,
   so no payload mapping churn beyond moving the constants into the bus package. The typing
   into a concrete `<domain>Changed` GraphQL payload happens in plan 06's resolver, not on
   the bus — the bus carries the typed Go value (`models.Circuit` slice, `models.FactoryStats`,
   …) inside `Payload any`, never JSON.

## Capacity envelope (decision D-B)

The bus is sized for the same target as the rest of the refactor: **up to ~10 concurrent
game sessions** (08, "Capacity envelope"). At that scale fan-out is a handful of subscribers
per session — one browser tab opens a few `<domain>Changed` streams, each pinned to one
`(session, save, dataType)` topic — so a publish iterates a small registry and does
non-blocking sends. The drop-on-full policy (decision 3) absorbs slow clients without ever
touching the single in-process poller. Beyond a few dozen sessions the single-poller /
single-writer model would need revisiting (sharded pollers, a write queue); that is
**explicitly out of scope** here.

## Topic taxonomy

Three event kinds, distinguished by payload shape; the live game-state kind further routes
by `DataType` and `SaveName`. The existing `SatisfactoryEventType` values are *not* separate
bus kinds — they ride inside the `Satisfactory` kind as the payload's `DataType`, exactly as
`SatisfactoryEvent.Type` works today. This keeps fan-out cheap (a subscriber registers one
`DataType` on one session) while letting plan 06 expose one typed `<domain>Changed`
subscription per `DataType`.

| Kind | Scope | Payload type | Producer | Consumer |
|---|---|---|---|---|
| `KindSatisfactory` | per (session, save, dataType) | `SatisfactoryEvent{ SessionID, SaveName, DataType, Data any, GameTimeID }` | poller poll handler | per-domain `<domain>Changed` subscription resolvers; history recorder |
| `KindConnectivity` | per session | `ConnectivityEvent{ SessionID, Online bool, At time.Time }` | poller (failure-threshold + recovery) | `connectivityChanged` subscription resolver; session-row updater |
| `KindSettingsChanged` | global | `SettingsChangedEvent{ Payload any }` | settings service `Update()` | in-process settings/log-level listener (NOT a GraphQL subscription) |

Routing is by the `SessionID` / `SaveName` / `DataType` fields on the payload plus the
filters declared at subscribe time, not by a topic-name string. A subscriber pins one
session + one save + one `DataType` (`SubscribeDomain(sid, save, dataType)`, used by each
typed `<domain>Changed` resolver), pins one session for all kinds
(`SubscribeSession(sid, kinds...)`, used by `connectivityChanged`), or takes the firehose
(`Subscribe(kinds...)`, used by the history recorder which writes every session's history).

`SatisfactoryEventSessionUpdate` (emitted today by `monitorSessionInfo` when the save name
changes or config changes) stays a `DataType` inside `KindSatisfactory`; plan 06 bridges it
to the typed `sessionUpdated(sessionId): Session!` subscription (08). The
offline/online/`stage` control signal is carried by `KindConnectivity` and bridged to
`connectivityChanged(sessionId): ConnectivityStatus!` (08).

## Files to ADD

- `api/pkg/eventbus/eventbus.go` — `EventKind`, `Event` envelope, the three payload structs,
  `Publisher` / `Subscriber` / `Bus` interfaces.
- `api/pkg/eventbus/channel.go` — `*ChannelBus` implementation (registry, fan-out, drop-on-full).
- `api/pkg/eventbus/channel_test.go` — fan-out, topic filtering (session + save + dataType),
  drop-on-full, unsubscribe-closes, concurrent publish/subscribe race test.
- `api/pkg/eventbus/snapshot.go` — `LatestStore`, the in-memory
  latest-state-per-`(session, save, dataType)` map that replaces the Redis `state:` cache,
  with `Put` / `Snapshot` / `Get` / `Clear`.

## Files to CHANGE

- `api/worker/session_manager.go` — poll handler publishes to the bus instead of
  `kvClient.Set` + `kvClient.Publish`; updates `LatestStore` before publishing; fires
  `KindConnectivity` from the `onDisconnected` / recovery path; injects `*ChannelBus` and
  `*LatestStore`. (Lease/owner gating removed by plan 02.)
- `api/service/frm_client/client.go` — `onDisconnected` callback now drives a
  `ConnectivityEvent` publish (wired through the session manager); light-poll/full-poll mode
  swap stays internal (plan 02 owns the goroutine restructure).
- `api/models/models/satisfactory_event.go` — drop the Redis-specific `SatisfactoryEventKey`
  const and the `SseSatisfactoryEvent` wrapper (SSE-only). `SatisfactoryEventType` constants
  move to / are re-exported from the eventbus package; keep `SatisfactoryEvent` shape.

## Files to DELETE

- `api/routers/api/v1/events_sse.go` — the entire SSE endpoint, `CoalescingQueue`, and the
  per-client `clients` map. Coalescing logic is re-implemented inside the subscription
  resolver (plan 06); the `clients` debug map is dropped.
- `api/pkg/db/key_value/client.go` `Publish` / `AddListener` methods — removed with Redis
  (plan 03 owns the full key_value deletion; called out here as the producer/consumer endpoints).

## The bus

`api/pkg/eventbus/eventbus.go`:

```go
package eventbus

import "time"

type EventKind string

const (
	KindSatisfactory    EventKind = "satisfactory"
	KindConnectivity    EventKind = "connectivity"
	KindSettingsChanged EventKind = "settings_changed"
)

type Event struct {
	Kind      EventKind
	SessionID string
	SaveName  string
	DataType  string
	Payload   any
}

type SatisfactoryEvent struct {
	SessionID  string
	SaveName   string
	DataType   string
	Data       any
	GameTimeID int64
}

type ConnectivityEvent struct {
	SessionID string
	Online    bool
	At        time.Time
}

type SettingsChangedEvent struct {
	Payload any
}

type Publisher interface {
	Publish(event Event)
}

type Subscriber interface {
	Subscribe(kinds ...EventKind) <-chan Event
	SubscribeSession(sessionID string, kinds ...EventKind) <-chan Event
	SubscribeDomain(sessionID, saveName, dataType string) <-chan Event
	Unsubscribe(ch <-chan Event)
}

type Bus interface {
	Publisher
	Subscriber
}
```

`SubscribeDomain` is the routing surface for the per-domain `<domain>Changed` subscriptions:
it pins one session, one save, and one `DataType`, implicitly the `KindSatisfactory` kind.
`SubscribeSession` pins one session across the named kinds (used by `connectivityChanged`,
which subscribes to `KindConnectivity`, and by any resolver that also wants `KindSatisfactory`
session-wide). `Subscribe` is the unfiltered firehose (history recorder).

`api/pkg/eventbus/channel.go`:

```go
package eventbus

import (
	"sync"

	"api/pkg/log"
)

const defaultBufferSize = 256

type subscription struct {
	ch        chan Event
	kinds     map[EventKind]struct{}
	sessionID string
	saveName  string
	dataType  string
}

func (s *subscription) wants(e Event) bool {
	if _, ok := s.kinds[e.Kind]; !ok {
		return false
	}
	if s.sessionID != "" && e.SessionID != "" && s.sessionID != e.SessionID {
		return false
	}
	if s.saveName != "" && e.SaveName != "" && s.saveName != e.SaveName {
		return false
	}
	if s.dataType != "" && e.DataType != "" && s.dataType != e.DataType {
		return false
	}
	return true
}

type ChannelBus struct {
	mu         sync.RWMutex
	bufferSize int
	subs       map[<-chan Event]*subscription
}

func NewChannelBus() *ChannelBus {
	return &ChannelBus{
		bufferSize: defaultBufferSize,
		subs:       make(map[<-chan Event]*subscription),
	}
}

func (b *ChannelBus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, sub := range b.subs {
		if !sub.wants(event) {
			continue
		}
		select {
		case sub.ch <- event:
		default:
			log.Debugf("eventbus: dropping %s event for full subscriber", event.Kind)
		}
	}
}

func (b *ChannelBus) Subscribe(kinds ...EventKind) <-chan Event {
	return b.subscribe("", "", "", kinds)
}

func (b *ChannelBus) SubscribeSession(sessionID string, kinds ...EventKind) <-chan Event {
	return b.subscribe(sessionID, "", "", kinds)
}

func (b *ChannelBus) SubscribeDomain(sessionID, saveName, dataType string) <-chan Event {
	return b.subscribe(sessionID, saveName, dataType, []EventKind{KindSatisfactory})
}

func (b *ChannelBus) subscribe(sessionID, saveName, dataType string, kinds []EventKind) <-chan Event {
	ch := make(chan Event, b.bufferSize)
	set := make(map[EventKind]struct{}, len(kinds))
	for _, k := range kinds {
		set[k] = struct{}{}
	}
	b.mu.Lock()
	b.subs[ch] = &subscription{
		ch:        ch,
		kinds:     set,
		sessionID: sessionID,
		saveName:  saveName,
		dataType:  dataType,
	}
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

Properties (all copied from saffron-hive's `ChannelBus`, `ref-graphql.md` §4, extended with
the save/dataType filter for E-11 + the per-domain routing of D-C):

- **Per-subscriber buffered channel**, default 256. Each `Subscribe`/`SubscribeSession`/
  `SubscribeDomain` returns a fresh channel; the registry is keyed by that channel.
- **Filtering at subscribe time**: kind set + optional pinned session + optional save +
  optional `DataType`, evaluated in `wants`. An empty filter field matches anything (so the
  firehose recorder leaves all three empty, `connectivityChanged` pins only the session, and
  a `<domain>Changed` resolver pins all three).
- **Backpressure = drop-newest, that subscriber only** (the `default:` branch). Never blocks
  the publisher or other subscribers. This is the deliberate slow-consumer policy: a wedged
  browser tab loses live frames, the poller keeps polling, and history stays whole in SQLite.
- **Unsubscribe closes the channel** — the teardown signal consumers loop on (`ok == false`).
- RLock for `Publish`, Lock for register/deregister. Sending under RLock is safe because the
  send is non-blocking; `Unsubscribe` takes the write lock so it can never race with a send
  into a closed channel.

## Latest-state snapshot

Replaces the Redis `state:` cache (`redis-inventory.md` §1). Owned by the `SessionManager`,
written on every poll before publishing, read by a new subscriber for its first payload and
by the typed per-domain snapshot **queries** (plan 06; `Query.circuits`, `Query.factoryStats`,
…). There is no `Query.state` / `liveState` single object (decision D-C); each snapshot query
reads exactly one `DataType` out of the store.

`api/pkg/eventbus/snapshot.go`:

```go
package eventbus

import "sync"

type stateKey struct {
	sessionID string
	saveName  string
	dataType  string
}

type LatestStore struct {
	mu     sync.RWMutex
	latest map[stateKey]SatisfactoryEvent
}

func NewLatestStore() *LatestStore {
	return &LatestStore{latest: make(map[stateKey]SatisfactoryEvent)}
}

func (s *LatestStore) Put(e SatisfactoryEvent) {
	if e.SaveName == "" {
		return
	}
	s.mu.Lock()
	s.latest[stateKey{e.SessionID, e.SaveName, e.DataType}] = e
	s.mu.Unlock()
}

func (s *LatestStore) Get(sessionID, saveName, dataType string) (SatisfactoryEvent, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.latest[stateKey{sessionID, saveName, dataType}]
	return e, ok
}

func (s *LatestStore) Snapshot(sessionID, saveName string) []SatisfactoryEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []SatisfactoryEvent
	for k, v := range s.latest {
		if k.sessionID == sessionID && k.saveName == saveName {
			out = append(out, v)
		}
	}
	return out
}

func (s *LatestStore) Clear(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for k := range s.latest {
		if k.sessionID == sessionID {
			delete(s.latest, k)
		}
	}
}
```

`Get(sessionID, saveName, dataType)` backs the per-domain snapshot queries and the
per-domain subscription's first payload — one `DataType` at a time, matching the typed
GraphQL surface. `Snapshot(sessionID, saveName)` returns the whole save's latest set and is
used where a derivation needs every type at once (e.g. session-stage). `SaveName` is part of
the key (decision E-11), so a save-name switch never returns a stale save's state.

Session-stage `init` / `ready` (currently `GetSessionStage` checking all `RequiredEventTypes`
have a `state:` key) becomes: does `Snapshot(sessionID, saveName)` cover all
`models.RequiredEventTypes`? That derivation feeds the resolver-computed `Session.stage` /
`ConnectivityStatus.stage` fields (plan 06, 08); the data source is `LatestStore`.
`Clear(sessionID)` is called on session delete, replacing the `List("state:{sid}:*")` + `Del`
KEYS scan. (Durable history is removed by the `history_points` `ON DELETE CASCADE`, 04/08.)

## How the poller publishes (plan 02 producer side)

In `api/worker/session_manager.go`, the per-poll handler (today `session_manager.go:267-348`)
collapses to: update snapshot, persist history if applicable, publish. The Redis `Set` and
`Publish` calls and the lease gating are gone. This is the **only** producer onto the bus —
there is no mock producer (decision D-D).

```go
func (m *SessionManager) handlePoll(sessionID, saveName string, e models.SatisfactoryEvent) {
	be := eventbus.SatisfactoryEvent{
		SessionID:  sessionID,
		SaveName:   saveName,
		DataType:   string(e.Type),
		Data:       e.Data,
		GameTimeID: e.GameTimeID,
	}

	m.latest.Put(be)

	if isHistoryEnabled(e.Type) && saveName != "" && e.GameTimeID > 0 {
		m.history.Record(sessionID, saveName, be)
	}

	m.bus.Publish(eventbus.Event{
		Kind:      eventbus.KindSatisfactory,
		SessionID: sessionID,
		SaveName:  saveName,
		DataType:  string(e.Type),
		Payload:   be,
	})
}
```

`Data` carries the typed Go value the FRM client decoded (`[]models.Circuit`,
`models.FactoryStats`, …) — never JSON. Plan 06's per-domain resolver type-asserts it into
the matching `<domain>Changed` GraphQL payload. History persistence (`m.history.Record`) is
the SQLite write owned by plan 04/08 (table `history_points`, JSON `data` column — the JSON
encoding happens in the recorder, never on the bus). Following the saffron-hive pattern
(`ref-graphql.md` §7), an even cleaner option is to make the history recorder *its own bus
subscriber* (`bus.Subscribe(KindSatisfactory)` firehose) so the poll handler only publishes
and persistence is a decoupled consumer. Either wiring is acceptable; the inline call above
is the minimal change. Plan 04 decides.

Connectivity, from the `frm_client` failure-threshold callback (`live-dataflow.md` §6):

```go
func (m *SessionManager) onConnectivityChange(sessionID string, online bool) {
	m.store.UpdateOnlineStatus(sessionID, online)
	m.bus.Publish(eventbus.Event{
		Kind:      eventbus.KindConnectivity,
		SessionID: sessionID,
		Payload: eventbus.ConnectivityEvent{
			SessionID: sessionID,
			Online:    online,
			At:        time.Now(),
		},
	})
}
```

`UpdateOnlineStatus` writes the SQLite session online/disconnected state (plan 04). The
poller swaps its tick set internally; this callback only records and announces. Plan 06's
`connectivityChanged` resolver maps this to the typed `ConnectivityStatus` payload
(`{ isOnline, isDisconnected, stage }`, 08), deriving `stage` from `LatestStore`.

## How a subscription resolver consumes (plan 06 consumer side)

The shape is the saffron-hive `DeviceStateChanged` recipe (`ref-graphql.md` §5), one
resolver **per domain**, with the latest-per-domain coalesce relocated here. Each resolver
pins one `(session, save, dataType)` topic via `SubscribeDomain` and returns the concrete
typed `<domain>Changed` payload. The snapshot is sent first so a new subscriber is
immediately consistent (R7) — the job the per-domain `/state` slice + SSE did together today.

```go
func (r *subscriptionResolver) CircuitsChanged(ctx context.Context, sessionID string) (<-chan []*model.Circuit, error) {
	saveName := r.SessionManager.CurrentSaveName(sessionID)
	ch := r.Bus.SubscribeDomain(sessionID, saveName, string(models.SatisfactoryEventCircuits))
	out := make(chan []*model.Circuit, 1)

	go func() {
		defer close(out)
		defer r.Bus.Unsubscribe(ch)

		if snap, ok := r.Latest.Get(sessionID, saveName, string(models.SatisfactoryEventCircuits)); ok {
			select {
			case out <- toCircuitModels(snap):
			case <-ctx.Done():
				return
			}
		}

		var pending []*model.Circuit
		ticker := time.NewTicker(coalesceInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case evt, ok := <-ch:
				if !ok {
					return
				}
				if se, ok := evt.Payload.(eventbus.SatisfactoryEvent); ok {
					pending = toCircuitModels(se) // latest wins; single domain
				}
			case <-ticker.C:
				if pending == nil {
					continue
				}
				select {
				case out <- pending:
					pending = nil
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return out, nil
}
```

Because each resolver streams exactly one `DataType`, the old `CoalescingQueue`
latest-per-type map degenerates to a single `pending` value (latest wins, stale superseded).
The forward send is itself guarded by `ctx.Done()` so a slow client cannot wedge the
goroutine. (A simpler variant forwards each event immediately and relies only on the bus's
drop-on-full; the coalescing variant preserves today's exact "latest-state-per-type"
behaviour and is the recommended one. Plan 06 finalizes which.) The other typed
`<domain>Changed` resolvers (`factoryStatsChanged`, `prodStatsChanged`, …) are identical
except for the `DataType` they pin and the `toXModels` mapper they call; `connectivityChanged`
uses `SubscribeSession(sessionID, KindConnectivity)` and maps `ConnectivityEvent` →
`ConnectivityStatus`.

**Snapshot-first-then-subscribe ordering (R7).** The resolver `Subscribe`s **before** it
reads the snapshot, then forwards the snapshot, then drains the live channel. Because the
channel is already registered when `Get` runs, no event published in between is lost; a
duplicate is harmless because every consumer treats events as latest-wins. This is the
ordering the example above encodes (`SubscribeDomain` first, `Get` second). On WS reconnect
the client additionally re-snapshots via the typed snapshot **queries** and re-runs each
`<domain>History` query with `since=<latest gameTimeId>` (decision E-9, 08) — there is no
dedicated `historyAppended` subscription; live history points arrive on the same
`<domain>Changed` stream and charts stitch them by `gameTimeId`.

**Teardown** is entirely `ctx`-driven (`ref-graphql.md` §5, step 5): graphql-ws `complete`
or socket drop → gqlgen cancels `ctx` → goroutine returns → `defer close(out)` ends the
gqlgen stream → `defer r.Bus.Unsubscribe(ch)` closes and deregisters the bus channel. No
manual client registry, no leaked goroutines. This is verified by a `ctx`-cancel test that
asserts `out` closes (copy saffron-hive's `TestSubscriptionClientDisconnect`).

## The offline-event signal end-to-end

```
frm_client.makeSatisfactoryCall network error
   -> incrementFailureCount(); failures == failureThreshold(5)
      -> onDisconnected(sessionID)                          (callback into SessionManager)
         -> SessionManager.onConnectivityChange(sid, false)
            -> store.UpdateOnlineStatus(sid, false)         (SQLite session online/disconnected state)
            -> bus.Publish(Event{Kind: KindConnectivity, SessionID: sid,
                                 Payload: ConnectivityEvent{Online:false}})
            -> poller swaps to light tick set internally     (plan 02)

(recovery) light poll GetSessionInfo succeeds
   -> resetFailureCount(); onConnected(sessionID)
      -> SessionManager.onConnectivityChange(sid, true)
         -> store.UpdateOnlineStatus(sid, true)
         -> bus.Publish(Event{Kind: KindConnectivity, Online:true})
         -> poller swaps back to full tick set
```

Plan 06's `connectivityChanged(sessionId): ConnectivityStatus!` resolver subscribes to
`KindConnectivity` for the pinned session and maps each event to the typed
`ConnectivityStatus { isOnline isDisconnected stage }`, so the UI receives online/offline
transitions on a dedicated typed stream — matching how the `satisfactoryApiCheck` event
flowed over SSE today, but now fully typed and on its own subscription field (08).

## Step-by-step migration

1. Add `api/pkg/eventbus/` (`eventbus.go`, `channel.go`, `snapshot.go`) with no callers.
   Add `channel_test.go` covering fan-out to N subscribers, kind filtering, session +
   save + dataType pinning, drop-on-full (fill a cap-1 bus, assert no block + drop logged),
   unsubscribe-closes, and a `-race` concurrent publish/subscribe test.
2. Construct one `*ChannelBus` and one `*LatestStore` in `cmd/` and thread them into the
   `SessionManager` constructor and (later) the GraphQL `Resolver`.
3. In `session_manager.go`, replace the poll handler body with `latest.Put` + history record
   + `bus.Publish(KindSatisfactory)` carrying `SessionID`/`SaveName`/`DataType`. Delete the
   `kvClient.Set("state:…")` and `kvClient.Publish("satisfactory_events:…")` calls.
4. Wire the `frm_client` `onDisconnected`/recovery callbacks to
   `SessionManager.onConnectivityChange`, which writes the session row and publishes
   `KindConnectivity`. (Coordinated with plan 02's tick-set swap.)
5. Move `SatisfactoryEventType` constants into / re-export from the eventbus package; delete
   `SatisfactoryEventKey` and `SseSatisfactoryEvent` from `satisfactory_event.go`.
6. Delete `api/routers/api/v1/events_sse.go` and its route registration. The
   `CoalescingQueue` logic is reborn inside the per-domain subscription resolvers (plan 06).
7. Point session-delete cleanup at `LatestStore.Clear(sessionID)` instead of the Redis
   `state:` KEYS scan.
8. Plan 06 builds the per-domain `<domain>Changed` + `connectivityChanged` subscription
   resolvers against this bus + snapshot; plan 04 builds the history recorder as a bus
   subscriber (or via the inline `history.Record` call).
9. With no remaining `Publish`/`AddListener` callers, plan 03 deletes the Redis pub/sub
   surface and the dependency.

## Risks

- **Lost frames under sustained slowness.** Drop-newest means a chronically slow tab silently
  misses live updates. Acceptable by decision 3 (history is durable in SQLite; live is
  lossy). Mitigation: the per-domain coalescing means a dropped frame is superseded by the
  next poll within seconds, so the UI self-heals; the drop is logged at debug.
- **Snapshot/publish ordering race (R7).** A subscriber that calls `Get`/`Snapshot` and
  *then* `Subscribe` could miss an event published in between, or see a duplicate. The
  resolver must `SubscribeDomain` first, *then* read and forward the snapshot, *then* drain
  the live channel — as written above (subscribe before snapshot). Duplicates are harmless
  because consumers treat every event as latest-wins; a gap is impossible because the channel
  is already registered when the snapshot is taken.
- **Save-name switch mid-stream.** A subscription resolver reads `CurrentSaveName` once at
  subscribe time and pins it into the topic. If the active save changes while a stream is
  open, the pinned filter stops matching and the client sees no further frames for the old
  save — correct, because that save's live state is no longer being produced. The
  `sessionUpdated` subscription (08) tells the client the save changed; the client re-opens
  its `<domain>Changed` streams. (E-11 isolation is the point: a new save must never inherit
  the old save's `LatestStore` entry.)
- **Buffer 256 sizing.** Heavy infra types (belts/pipes at 120s) are small in count but large
  in payload; the 4s-tier types dominate frequency. 256 covers a multi-second consumer stall
  for a single-domain stream. If profiling shows drops in normal operation, raise the
  per-subscription buffer; do not switch to blocking sends (would reintroduce poller
  coupling).
- **`Payload any` type assertion drift.** If a producer publishes a `*models.Circuit` slice
  where a resolver's mapper expects a value type (or vice versa), the type assertion fails
  and the resolver silently `continue`s. Mitigation: a single constructor helper builds each
  event; the `channel_test.go` round-trips every kind's payload type; plan 06's per-domain
  mapper is the single place each `DataType` is decoded.
- **Coalescing flush latency.** The `ticker`-based flush adds up to `coalesceInterval` of
  latency. Keep it small (e.g. 100–250ms) or forward immediately and rely on bus
  drop-on-full; plan 06 decides. The current SSE path coalesces on a signal channel with
  effectively zero added latency, so prefer the signal-driven variant if reproduced
  faithfully.

## How this satisfies the done-criteria

- **No Redis pub/sub, no SSE.** `kvClient.Publish` / `AddListener` and `events_sse.go` are
  deleted; the live path is a Go-channel `ChannelBus`. The `state:` cache becomes the
  in-memory `LatestStore`. (Plan 03 removes the remaining Redis surface; this plan removes
  every live-data Redis touchpoint.)
- **Live data streamed through a single in-process poller.** The poller is the sole producer
  (no mock producer — decision D-D); GraphQL subscription resolvers are the consumers;
  fan-out, backpressure, and teardown all live in one process with no distribution. Sized for
  ~10 sessions (decision D-B).
- **GraphQL replaces the live stream, fully typed per domain (decision D-C).** The bus carries
  typed Go values keyed by `(session, save, dataType)` (decision E-11); plan 06's per-domain
  `<domain>Changed` resolvers and `connectivityChanged` map each topic to a concrete typed
  payload, with the initial snapshot as the first forwarded value (R7) — replacing SSE +
  `/state` together. There is no `liveState` single object, no opaque `data` field, and no
  JSON/Any crosses the wire.
- **Clean break, no backward compatibility.** The SSE endpoint, `CoalescingQueue`, the debug
  `clients` map, `SseSatisfactoryEvent`, and `SatisfactoryEventKey` are removed outright; no
  dual path remains.
```