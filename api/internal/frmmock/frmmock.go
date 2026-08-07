// Package frmmock serves Ficsit Remote Monitoring shaped JSON for a generated
// factory, so the dashboard can be developed and tested without a running game.
//
// The world is generated once and never mutated. Every response is a pure function
// of (world, tick), which makes the mock reproducible, restart-safe and free of
// locking on the read path. Responses are cached per tick, which is a cache rather
// than state: a miss recomputes identical bytes.
//
// This package imports frm_models and models but must never import frm_client, so
// that frm_client's own tests can use this package as a fixture without an import
// cycle.
package frmmock

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// Server answers FRM requests for one generated world.
type Server struct {
	cfg    Config
	world  *World
	static *staticPayloads
	clock  Clock
	epoch  time.Time

	cache atomic.Pointer[tickCache]
	mu    sync.Mutex
}

// tickCache holds the marshalled body per endpoint for one tick. Bodies are
// marshalled lazily because the largest payloads are polled rarely and would
// otherwise be re-encoded every tick for nothing.
type tickCache struct {
	tick     int64
	snapshot *Snapshot
	bodies   []atomic.Pointer[[]byte]
	once     []sync.Once
}

// NewServer generates the world and returns a server ready to answer requests.
func NewServer(cfg Config) (*Server, error) {
	cfg.applyDefaults()

	world, err := GenerateWorld(cfg)
	if err != nil {
		return nil, err
	}

	epoch := time.Now()
	if cfg.Epoch != EpochProcess {
		parsed, err := time.Parse(time.RFC3339, cfg.Epoch)
		if err != nil {
			return nil, fmt.Errorf("frmmock: parse epoch: %w", err)
		}
		epoch = parsed
	}

	return &Server{
		cfg:    cfg,
		world:  world,
		static: buildStatic(world),
		clock:  systemClock{},
		epoch:  epoch,
	}, nil
}

// WithClock replaces the server's clock, so a test can assert a snapshot at an
// exact tick without sleeping.
func (s *Server) WithClock(c Clock) *Server {
	s.clock = c
	return s
}

// World exposes the generated world for assertions. Callers must not mutate it.
func (s *Server) World() *World { return s.world }

// Config reports the configuration the world was generated from.
func (s *Server) Config() Config { return s.cfg }

// Handler returns an http.Handler serving a generated world. It panics if the
// config is invalid, so a broken fixture fails at the point of construction rather
// than as a confusing HTTP error later.
func Handler(cfg Config) http.Handler {
	srv, err := NewServer(cfg)
	if err != nil {
		panic(fmt.Sprintf("frmmock: %v", err))
	}
	return srv.Handler()
}

// Handler builds the mux for this server.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	for i, route := range served.routes() {
		mux.HandleFunc(route.path, s.serve(i, route))
	}
	for _, path := range stubbedPaths {
		mux.HandleFunc(path, func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "endpoint is not served: the dashboard's client stubs it out", http.StatusNotFound)
		})
	}
	return mux
}

func (s *Server) serve(index int, route endpoint) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "only GET is supported", http.StatusMethodNotAllowed)
			return
		}
		body, err := s.body(index, route)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", fmt.Sprint(len(body)))
		_, _ = w.Write(body)
	}
}

// tick quantises elapsed time. Every endpoint in one aggregating client call
// derives from the same tick, which is what stops a train being reported at a
// platform whose status says it is not there.
func (s *Server) tick() int64 {
	elapsed := s.clock.Now().Sub(s.epoch)
	if elapsed < 0 {
		return 0
	}
	return int64(elapsed / (time.Duration(s.cfg.TickMs) * time.Millisecond))
}

// body returns the marshalled response for one endpoint at the current tick.
func (s *Server) body(index int, route endpoint) ([]byte, error) {
	cache := s.cacheFor(s.tick())

	if cached := cache.bodies[index].Load(); cached != nil {
		return *cached, nil
	}

	var marshalErr error
	cache.once[index].Do(func() {
		encoded, err := json.Marshal(route.render(cache.snapshot))
		if err != nil {
			marshalErr = fmt.Errorf("frmmock: marshal %s: %w", route.path, err)
			return
		}
		cache.bodies[index].Store(&encoded)
	})
	if marshalErr != nil {
		return nil, marshalErr
	}

	if cached := cache.bodies[index].Load(); cached != nil {
		return *cached, nil
	}
	return nil, fmt.Errorf("frmmock: no body for %s", route.path)
}

// cacheFor returns the cache for a tick, building it once under the lock so
// concurrent requests in the same tick share one snapshot.
func (s *Server) cacheFor(tick int64) *tickCache {
	if current := s.cache.Load(); current != nil && current.tick == tick {
		return current
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if current := s.cache.Load(); current != nil && current.tick == tick {
		return current
	}

	count := len(served.routes())
	next := &tickCache{
		tick:     tick,
		snapshot: buildSnapshot(s.world, s.cfg, s.static, tick),
		bodies:   make([]atomic.Pointer[[]byte], count),
		once:     make([]sync.Once, count),
	}
	s.cache.Store(next)
	return next
}
