// Package migrate runs the embedded golang-migrate iofs chain against a
// modernc.org/sqlite database, both at serve boot (Up against an open handle)
// and as a standalone up|down|version subcommand.
package migrate

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	migsqlite "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"

	"api/internal/store"
)

const migratePragmas = "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)"

func newMigrator(db *sql.DB) (*migrate.Migrate, error) {
	src, err := iofs.New(store.Migrations, "migrations")
	if err != nil {
		return nil, fmt.Errorf("create migration source: %w", err)
	}
	drv, err := migsqlite.WithInstance(db, &migsqlite.Config{})
	if err != nil {
		return nil, fmt.Errorf("create migration db driver: %w", err)
	}
	return migrate.NewWithInstance("iofs", src, "sqlite", drv)
}

// Up applies all pending migrations against an already-open *sql.DB. The serve
// boot path uses this so the runner and the app share one handle and pragmas.
func Up(db *sql.DB) error {
	m, err := newMigrator(db)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

// Run is the CLI subcommand entrypoint: it opens its own handle to dbPath and
// runs up|down|version.
func Run(_ context.Context, dbPath, direction string, steps int) error {
	db, err := sql.Open("sqlite", dbPath+migratePragmas)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer func() { _ = db.Close() }()

	m, err := newMigrator(db)
	if err != nil {
		return err
	}
	switch direction {
	case "up":
		if steps > 0 {
			err = m.Steps(steps)
		} else {
			err = m.Up()
		}
	case "down":
		n := 1
		if steps > 0 {
			n = steps
		}
		err = m.Steps(-n)
	case "version":
		v, dirty, verr := m.Version()
		if verr != nil {
			return fmt.Errorf("get version: %w", verr)
		}
		fmt.Printf("version=%d dirty=%t\n", v, dirty)
		return nil
	default:
		return fmt.Errorf("unknown direction %q", direction)
	}
	if err != nil && err != migrate.ErrNoChange {
		return err
	}
	return nil
}
