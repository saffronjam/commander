package frm_client

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"api/internal/frmmock"
)

// htmlServer answers every path with a 200 and an HTML body, the way a reverse
// proxy, a router's captive page or a SPA fallback does.
func htmlServer(t *testing.T) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<!DOCTYPE html><html><body>not FRM</body></html>"))
	}))
	t.Cleanup(srv.Close)
	return NewClientWithAddress(strings.TrimPrefix(srv.URL, "http://"))
}

// Answering 200 to everything is what a proxy does. Treating that as "up" reported
// a session Online that could never produce a single usable response.
func TestApiStatusRejectsAServerThatIsNotFRM(t *testing.T) {
	client := htmlServer(t)

	status, err := client.GetSatisfactoryApiStatus(context.Background())
	if err == nil {
		t.Fatalf("want an error for a non-FRM server, got status %+v", status)
	}
	if status != nil {
		t.Fatalf("want no status for a non-FRM server, got %+v", status)
	}
}

func TestApiStatusAcceptsARealServer(t *testing.T) {
	srv := httptest.NewServer(frmmock.Handler(frmmock.Preset("starter")))
	t.Cleanup(srv.Close)
	client := NewClientWithAddress(strings.TrimPrefix(srv.URL, "http://"))

	status, err := client.GetSatisfactoryApiStatus(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Running {
		t.Fatal("want a real FRM server reported as running")
	}
}

// A body that cannot be decoded has to count as a failure. While it did not, the
// counter sat at zero forever: the session never reached the threshold, never
// dropped to light polling, and every endpoint kept polling at full rate.
func TestBadResponsesReachTheDisconnectThreshold(t *testing.T) {
	client := htmlServer(t)

	for i := 0; i < failureThreshold; i++ {
		if client.IsDisconnected() {
			t.Fatalf("disconnected after only %d failures, want %d", i, failureThreshold)
		}
		var out map[string]any
		if err := client.makeSatisfactoryCall(context.Background(), "/getPower", &out); err == nil {
			t.Fatal("want an error decoding an HTML body")
		}
	}

	if !client.IsDisconnected() {
		t.Fatalf("want disconnected after %d bad responses", failureThreshold)
	}
}

// A server that is listening but answering with an error code must age out the
// same way, otherwise it also polls forever.
func TestErrorStatusCodesReachTheDisconnectThreshold(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(srv.Close)
	client := NewClientWithAddress(strings.TrimPrefix(srv.URL, "http://"))

	for i := 0; i < failureThreshold; i++ {
		var out map[string]any
		_ = client.makeSatisfactoryCall(context.Background(), "/getPower", &out)
	}

	if !client.IsDisconnected() {
		t.Fatalf("want disconnected after %d error responses", failureThreshold)
	}
}
