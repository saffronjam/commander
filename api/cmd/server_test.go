package cmd

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	migsqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	authctx "api/internal/auth"
	"api/internal/graph"
	"api/internal/store"
	"api/pkg/config"
	svcauth "api/service/auth"
)

const testPragmas = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"

func newTestAuthService(t *testing.T) (*svcauth.Service, string) {
	t.Helper()

	dir := t.TempDir()
	db, err := sql.Open("sqlite", filepath.Join(dir, "test.db")+testPragmas)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })

	src, err := iofs.New(store.Migrations, "migrations")
	if err != nil {
		t.Fatalf("iofs: %v", err)
	}
	drv, err := migsqlite.WithInstance(db, &migsqlite.Config{})
	if err != nil {
		t.Fatalf("driver: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("migrator: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}

	config.Config = &config.Type{DataDir: dir}
	svc := svcauth.NewServiceWithStore(store.New(db))
	if err := svc.EnsureInstance(); err != nil {
		t.Fatalf("ensure instance: %v", err)
	}
	return svc, dir
}

func readToken(t *testing.T, dir string) string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, "bootstrap.token"))
	if err != nil {
		t.Fatalf("read setup token: %v", err)
	}
	return strings.TrimSpace(string(raw))
}

// callerFor runs a request through authMiddleware and reports whether a Caller
// reached the handler.
func callerFor(t *testing.T, svc *svcauth.Service, cookie *http.Cookie) bool {
	t.Helper()

	var authorized bool
	handler := authMiddleware(svc)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		caller, ok := authctx.UserFromContext(r.Context())
		authorized = ok && caller.Authenticated
	}))

	req := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	handler.ServeHTTP(httptest.NewRecorder(), req)
	return authorized
}

// On an open instance every request is authorized, which is what lets the ~30
// @auth fields stay untouched while auth is optional.
func TestAuthMiddlewareOpenModeAuthorizesWithoutCookie(t *testing.T) {
	svc, dir := newTestAuthService(t)
	setupOpen(t, svc, dir)

	if !callerFor(t, svc, nil) {
		t.Fatal("want an authorized caller on an open instance with no cookie")
	}
}

func TestAuthMiddlewarePasswordModeRejectsWithoutCookie(t *testing.T) {
	svc, dir := newTestAuthService(t)
	setupWithKey(t, svc, dir, "a-good-access-key")

	if callerFor(t, svc, nil) {
		t.Fatal("want no caller in password mode without a cookie")
	}
}

func TestAuthMiddlewarePasswordModeAcceptsValidToken(t *testing.T) {
	svc, dir := newTestAuthService(t)
	const key = "a-good-access-key"
	setupWithKey(t, svc, dir, key)

	token, err := svc.Login("1.2.3.4", key)
	if err != nil || token == "" {
		t.Fatalf("login: %v", err)
	}

	if !callerFor(t, svc, &http.Cookie{Name: graph.AuthCookieName, Value: token}) {
		t.Fatal("want an authorized caller for a valid token")
	}
}

func TestAuthMiddlewarePasswordModeRejectsUnknownToken(t *testing.T) {
	svc, dir := newTestAuthService(t)
	setupWithKey(t, svc, dir, "a-good-access-key")

	if callerFor(t, svc, &http.Cookie{Name: graph.AuthCookieName, Value: "made-up"}) {
		t.Fatal("want no caller for an unknown token")
	}
}

// Before setup the instance still defaults to password mode, so nothing guarded
// is readable by a stranger who finds the URL first.
func TestAuthMiddlewareRejectsBeforeSetup(t *testing.T) {
	svc, _ := newTestAuthService(t)

	if callerFor(t, svc, nil) {
		t.Fatal("want no caller on an instance that has not been set up")
	}
}

func setupOpen(t *testing.T, svc *svcauth.Service, dir string) {
	t.Helper()
	if err := svc.CompleteSetup("1.2.3.4", readToken(t, dir), nil); err != nil {
		t.Fatalf("complete setup: %v", err)
	}
}

func setupWithKey(t *testing.T, svc *svcauth.Service, dir, key string) {
	t.Helper()
	if err := svc.CompleteSetup("1.2.3.4", readToken(t, dir), &key); err != nil {
		t.Fatalf("complete setup: %v", err)
	}
}
