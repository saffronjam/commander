package models

// ConnectivityReason explains why a session is unreachable, so the UI can say
// something more useful than "offline".
type ConnectivityReason string

const (
	// ConnectivityReasonNone is the reason while the session is reachable.
	ConnectivityReasonNone ConnectivityReason = "none"
	// ConnectivityReasonNoResponse means nothing answered: the request timed out
	// or the port refused the connection. FRM is most likely not running.
	ConnectivityReasonNoResponse ConnectivityReason = "noResponse"
	// ConnectivityReasonBadResponse means something answered but it was not FRM:
	// an HTTP error status, a TLS failure, or a body that does not parse. Usually
	// a reverse proxy, the wrong port, or an auth gate in front of the mod.
	ConnectivityReasonBadResponse ConnectivityReason = "badResponse"
)

// ConnectionState is the single authoritative connection state for a session,
// so the UI never has to derive one from a pair of booleans.
type ConnectionState string

const (
	// ConnectionStateConnecting means a poller is running but FRM has not
	// answered yet. This is the state at startup and after an address change.
	ConnectionStateConnecting ConnectionState = "connecting"
	// ConnectionStateOnline means FRM answered.
	ConnectionStateOnline ConnectionState = "online"
	// ConnectionStateOffline means FRM could not be reached; Reason says why.
	ConnectionStateOffline ConnectionState = "offline"
)

// ConnectivityStatus is the derived live connectivity + readiness for a session,
// supplied by the poller's in-memory state (not persisted).
type ConnectivityStatus struct {
	IsOnline       bool
	IsDisconnected bool
	State          ConnectionState
	Stage          SessionStage
	Reason         ConnectivityReason
}
