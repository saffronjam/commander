package cmd

import (
	"encoding/json"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"

	authctx "api/internal/auth"
	"api/internal/graph"
	"api/internal/version"
	"api/pkg/config"
	"api/pkg/db"
	svcauth "api/service/auth"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gorilla/websocket"
)

// buildHandler constructs the stdlib HTTP handler: the gqlgen GraphQL endpoint
// (queries/mutations over POST/GET, subscriptions over websocket) behind the
// auth middleware, plus /healthz.
func (app *App) buildHandler(authSvc *svcauth.Service) http.Handler {
	resolver := &graph.Resolver{
		Store:    graph.NewStoreAdapter(db.DB.Store),
		Snapshot: app.poller,
		Poller:   app.poller,
		EventBus: app.bus,
		Auth:     authSvc,
		Config:   config.Config,
	}

	es := graph.NewExecutableSchema(graph.Config{
		Resolvers:  resolver,
		Directives: graph.DirectiveRoot{Auth: graph.AuthDirective},
	})

	srv := handler.New(es)
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Upgrader: websocket.Upgrader{
			CheckOrigin: originChecker(config.Config.ExternalURL),
		},
	})
	srv.Use(extension.Introspection{})
	srv.SetErrorPresenter(graph.ErrorPresenter)
	srv.SetRecoverFunc(graph.RecoverFunc)

	mux := http.NewServeMux()
	mux.Handle("/graphql", authMiddleware(authSvc)(srv))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/version", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"version": version.Version})
	})
	registerStatic(mux, config.Config.AssetsDir)
	return mux
}

// authMiddleware attaches the response writer, client IP, and — when the caller
// is authorized — the Caller to the request context. It does not reject; the
// @auth directive enforces.
//
// This is the only place that knows about auth modes: an open instance gets a
// Caller unconditionally, so every @auth field behaves uniformly and the
// directive stays a pure "is there a caller?" check. Websocket upgrades pass
// through here too, so subscriptions are covered by the same rule.
func authMiddleware(authSvc *svcauth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ctx = graph.WithResponseWriter(ctx, w)
			ctx = graph.WithClientIP(ctx, clientIP(r))

			if !authSvc.State().AuthRequired() {
				ctx = authctx.WithUser(ctx, authctx.Caller{Authenticated: true})
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			if c, err := r.Cookie(graph.AuthCookieName); err == nil && c.Value != "" {
				if td, verr := authSvc.ValidateToken(c.Value); verr == nil && td != nil {
					ctx = authctx.WithUser(ctx, authctx.Caller{Authenticated: true})
					ctx = graph.WithAccessToken(ctx, c.Value)
				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// clientIP resolves the caller's address to a bare IP.
//
// The port must not survive: the rate limiter buckets on this value, and
// RemoteAddr carries an ephemeral source port, so returning it would give every
// new connection a fresh bucket and no limit at all. X-Forwarded-For is a list on
// a multi-hop proxy, and only its first entry is the client.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		if ip := parseIP(first); ip != "" {
			return ip
		}
	}
	if ip := parseIP(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	return parseIP(r.RemoteAddr)
}

// parseIP normalizes one address, with or without a port, to a bare IP. It
// returns the empty string for anything that is not one.
func parseIP(address string) string {
	address = strings.TrimSpace(address)
	if address == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(address); err == nil {
		address = host
	}
	addr, err := netip.ParseAddr(strings.Trim(address, "[]"))
	if err != nil {
		return ""
	}
	return addr.Unmap().String()
}

// originChecker validates the websocket upgrade Origin against the configured
// same-origin external URL. An empty allowed origin accepts any (dev).
func originChecker(allowed string) func(*http.Request) bool {
	return func(r *http.Request) bool {
		if allowed == "" {
			return true
		}
		origin := r.Header.Get("Origin")
		return origin == "" || origin == allowed
	}
}
