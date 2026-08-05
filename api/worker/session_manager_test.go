package worker

import (
	"testing"

	"api/models/models"
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
