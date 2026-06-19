// Package eventbus is the in-process, Go-channel fan-out that replaces Redis
// pub/sub for live data. The single poller is the sole producer; the GraphQL
// subscription resolvers and the history recorder are the consumers. It carries
// typed Go values inside Event.Payload — never JSON, never GraphQL model types.
package eventbus

import "time"

// EventKind distinguishes the payload shape carried by an Event.
type EventKind string

const (
	// KindSatisfactory carries one live game-state value, routed by
	// (SessionID, SaveName, DataType).
	KindSatisfactory EventKind = "satisfactory"
	// KindConnectivity carries an online/offline transition for a session.
	KindConnectivity EventKind = "connectivity"
	// KindSettingsChanged signals an in-process settings change. It is never
	// bridged to a GraphQL subscription.
	KindSettingsChanged EventKind = "settings_changed"
)

// Event is the bus envelope. SessionID/SaveName/DataType are the routing keys;
// Payload is the typed Go value a consumer type-asserts.
type Event struct {
	Kind      EventKind
	SessionID string
	SaveName  string
	DataType  string
	Payload   any
}

// SatisfactoryEvent is the payload for KindSatisfactory: one decoded live value
// for a (session, save, dataType) at a given game time.
type SatisfactoryEvent struct {
	SessionID  string
	SaveName   string
	DataType   string
	Data       any
	GameTimeID int64
}

// ConnectivityEvent is the payload for KindConnectivity.
type ConnectivityEvent struct {
	SessionID string
	Online    bool
	At        time.Time
}

// SettingsChangedEvent is the payload for KindSettingsChanged.
type SettingsChangedEvent struct {
	Payload any
}

// Publisher publishes events onto the bus.
type Publisher interface {
	Publish(event Event)
}

// Subscriber registers filtered channels and tears them down.
type Subscriber interface {
	// Subscribe is the unfiltered firehose across the named kinds.
	Subscribe(kinds ...EventKind) <-chan Event
	// SubscribeSession pins one session across the named kinds.
	SubscribeSession(sessionID string, kinds ...EventKind) <-chan Event
	// SubscribeDomain pins one (session, save, dataType) on KindSatisfactory.
	SubscribeDomain(sessionID, saveName, dataType string) <-chan Event
	// Unsubscribe deregisters and closes a previously returned channel.
	Unsubscribe(ch <-chan Event)
}

// Bus is a publisher and subscriber.
type Bus interface {
	Publisher
	Subscriber
}
