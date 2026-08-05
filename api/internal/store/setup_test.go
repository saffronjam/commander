package store_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	migsqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"api/internal/session"
	"api/internal/store"
)

const testPragmas = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"

const testSession = session.ID("sess-1")

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", path+testPragmas)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func newMigrator(t *testing.T, db *sql.DB) *migrate.Migrate {
	t.Helper()
	src, err := iofs.New(store.Migrations, "migrations")
	if err != nil {
		t.Fatalf("iofs source: %v", err)
	}
	drv, err := migsqlite.WithInstance(db, &migsqlite.Config{})
	if err != nil {
		t.Fatalf("sqlite driver: %v", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "sqlite", drv)
	if err != nil {
		t.Fatalf("migrate instance: %v", err)
	}
	return m
}

func newStore(t *testing.T) (*store.DB, context.Context) {
	t.Helper()
	st, _, ctx := newStoreAndDB(t)
	return st, ctx
}

// newStoreAndDB also hands back the raw handle, for assertions about what is
// actually on disk rather than what the store reports.
func newStoreAndDB(t *testing.T) (*store.DB, *sql.DB, context.Context) {
	t.Helper()
	db := openTestDB(t)
	if err := newMigrator(t, db).Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}
	return store.New(db), db, context.Background()
}

func seedSession(t *testing.T, st *store.DB, ctx context.Context) {
	t.Helper()
	if err := st.CreateSession(ctx, testSession, "Test", "127.0.0.1:8080"); err != nil {
		t.Fatalf("seed session: %v", err)
	}
}
