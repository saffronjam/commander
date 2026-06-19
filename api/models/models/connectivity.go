package models

// ConnectivityStatus is the derived live connectivity + readiness for a session,
// supplied by the poller's in-memory state (not persisted).
type ConnectivityStatus struct {
	IsOnline       bool
	IsDisconnected bool
	Stage          SessionStage
}
