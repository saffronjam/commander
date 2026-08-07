package worker

import (
	"testing"

	"api/models/models"
	"api/pkg/eventbus"
	"api/service/session"
)

// A fresh publisher must read as connecting, not offline: the zero value of
// connState would otherwise render a red dot before FRM has been given a chance
// to answer.
func TestConnectivityDefaultsToConnecting(t *testing.T) {
	sm := NewSessionManager(nil, nil)

	got := sm.Connectivity("unknown-session")
	if got.State != models.ConnectionStateConnecting {
		t.Fatalf("want connecting for an unknown session, got %q", got.State)
	}
	if got.Reason != models.ConnectivityReasonNone {
		t.Fatalf("want no reason while connecting, got %q", got.Reason)
	}
}

func TestSetConnDerivesState(t *testing.T) {
	sm := NewSessionManager(nil, nil)

	sm.setConn("s1", true, false, models.ConnectivityReasonNoResponse)
	got := sm.Connectivity("s1")
	if got.State != models.ConnectionStateOnline {
		t.Fatalf("want online, got %q", got.State)
	}
	// Coming online must clear a stale reason, or the UI keeps a message for a
	// failure that no longer applies.
	if got.Reason != models.ConnectivityReasonNone {
		t.Fatalf("want the reason cleared when online, got %q", got.Reason)
	}

	sm.setConn("s1", false, false, models.ConnectivityReasonBadResponse)
	got = sm.Connectivity("s1")
	if got.State != models.ConnectionStateOffline {
		t.Fatalf("want offline, got %q", got.State)
	}
	if got.Reason != models.ConnectivityReasonBadResponse {
		t.Fatalf("want the reason preserved when offline, got %q", got.Reason)
	}
}

// seedPublisher registers a publisher without starting a poll loop. baseCtx is
// left nil so any restart a transition triggers is a no-op.
func seedPublisher(sm *SessionManager, sessionID, saveName string) *publisherState {
	state := &publisherState{
		cancel:          func() {},
		name:            "Test",
		address:         "127.0.0.1:8080",
		saveName:        saveName,
		gameTimeTracker: session.NewGameTimeTracker(),
	}
	sm.publishers[sessionID] = state
	return state
}

// newLatestStoreWithAllTypes returns a store already holding every required
// event type, which is what Stage reads to report READY.
func newLatestStoreWithAllTypes(sessionID string) *eventbus.LatestStore {
	latest := eventbus.NewLatestStore()
	for _, t := range models.RequiredEventTypes {
		latest.Put(eventbus.SatisfactoryEvent{SessionID: sessionID, DataType: string(t)})
	}
	return latest
}

// The api-status handler calls setConn every few seconds. If the mismatch were
// tracked outside setConn's derivation it would be clobbered back to online on
// every one of those ticks.
func TestSetConnKeepsMismatchWhileOnline(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")
	state.SetMismatchedSaveName("beta")

	sm.setConn("s1", true, false, models.ConnectivityReasonNone)

	got := sm.Connectivity("s1")
	if got.State != models.ConnectionStateSaveMismatch {
		t.Fatalf("want save mismatch to survive an online tick, got %q", got.State)
	}
	if got.MismatchedSaveName != "beta" {
		t.Fatalf("want the observed save reported, got %q", got.MismatchedSaveName)
	}
}

func TestSetConnOfflineOutranksMismatch(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")
	state.SetMismatchedSaveName("beta")

	sm.setConn("s1", false, false, models.ConnectivityReasonNoResponse)

	got := sm.Connectivity("s1")
	if got.State != models.ConnectionStateOffline {
		t.Fatalf("want offline to outrank a save mismatch, got %q", got.State)
	}
	if got.Reason != models.ConnectivityReasonNoResponse {
		t.Fatalf("want the transport reason preserved, got %q", got.Reason)
	}
	if got.MismatchedSaveName != "" {
		t.Fatalf("want no mismatched save while offline, got %q", got.MismatchedSaveName)
	}
}

