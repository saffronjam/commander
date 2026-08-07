package frmmock

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testServer(t *testing.T, preset string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(Handler(Preset(preset)))
	t.Cleanup(srv.Close)
	return srv
}

func get(t *testing.T, srv *httptest.Server, path string) ([]byte, int) {
	t.Helper()
	resp, err := srv.Client().Get(srv.URL + path)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return body, resp.StatusCode
}

// Every declared route must answer with decodable JSON, or an aggregating client
// call aborts its whole event and the session never becomes ready.
func TestEveryRouteAnswers(t *testing.T) {
	srv := testServer(t, "starter")

	for _, path := range Paths() {
		t.Run(path, func(t *testing.T) {
			body, status := get(t, srv, path)
			if status != http.StatusOK {
				t.Fatalf("want 200, got %d", status)
			}
			var decoded any
			if err := json.Unmarshal(body, &decoded); err != nil {
				t.Fatalf("body is not JSON: %v", err)
			}
		})
	}
}

// The client stubs these two out because upstream FRM is broken. Serving them would
// hide it if anyone re-enabled them without teaching the mock.
func TestStubbedEndpointsAre404(t *testing.T) {
	srv := testServer(t, "starter")

	for _, path := range stubbedPaths {
		if _, status := get(t, srv, path); status != http.StatusNotFound {
			t.Fatalf("%s: want 404, got %d", path, status)
		}
	}
}

func TestNonGetIsRejected(t *testing.T) {
	srv := testServer(t, "starter")

	resp, err := srv.Client().Post(srv.URL+"/getFactory", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", resp.StatusCode)
	}
}

// The same seed must produce the same world, or golden digests and reproducible
// demos are both impossible.
func TestWorldIsDeterministic(t *testing.T) {
	for _, preset := range PresetNames {
		t.Run(preset, func(t *testing.T) {
			a, err := GenerateWorld(Preset(preset))
			if err != nil {
				t.Fatal(err)
			}
			b, err := GenerateWorld(Preset(preset))
			if err != nil {
				t.Fatal(err)
			}

			ja, _ := json.Marshal(a)
			jb, _ := json.Marshal(b)
			if string(ja) != string(jb) {
				t.Fatal("same seed produced different worlds")
			}
		})
	}
}

func TestDifferentSeedsDiffer(t *testing.T) {
	cfg := Preset("growing")
	a, err := GenerateWorld(cfg)
	if err != nil {
		t.Fatal(err)
	}
	cfg.Seed = 99
	b, err := GenerateWorld(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ja, _ := json.Marshal(a)
	jb, _ := json.Marshal(b)
	if string(ja) == string(jb) {
		t.Fatal("different seeds produced identical worlds")
	}
}

// A conveyor or cable whose endpoints are not real buildings would draw a line to
// nowhere on the map. Generation resolves both ends from the machines themselves,
// and this pins that.
func TestReferentialIntegrity(t *testing.T) {
	w, err := GenerateWorld(Preset("industrial"))
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range append(append([]Conveyor{}, w.Belts...), w.Pipes...) {
		if c.FromMachine < 0 || c.FromMachine >= len(w.Machines) {
			t.Fatalf("conveyor %s starts at machine %d, which does not exist", c.ID, c.FromMachine)
		}
		if c.ToMachine < 0 || c.ToMachine >= len(w.Machines) {
			t.Fatalf("conveyor %s ends at machine %d, which does not exist", c.ID, c.ToMachine)
		}
		if c.From != w.Machines[c.FromMachine].Loc {
			t.Fatalf("conveyor %s does not start on its own machine", c.ID)
		}
		if c.To != w.Machines[c.ToMachine].Loc {
			t.Fatalf("conveyor %s does not end on its own machine", c.ID)
		}
	}

	for _, c := range w.Cables {
		if c.From != w.Machines[c.FromMachine].Loc || c.To != w.Machines[c.ToMachine].Loc {
			t.Fatalf("cable %s does not connect the machines it names", c.ID)
		}
	}

	circuits := map[int]bool{}
	for _, c := range w.Circuits {
		circuits[c.ID] = true
	}
	for i, m := range w.Machines {
		if !circuits[m.CircuitID] {
			t.Fatalf("machine %d is on circuit %d, which does not exist", i, m.CircuitID)
		}
		if m.Node >= 0 && !w.Nodes[m.Node].Exploited {
			t.Fatalf("machine %d mines node %d, which is not marked exploited", i, m.Node)
		}
	}
}

// Every circuit needs a generator: the client drops circuits reporting no
// production, so a generator-less circuit would vanish from the power view while
// its machines still claimed to be on it.
func TestEveryCircuitHasProduction(t *testing.T) {
	for _, preset := range PresetNames {
		t.Run(preset, func(t *testing.T) {
			srv := testServer(t, preset)
			body, _ := get(t, srv, "/getPower")

			var circuits []struct {
				CircuitID       string  `json:"CircuitID"`
				PowerProduction float64 `json:"PowerProduction"`
			}
			if err := json.Unmarshal(body, &circuits); err != nil {
				t.Fatal(err)
			}
			if len(circuits) == 0 {
				t.Fatal("want at least one circuit")
			}
			for _, c := range circuits {
				if c.PowerProduction <= 0 {
					t.Fatalf("circuit %s reports no production and would be dropped", c.CircuitID)
				}
			}
		})
	}
}

// Anything outside the world bounds renders off the map tiles.
func TestEverythingIsInsideMapBounds(t *testing.T) {
	w, err := GenerateWorld(Preset("megabase"))
	if err != nil {
		t.Fatal(err)
	}

	check := func(what string, p Point) {
		if p.X < WorldMinX || p.X > WorldMaxX || p.Y < WorldMinY || p.Y > WorldMaxY {
			t.Fatalf("%s at (%.0f, %.0f) is outside the world bounds", what, p.X, p.Y)
		}
	}
	for _, m := range w.Machines {
		check("machine", m.Loc)
	}
	for _, n := range w.Nodes {
		check("node", n.Loc)
	}
	for _, s := range w.Sites {
		check("site", s.Center)
	}
	for _, p := range w.Players {
		check("player", p.Loc)
	}
}

// The dashboard keys map selection on an entity's coordinates, so a static payload
// that re-marshals differently would break selection every poll.
func TestStaticEndpointsAreByteStable(t *testing.T) {
	srv, err := NewServer(Preset("growing"))
	if err != nil {
		t.Fatal(err)
	}
	clock := &FixedClock{At: srv.epoch}
	srv.WithClock(clock)
	handler := srv.Handler()

	staticPaths := []string{"/getBelts", "/getCables", "/getPipes", "/getResourceNode", "/getSplitterMerger"}
	first := map[string]string{}
	for _, path := range staticPaths {
		first[path] = record(t, handler, path)
	}

	clock.Advance(100000 * time.Second)
	for _, path := range staticPaths {
		if got := record(t, handler, path); got != first[path] {
			t.Fatalf("%s changed between ticks, so coordinate-derived identity keys would drift", path)
		}
	}
}

// Two requests inside one tick must agree, or the several endpoints behind one
// client event can disagree with each other.
func TestTickQuantisation(t *testing.T) {
	srv, err := NewServer(Preset("starter"))
	if err != nil {
		t.Fatal(err)
	}
	clock := &FixedClock{At: srv.epoch}
	srv.WithClock(clock)
	handler := srv.Handler()

	within := record(t, handler, "/getFactory")
	clock.Advance(100 * time.Millisecond)
	if got := record(t, handler, "/getFactory"); got != within {
		t.Fatal("a dynamic endpoint changed inside one tick")
	}

	clock.Advance(5 * time.Second)
	if got := record(t, handler, "/getFactory"); got == within {
		t.Fatal("a dynamic endpoint did not change across ticks")
	}
}

func record(t *testing.T, handler http.Handler, path string) string {
	t.Helper()
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: want 200, got %d", path, rec.Code)
	}
	return rec.Body.String()
}

