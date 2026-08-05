package store_test

import (
	"database/sql"
	"testing"

	"github.com/golang-migrate/migrate/v4"
)

// migrateTo runs the chain up to and including the given version, so a test can
// seed pre-003 rows in the old shape before letting 003 rewrite them.
func migrateTo(t *testing.T, db *sql.DB, version uint) {
	t.Helper()
	if err := newMigrator(t, db).Migrate(version); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate to %d: %v", version, err)
	}
}

func seedLegacyAuth(t *testing.T, db *sql.DB, isDefault int) {
	t.Helper()
	if _, err := db.Exec(
		`INSERT INTO auth_password (id, hash, is_default) VALUES (1, 'legacy-hash', ?)`, isDefault,
	); err != nil {
		t.Fatalf("seed auth_password: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO auth_tokens (token, expires_at) VALUES ('plaintext-token', '2099-01-01 00:00:00')`,
	); err != nil {
		t.Fatalf("seed auth_tokens: %v", err)
	}
}

func readInstance(t *testing.T, db *sql.DB) (initializedAt *string, authMode string) {
	t.Helper()
	if err := db.QueryRow(
		`SELECT initialized_at, auth_mode FROM instance WHERE id = 1`,
	).Scan(&initializedAt, &authMode); err != nil {
		t.Fatalf("read instance: %v", err)
	}
	return initializedAt, authMode
}

func countRows(t *testing.T, db *sql.DB, table string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

// An instance still on the shipped default password was never really
// configured, so 003 must drop the password and leave first-run setup pending.
func TestMigration003DropsUnconfiguredDefaultPassword(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 2)
	seedLegacyAuth(t, db, 1)
	migrateTo(t, db, 3)

	initializedAt, authMode := readInstance(t, db)
	if initializedAt != nil {
		t.Fatalf("want setup still pending, got initialized_at=%q", *initializedAt)
	}
	if authMode != "password" {
		t.Fatalf("want password as the pre-setup default, got %q", authMode)
	}
	if n := countRows(t, db, "auth_password"); n != 0 {
		t.Fatalf("want the default password dropped, got %d rows", n)
	}
	if n := countRows(t, db, "auth_tokens"); n != 0 {
		t.Fatalf("want plaintext tokens dropped, got %d rows", n)
	}
}

// An instance whose password was deliberately changed is carried over as
// already initialized, so the operator is not sent back through setup.
func TestMigration003KeepsConfiguredPassword(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 2)
	seedLegacyAuth(t, db, 0)
	migrateTo(t, db, 3)

	initializedAt, authMode := readInstance(t, db)
	if initializedAt == nil {
		t.Fatal("want the instance marked initialized")
	}
	if authMode != "password" {
		t.Fatalf("want password mode, got %q", authMode)
	}

	var hash string
	if err := db.QueryRow(`SELECT hash FROM auth_password WHERE id = 1`).Scan(&hash); err != nil {
		t.Fatalf("want the password kept: %v", err)
	}
	if hash != "legacy-hash" {
		t.Fatalf("want the existing hash preserved, got %q", hash)
	}
	if n := countRows(t, db, "auth_tokens"); n != 0 {
		t.Fatalf("want plaintext tokens dropped, got %d rows", n)
	}
}

// A fresh database has no legacy rows at all and must still land uninitialized.
func TestMigration003OnEmptyDatabase(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)

	initializedAt, authMode := readInstance(t, db)
	if initializedAt != nil {
		t.Fatalf("want setup pending on a fresh database, got %q", *initializedAt)
	}
	if authMode != "password" {
		t.Fatalf("want password default, got %q", authMode)
	}
}

// The rebuilt tables must have the new shape, not the old one.
func TestMigration003RewritesTableShapes(t *testing.T) {
	db := openTestDB(t)
	migrateTo(t, db, 3)

	if _, err := db.Exec(`SELECT is_default FROM auth_password`); err == nil {
		t.Fatal("want auth_password.is_default gone")
	}
	if _, err := db.Exec(`SELECT token FROM auth_tokens`); err == nil {
		t.Fatal("want auth_tokens.token replaced by token_hash")
	}
	if _, err := db.Exec(`SELECT token_hash FROM auth_tokens`); err != nil {
		t.Fatalf("want auth_tokens.token_hash present: %v", err)
	}
}
