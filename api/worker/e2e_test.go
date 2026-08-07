package worker

import (
	"context"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"api/internal/frmmock"
	sessionid "api/internal/session"
	"api/internal/store"
	"api/models/models"
	"api/pkg/config"
	"api/pkg/db"
	"api/pkg/eventbus"
)

const testSaveName = "E2ESave"

// startMock serves a generated world and returns its host:port.
func startMock(t *testing.T, cfg frmmock.Config) string {
	t.Helper()
	srv := httptest.NewServer(frmmock.Handler(cfg))
	t.Cleanup(srv.Close)
	return strings.TrimPrefix(srv.URL, "http://")
}

// startManager points a real SessionManager at an address through the real client,
// the real request queue and the real converters. Nothing here is faked except the
// game itself.
func startManager(t *testing.T, address, saveName string) (*SessionManager, sessionid.ID) {
	t.Helper()

	config.Config = &config.Type{
		DBPath:                filepath.Join(t.TempDir(), "e2e.db"),
		MaxSampleGameDuration: 0,
	}
	if err := db.Setup(); err != nil {
		t.Fatalf("set up database: %v", err)
	}
	t.Cleanup(db.Shutdown)

	id := sessionid.ID("e2e-session")
	if err := db.DB.Store.CreateSession(context.Background(), id, "E2E", address, saveName); err != nil {
		t.Fatalf("create session: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	sm := NewSessionManager(eventbus.NewChannelBus(), eventbus.NewLatestStore())
	sm.Start(ctx)
	t.Cleanup(func() { sm.Stop(2 * time.Second) })

	return sm, id
}

// waitFor polls a condition until it holds or the deadline passes, so the test does
// not depend on a sleep long enough to be slow but short enough to be flaky.
func waitFor(t *testing.T, what string, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("timed out after %s waiting for %s", timeout, what)
}

// This is the assertion the repo has never had: that every required event type
// lands through the real HTTP path and the session actually becomes usable.
func TestSessionReachesReadyAgainstMock(t *testing.T) {
	cfg := frmmock.Preset("starter")
	cfg.SaveName = testSaveName
	sm, id := startManager(t, startMock(t, cfg), testSaveName)

	waitFor(t, "the session to report ready", 15*time.Second, func() bool {
		return sm.Stage(id) == models.SessionStageReady
	})

	conn := sm.Connectivity(id)
	if conn.State != models.ConnectionStateOnline {
		t.Fatalf("want online, got %q (reason %q)", conn.State, conn.Reason)
	}
	if conn.Reason != models.ConnectivityReasonNone {
		t.Fatalf("want no failure reason, got %q", conn.Reason)
	}
	if conn.MismatchedSaveName != "" {
		t.Fatalf("want no save mismatch, got %q", conn.MismatchedSaveName)
	}
}

// Every required event type must be individually present, so a failure names the
// domain that did not arrive instead of just reporting "not ready".
func TestEveryRequiredEventArrives(t *testing.T) {
	cfg := frmmock.Preset("starter")
	cfg.SaveName = testSaveName
	sm, id := startManager(t, startMock(t, cfg), testSaveName)

	waitFor(t, "the session to report ready", 15*time.Second, func() bool {
		return sm.Stage(id) == models.SessionStageReady
	})

	for _, eventType := range models.RequiredEventTypes {
		if _, ok := sm.Latest(id, string(eventType)); !ok {
			t.Errorf("required event %q never arrived", eventType)
		}
	}
}

// History is only written once the game clock is known, and the clock comes from a
// ten-second loop. Seeding the tracker directly is faster and more honest than
// sleeping through it.
func TestHistoryIsRecordedAgainstMock(t *testing.T) {
	cfg := frmmock.Preset("starter")
	cfg.SaveName = testSaveName
	sm, id := startManager(t, startMock(t, cfg), testSaveName)

	waitFor(t, "the session to report ready", 15*time.Second, func() bool {
		return sm.Stage(id) == models.SessionStageReady
	})

	sm.observeSessionInfo(string(id), &models.SessionInfo{
		SaveName:          testSaveName,
		TotalPlayDuration: 3600,
	})

	for eventType := range historyEnabledTypes {
		t.Run(string(eventType), func(t *testing.T) {
			waitFor(t, "a history point", 15*time.Second, func() bool {
				points, err := db.DB.Store.QueryHistory(context.Background(), store.HistoryQuery{
					SessionID: id,
					DataType:  string(eventType),
					Since:     -1,
				})
				return err == nil && len(points) > 0
			})
		})
	}
}

// A session pinned to one save must stop ingesting when the server reports another,
// and recover on its own when the pinned save comes back. Neither path had coverage.
func TestSaveMismatchIsDetectedAndRecovers(t *testing.T) {
	cfg := frmmock.Preset("starter")
	cfg.SaveName = "SomeOtherSave"
	sm, id := startManager(t, startMock(t, cfg), testSaveName)

	waitFor(t, "the mismatch to be detected", 20*time.Second, func() bool {
		return sm.Connectivity(id).State == models.ConnectionStateSaveMismatch
	})

	conn := sm.Connectivity(id)
	if conn.MismatchedSaveName != "SomeOtherSave" {
		t.Fatalf("want the observed save reported, got %q", conn.MismatchedSaveName)
	}

	sm.observeSessionInfo(string(id), &models.SessionInfo{
		SaveName:          testSaveName,
		TotalPlayDuration: 3600,
	})
	if got := sm.Connectivity(id).State; got == models.ConnectionStateSaveMismatch {
		t.Fatal("want the mismatch cleared once the pinned save is reported")
	}
}

// A session pointed at nothing must settle on offline rather than staying stuck in
// connecting.
func TestUnreachableServerReportsOffline(t *testing.T) {
	// Port 1 on the loopback is never listening.
	sm, id := startManager(t, "127.0.0.1:1", testSaveName)

	waitFor(t, "the session to report offline", 20*time.Second, func() bool {
		return sm.Connectivity(id).State == models.ConnectionStateOffline
	})

	if got := sm.Stage(id); got != models.SessionStageInit {
		t.Fatalf("want an unreachable session to stay at init, got %q", got)
	}
}
