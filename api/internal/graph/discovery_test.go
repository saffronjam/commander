package graph

import (
	"testing"

	"api/models/models"
)

// Addresses are stored exactly as they were typed, so a session recorded as
// "http://host:port/" covers the same server a sweep reports as "host:port".
// A raw string compare would offer it again as if it were new.
func TestMarkDiscoveredMatchesDifferentSpellings(t *testing.T) {
	existing, ports := discoveryInputs([]models.Session{
		{Address: "http://192.168.1.100:8080/"},
		{Address: "192.168.1.101:7777"},
	})

	found := markDiscovered([]models.DiscoveredServer{
		{Address: "192.168.1.100:8080"},
		{Address: "192.168.1.101:7777"},
		{Address: "192.168.1.102:8080"},
	}, existing)

	if len(found) != 3 {
		t.Fatalf("want every discovered server reported, got %d", len(found))
	}
	if !found[0].AlreadyAdded {
		t.Fatal("a session stored with a scheme and trailing slash must still count as added")
	}
	if !found[1].AlreadyAdded {
		t.Fatal("an exactly-matching session must count as added")
	}
	if found[2].AlreadyAdded {
		t.Fatal("an unknown server must be offered")
	}

	// The non-default port in use is worth sweeping; the default is added by the
	// scanner itself.
	if len(ports) != 2 || ports[0] != 8080 || ports[1] != 7777 {
		t.Fatalf("want the ports already in use, got %v", ports)
	}
}
