package eventbus

import "sync"

type stateKey struct {
	sessionID string
	saveName  string
	dataType  string
}

// LatestStore is the in-memory latest-value-per-(session, save, dataType) cache
// that replaces the Redis state: cache. It backs both the per-domain snapshot
// queries and a new subscription's first forwarded payload. SaveName is part of
// the key so a save switch never returns a stale save's state.
type LatestStore struct {
	mu     sync.RWMutex
	latest map[stateKey]SatisfactoryEvent
}

// NewLatestStore returns an empty store.
func NewLatestStore() *LatestStore {
	return &LatestStore{latest: make(map[stateKey]SatisfactoryEvent)}
}

// Put records the latest value for its (session, save, dataType). Events without
// a save name are ignored (save name is a mandatory key segment).
func (s *LatestStore) Put(e SatisfactoryEvent) {
	if e.SaveName == "" {
		return
	}
	s.mu.Lock()
	s.latest[stateKey{e.SessionID, e.SaveName, e.DataType}] = e
	s.mu.Unlock()
}

// Get returns the latest value for one series.
func (s *LatestStore) Get(sessionID, saveName, dataType string) (SatisfactoryEvent, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.latest[stateKey{sessionID, saveName, dataType}]
	return e, ok
}

// Snapshot returns every latest value for one (session, save).
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

// Clear drops every value for a session (called on session delete).
func (s *LatestStore) Clear(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for k := range s.latest {
		if k.sessionID == sessionID {
			delete(s.latest, k)
		}
	}
}
