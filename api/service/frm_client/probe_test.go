package frm_client

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"api/models/models"
)

func probeReason(t *testing.T, err error) models.ConnectivityReason {
	t.Helper()
	if err == nil {
		t.Fatal("want a probe error, got nil")
	}
	var probeErr *ProbeError
	if !errors.As(err, &probeErr) {
		t.Fatalf("want a *ProbeError so the client can render a reason, got %T", err)
	}
	return probeErr.Reason
}

// Nothing listening reads as "FRM is not running", which is what the form tells
// the operator to check.
func TestProbeSessionInfoNoResponse(t *testing.T) {
	// Port 0 on the loopback is never listening.
	_, err := ProbeSessionInfo(context.Background(), "127.0.0.1:1")
	if got := probeReason(t, err); got != models.ConnectivityReasonNoResponse {
		t.Fatalf("want noResponse for a refused connection, got %q", got)
	}
}

// Something answered, so the address is reachable and the problem is what is
// sitting on it.
func TestProbeSessionInfoBadStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	_, err := ProbeSessionInfo(context.Background(), strings.TrimPrefix(srv.URL, "http://"))
	if got := probeReason(t, err); got != models.ConnectivityReasonBadResponse {
		t.Fatalf("want badResponse for a non-200 answer, got %q", got)
	}
}

func TestProbeSessionInfoUnparseableBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("<html>not FRM</html>"))
	}))
	defer srv.Close()

	_, err := ProbeSessionInfo(context.Background(), strings.TrimPrefix(srv.URL, "http://"))
	if got := probeReason(t, err); got != models.ConnectivityReasonBadResponse {
		t.Fatalf("want badResponse for a body that is not FRM, got %q", got)
	}
}

// A save name is the whole point of the probe, so an FRM that reports none is
// not usable even though it answered correctly.
func TestProbeSessionInfoMissingSaveName(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"SessionName":"","TotalPlayDuration":10}`))
	}))
	defer srv.Close()

	_, err := ProbeSessionInfo(context.Background(), strings.TrimPrefix(srv.URL, "http://"))
	if got := probeReason(t, err); got != models.ConnectivityReasonBadResponse {
		t.Fatalf("want badResponse when no save name is reported, got %q", got)
	}
}

func TestProbeSessionInfoSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/getSessionInfo" {
			t.Errorf("want the probe to hit /getSessionInfo, got %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"SessionName":"EttPunktNoll","TotalPlayDuration":3600,"PassedDays":4}`))
	}))
	defer srv.Close()

	info, err := ProbeSessionInfo(context.Background(), strings.TrimPrefix(srv.URL, "http://"))
	if err != nil {
		t.Fatalf("want a successful probe, got %v", err)
	}
	if info.SaveName != "EttPunktNoll" {
		t.Fatalf("want the save name carried through, got %q", info.SaveName)
	}
	if info.TotalPlayDuration != 3600 || info.PassedDays != 4 {
		t.Fatalf("want the rest of the payload mapped, got %+v", info)
	}
}
