# Eventbus

In-process, Go-channel fan-out for live data, plus the latest-value cache that backs snapshot
queries. Two types, no external dependencies.

## The contract

- **One producer.** `worker.SessionManager` is the only thing that publishes. Resolvers hold
  `eventbus.Subscriber`, not `Bus`, so they cannot publish by accident.
- **Typed payloads.** `Event.Payload` carries a Go value (`SatisfactoryEvent`, `ConnectivityEvent`,
  `SettingsChangedEvent`) — never JSON, never a GraphQL `model.*` type. Consumers type-assert.
- **Publish never blocks.** A subscriber whose 256-event buffer is full has the *newest* event
  dropped and logged at debug. A slow consumer degrades itself, never the poller.
- **Unsubscribe closes the channel**, so a consumer's `evt, ok := <-ch` loop terminates. Every
  subscriber must `defer Unsubscribe(ch)` or it leaks a channel and keeps receiving.

## Routing

`Event` carries `Kind` plus three routing keys — `SessionID`, `SaveName`, `DataType`. A subscription
matches when the kind is one it asked for and every non-empty key on both sides agrees, so an empty
filter field means "any".

| Kind | Payload | Subscribe with |
| --- | --- | --- |
| `KindSatisfactory` | `SatisfactoryEvent` — one live domain value at a game time | `SubscribeDomain(session, save, dataType)` |
| `KindConnectivity` | `ConnectivityEvent` — online/offline transition | `SubscribeSession(session, KindConnectivity)` |
| `KindSettingsChanged` | `SettingsChangedEvent` | `Subscribe(KindSettingsChanged)` — in-process only, never bridged to GraphQL |

## LatestStore

Latest value per `(sessionID, saveName, dataType)`. It serves two callers: the snapshot queries, and
a new GraphQL subscription's first forwarded payload so a fresh subscriber renders without waiting a
poll interval.

`SaveName` is part of the key and `Put` ignores events without one — that is what stops a save switch
from serving a previous save's state. `Clear(sessionID)` is called on session delete.

## Adding a domain

Nothing here changes. Publish a `SatisfactoryEvent` with the new `DataType` from the poller and
subscribe to it from a resolver; routing and buffering are already generic. Only a genuinely new
*shape* of event needs a new `EventKind` and payload type.
