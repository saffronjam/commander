package frm_client

import (
	"context"
	"errors"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"api/internal/frmmock"
	"api/models/models"
)

// A spoofed forwarded header must not be able to aim the sweep at the internet.
func TestDiscoverTargetsRefusesPublicAddresses(t *testing.T) {
	targets, err := DiscoverTargets("8.8.8.8", nil)
	if err == nil {
		// A machine running the tests may itself be on a private network, in which
		// case its own interfaces are legitimately scannable. What must never
		// appear is the public address that was asked for.
		for _, target := range targets {
			if strings.HasPrefix(target, "8.8.8.") {
				t.Fatalf("a public address was included: %s", target)
			}
		}
		return
	}
	if !errors.Is(err, ErrNoPrivateNetwork) {
		t.Fatalf("want ErrNoPrivateNetwork, got %v", err)
	}
}

func TestDiscoverTargetsSweepsTheClientSubnet(t *testing.T) {
	targets, err := DiscoverTargets("192.168.77.42", nil)
	if err != nil {
		t.Fatal(err)
	}

	if !slices.Contains(targets, "192.168.77.1:8080") {
		t.Fatal("want the first host in the client's subnet")
	}
	if !slices.Contains(targets, "192.168.77.254:8080") {
		t.Fatal("want the last host in the client's subnet")
	}
	if slices.Contains(targets, "192.168.77.0:8080") || slices.Contains(targets, "192.168.77.255:8080") {
		t.Fatal("the network and broadcast addresses must be skipped")
	}
	if !slices.Contains(targets, "192.168.77.42:8080") {
		t.Fatal("the caller's own machine must be included: the game may run on it")
	}
}

func TestDiscoverTargetsIncludesPortsAlreadyInUse(t *testing.T) {
	targets, err := DiscoverTargets("192.168.77.42", []int{7777, 8080})
	if err != nil {
		t.Fatal(err)
	}

	if !slices.Contains(targets, "192.168.77.10:7777") {
		t.Fatal("want a port taken from an existing session")
	}
	if !slices.Contains(targets, "192.168.77.10:8080") {
		t.Fatal("want the default port")
	}

	// 8080 was passed as an extra as well and must not be swept twice.
	count := 0
	for _, target := range targets {
		if target == "192.168.77.10:8080" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("want the default port swept once, got %d", count)
	}
}

func TestDiscoverTargetsRejectsAnOversizedSweep(t *testing.T) {
	// Enough distinct ports to push one subnet past the cap.
	ports := make([]int, 0, 8)
	for p := 9000; p < 9008; p++ {
		ports = append(ports, p)
	}

	if _, err := DiscoverTargets("192.168.77.42", ports); !errors.Is(err, ErrScanTooLarge) {
		t.Fatalf("want ErrScanTooLarge, got %v", err)
	}
}

func TestNormalizeAddress(t *testing.T) {
	for _, tt := range []struct{ in, want string }{
		{"192.168.1.100:8080", "192.168.1.100:8080"},
		{"http://192.168.1.100:8080", "192.168.1.100:8080"},
		{"https://192.168.1.100:8080/", "192.168.1.100:8080"},
		{"  HTTP://192.168.1.100:8080  ", "192.168.1.100:8080"},
	} {
		if got := NormalizeAddress(tt.in); got != tt.want {
			t.Fatalf("NormalizeAddress(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

// The sweep is handed explicit targets so it can be exercised against loopback,
// which the safety guards in DiscoverTargets would otherwise exclude.
func TestScanForServersFindsRunningServers(t *testing.T) {
	first := startNamedMock(t, "AlphaSave")
	second := startNamedMock(t, "BetaSave")
	dead := "127.0.0.1:1"

	found := ScanForServers(context.Background(), []string{first, dead, second})

	if len(found) != 2 {
		t.Fatalf("want both servers found and the dead port skipped, got %d: %+v", len(found), found)
	}

	names := []string{found[0].Info.SaveName, found[1].Info.SaveName}
	slices.Sort(names)
	if names[0] != "AlphaSave" || names[1] != "BetaSave" {
		t.Fatalf("want both save names reported, got %v", names)
	}
	if !slices.IsSortedFunc(found, func(a, b models.DiscoveredServer) int { return strings.Compare(a.Address, b.Address) }) {
		t.Fatal("want results ordered by address so the UI is stable between scans")
	}
}

func TestScanForServersStopsWhenCancelled(t *testing.T) {
	srv := startNamedMock(t, "AlphaSave")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan []models.DiscoveredServer, 1)
	go func() { done <- ScanForServers(ctx, []string{srv}) }()

	select {
	case found := <-done:
		if len(found) != 0 {
			t.Fatalf("want nothing found after cancellation, got %+v", found)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("a cancelled sweep must return promptly")
	}
}

func startNamedMock(t *testing.T, saveName string) string {
	t.Helper()
	cfg := frmmock.Preset("starter")
	cfg.SaveName = saveName
	srv := httptest.NewServer(frmmock.Handler(cfg))
	t.Cleanup(srv.Close)
	return strings.TrimPrefix(srv.URL, "http://")
}