// The save name is what pins a session to a save; if it wobbled the dashboard would
// treat the server as having loaded a different game and stop ingesting.
func TestSaveNameIsStable(t *testing.T) {
	srv, err := NewServer(Preset("starter"))
	if err != nil {
		t.Fatal(err)
	}
	clock := &FixedClock{At: srv.epoch}
	srv.WithClock(clock)
	handler := srv.Handler()

	read := func() string {
		var info struct {
			SessionName string `json:"SessionName"`
		}
		if err := json.Unmarshal([]byte(record(t, handler, "/getSessionInfo")), &info); err != nil {
			t.Fatal(err)
		}
		return info.SessionName
	}

	want := read()
	if want == "" {
		t.Fatal("want a save name: an empty one makes the session uncreatable")
	}
	for range 5 {
		clock.Advance(37 * time.Second)
		if got := read(); got != want {
			t.Fatalf("save name changed from %q to %q", want, got)
		}
	}
}

func TestValidateReportsEveryProblem(t *testing.T) {
	cfg := Config{Preset: "nope", Phase: 9, TickMs: 5, SaveName: "", Epoch: "yesterday"}
	err := cfg.Validate()
	if err == nil {
		t.Fatal("want an error")
	}
	for _, want := range []string{"saveName", "preset", "phase", "tickMs", "epoch"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("want the error to mention %q, got: %v", want, err)
		}
	}
}

// The phase caps the tier, which is what decides whether trains, drones and nuclear
// power may exist at all.
func TestPhaseCapsTier(t *testing.T) {
	for _, tc := range []struct {
		phase int
		tier  int
	}{{1, 2}, {2, 4}, {3, 6}, {4, 8}, {5, 9}} {
		w, err := GenerateWorld(func() Config {
			cfg := Preset("growing")
			cfg.Phase = tc.phase
			return cfg
		}())
		if err != nil {
			t.Fatal(err)
		}
		if w.MaxTier != tc.tier {
			t.Fatalf("phase %d: want tier %d, got %d", tc.phase, tc.tier, w.MaxTier)
		}
	}
}

// A phase 1 world must not contain buildings its tier has not unlocked.
func TestPhaseGatesContent(t *testing.T) {
	cfg := Preset("starter")
	cfg.Phase = 1
	w, err := GenerateWorld(cfg)
	if err != nil {
		t.Fatal(err)
	}

	for i := range w.Machines {
		spec := w.machineSpec(i)
		if tier := unlockTier[spec.Cap]; tier > w.MaxTier {
			t.Fatalf("%s requires tier %d but the world is capped at %d", spec.Name, tier, w.MaxTier)
		}
	}
}

func TestCouponCostMatchesTheGame(t *testing.T) {
	for _, tc := range []struct {
		n    int
		want float64
	}{{1, 1000}, {2, 1000}, {3, 1000}, {4, 1500}, {6, 1500}, {7, 3000}, {9, 3000}} {
		if got := couponCost(tc.n); got != tc.want {
			t.Fatalf("coupon %d: want %g, got %g", tc.n, tc.want, got)
		}
	}
}