// The tracker feeds the history retention cutoff, so a foreign save's play
// duration would prune the pinned save's history away.
func TestObserveSessionInfoIgnoresForeignSaveClock(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")

	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "beta", TotalPlayDuration: 999999})

	if got := state.gameTimeTracker.CurrentGameTime(); got != 0 {
		t.Fatalf("want the game clock untouched by a foreign save, got %d", got)
	}
	if mismatched, observed := state.SaveMismatch(); !mismatched || observed != "beta" {
		t.Fatalf("want the mismatch recorded, got mismatched=%v observed=%q", mismatched, observed)
	}
	if got := sm.Connectivity("s1").State; got != models.ConnectionStateSaveMismatch {
		t.Fatalf("want save mismatch state, got %q", got)
	}
}

func TestObserveSessionInfoRecoversOnPinnedSave(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")

	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "beta", TotalPlayDuration: 999999})
	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "alpha", TotalPlayDuration: 120})

	if mismatched, _ := state.SaveMismatch(); mismatched {
		t.Fatal("want the mismatch cleared once the pinned save is back")
	}
	if got := state.gameTimeTracker.CurrentGameTime(); got < 120 {
		t.Fatalf("want the game clock fed by the pinned save, got %d", got)
	}
	if got := sm.Connectivity("s1").State; got != models.ConnectionStateOnline {
		t.Fatalf("want online after recovery, got %q", got)
	}
}

// An edge-triggered compare would transition on every tick; the same reading
// twice must settle.
func TestObserveSessionInfoIsIdempotent(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	seedPublisher(sm, "s1", "alpha")
	info := &models.SessionInfo{SaveName: "beta", TotalPlayDuration: 10}

	sm.observeSessionInfo("s1", info)
	first := sm.publishers["s1"]
	sm.observeSessionInfo("s1", info)
	sm.observeSessionInfo("s1", info)

	if sm.publishers["s1"] != first {
		t.Fatal("want repeated identical readings to leave the publisher alone")
	}
	if got := sm.Connectivity("s1").State; got != models.ConnectionStateSaveMismatch {
		t.Fatalf("want the mismatch to persist, got %q", got)
	}
}

func TestSeriesSkipsMismatchedSessions(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	seedPublisher(sm, "s1", "alpha")
	mismatched := seedPublisher(sm, "s2", "gamma")
	mismatched.SetMismatchedSaveName("delta")

	for _, key := range sm.Series() {
		if string(key.SessionID) == "s2" {
			t.Fatalf("want a mismatched session excluded from retention, got %+v", key)
		}
	}
	if len(sm.Series()) != len(historyEnabledTypes) {
		t.Fatalf("want one key per history type for the healthy session, got %d", len(sm.Series()))
	}
}

// A mismatch must not rewind readiness: the pinned save's last-known values are
// deliberately kept so recovery re-renders instantly.
func TestStageUnaffectedByMismatch(t *testing.T) {
	sm := NewSessionManager(nil, newLatestStoreWithAllTypes("s1"))
	seedPublisher(sm, "s1", "alpha")

	if got := sm.Stage("s1"); got != models.SessionStageReady {
		t.Fatalf("want ready before the mismatch, got %q", got)
	}
	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "beta"})
	if got := sm.Stage("s1"); got != models.SessionStageReady {
		t.Fatalf("want readiness preserved across a mismatch, got %q", got)
	}
}

// A manager that was never started has no supervised lifetime to attach a
// replacement to, and failing to restart must not leave the session with no
// publisher at all.
func TestRestartPublisherLockedKeepsPublisherWithoutBaseContext(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	existing := seedPublisher(sm, "s1", "alpha")

	sm.restartPublisherLocked("s1", &models.Session{ID: "s1", SaveName: "alpha"})

	if got := sm.publishers["s1"]; got != existing {
		t.Fatalf("want the existing publisher left intact, got %+v", got)
	}
}
