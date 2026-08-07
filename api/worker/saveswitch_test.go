package worker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"api/internal/frmmock"
	sessionid "api/internal/session"
	"api/internal/store"
	"api/models/models"
	"api/pkg/db"
)

// switchableServer reproduces what loading a different save actually does: FRM's
// server is an actor on the world, so a save switch tears it down and brings it
// back up reporting a different save name.
type switchableServer struct {
	inner    http.Handler
	saveName atomic.Pointer[string]
	down     atomic.Bool
}

func (s *switchableServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if s.down.Load() {
		http.Error(w, "the world is being torn down", http.StatusServiceUnavailable)
		return
	}
	if r.URL.Path != "/getSessionInfo" {
		s.inner.ServeHTTP(w, r)
		return
	}

	rec := httptest.NewRecorder()
	s.inner.ServeHTTP(rec, r)

	var info map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	info["SessionName"] = *s.saveName.Load()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(info)
}

func (s *switchableServer) loadSave(name string) {
	s.saveName.Store(&name)
}

// countHistory reports how many history rows exist for a session across every
// persisted type.
func countHistory(t *testing.T, id sessionid.ID) int {
	t.Helper()
	total := 0
	for eventType := range historyEnabledTypes {
		points, err := db.DB.Store.QueryHistory(context.Background(), store.HistoryQuery{
			SessionID: id,
			DataType:  string(eventType),
			Since:     -1,
		})
		if err != nil {
			t.Fatalf("query history: %v", err)
		}
		total += len(points)
	}
	return total
}

// A save can only change by the server restarting, so re-confirming the save after
// any outage is enough to guarantee no sample from another save is ever written
// into a session. This is the regression test for exactly that.
func TestNoForeignSaveDataIsIngested(t *testing.T) {
	cfg := frmmock.Preset("starter")
	cfg.SaveName = testSaveName

	switchable := &switchableServer{inner: frmmock.Handler(cfg)}
	switchable.loadSave(testSaveName)

	srv := httptest.NewServer(switchable)
	t.Cleanup(srv.Close)

	sm, id := startManager(t, strings.TrimPrefix(srv.URL, "http://"), testSaveName)

	waitFor(t, "the session to report ready", 15*time.Second, func() bool {
		return sm.Stage(id) == models.SessionStageReady
	})
	sm.observeSessionInfo(string(id), &models.SessionInfo{
		SaveName:          testSaveName,
		TotalPlayDuration: 3600,
	})
	waitFor(t, "history to start recording", 15*time.Second, func() bool {
		return countHistory(t, id) > 0
	})

	// The world is torn down, which is what stops the server.
	switchable.down.Store(true)
	time.Sleep(500 * time.Millisecond)
	before := countHistory(t, id)

	// The new world comes up running a different save.
	switchable.loadSave("SomeOtherSave")
	switchable.down.Store(false)

	waitFor(t, "the mismatch to be detected", 15*time.Second, func() bool {
		return sm.Connectivity(id).State == models.ConnectionStateSaveMismatch
	})

	// Nothing legitimate could have been recorded between the teardown and the
	// mismatch, so any growth here is another save's data.
	if after := countHistory(t, id); after != before {
		t.Fatalf("ingested %d rows of the other save's data: %d before the switch, %d after", after-before, before, after)
	}
}

// A publisher must not ingest before the server has said which save it is running,
// even though it starts against a session whose save was pinned at creation.
func TestIngestionRequiresAConfirmedSave(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")

	if state.SaveConfirmed() {
		t.Fatal("want a fresh publisher to start unconfirmed")
	}

	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "alpha", TotalPlayDuration: 10})
	if !state.SaveConfirmed() {
		t.Fatal("want the save confirmed once the server reports the pinned save")
	}

	sm.invalidateSave("s1")
	if state.SaveConfirmed() {
		t.Fatal("want an outage to suspend ingestion until the save is re-confirmed")
	}
}

// A mismatch must also leave the save unconfirmed, so ingestion stays suspended
// even if something re-enables the publisher.
func TestMismatchLeavesSaveUnconfirmed(t *testing.T) {
	sm := NewSessionManager(nil, nil)
	state := seedPublisher(sm, "s1", "alpha")

	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "alpha", TotalPlayDuration: 10})
	sm.observeSessionInfo("s1", &models.SessionInfo{SaveName: "beta", TotalPlayDuration: 10})

	if state.SaveConfirmed() {
		t.Fatal("want a mismatched session to be unconfirmed")
	}
}
