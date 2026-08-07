package eventbus

import "sync"

type stateKey struct {
	sessionID string
	dataType  string
}

// LatestStore is the in-memory latest-value-per-(session, dataType) cache. It
// backs both the per-domain snapshot queries and a new subscription's first
// forwarded payload, so a fresh subscriber renders without waiting a poll
// interval.
type LatestStore struct {
	mu     sync.RWMutex
	latest map[stateKey]SatisfactoryEvent
}

// NewLatestStore returns an empty store.
func NewLatestStore() *LatestStore {
	return &LatestStore{latest: make(map[stateKey]SatisfactoryEvent)}
}

// Put records the latest value for its (session, dataType).
func (s *LatestStore) Put(e SatisfactoryEvent) {
	s.mu.Lock()
	s.latest[stateKey{e.SessionID, e.DataType}] = e
	s.mu.Unlock()
}

// Get returns the latest value for one series.
func (s *LatestStore) Get(sessionID, dataType string) (SatisfactoryEvent, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.latest[stateKey{sessionID, dataType}]
	return e, ok
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
