package store_test

import (
	"testing"

	"github.com/golang-migrate/migrate/v4"
)

func TestMigrateUp(t *testing.T) {
	db := openTestDB(t)
	if err := newMigrator(t, db).Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}
}

func TestMigrateUpDown(t *testing.T) {
	db := openTestDB(t)
	if err := newMigrator(t, db).Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("up: %v", err)
	}
	if err := newMigrator(t, db).Down(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("down: %v", err)
	}
}

func TestMigrateUpIdempotent(t *testing.T) {
	db := openTestDB(t)
	if err := newMigrator(t, db).Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("first up: %v", err)
	}
	if err := newMigrator(t, db).Up(); err != migrate.ErrNoChange {
		t.Fatalf("second up: want ErrNoChange, got %v", err)
	}
}
