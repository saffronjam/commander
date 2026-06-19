package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"api/internal/store/sqlite"
)

// ErrNotFound is returned by single-row reads when the row does not exist.
var ErrNotFound = errors.New("store: not found")

// DB is the hand-written store wrapper over the sqlc-generated query set.
// Callers depend on its domain methods and never import the sqlite package.
type DB struct {
	q  *sqlite.Queries
	db *sql.DB
}

// New wraps an already-open *sql.DB with the generated query set.
func New(db *sql.DB) *DB {
	return &DB{q: sqlite.New(db), db: db}
}

// execTx runs fn inside a transaction, rolling back on error. It is carried for
// future multi-statement domain methods; today every query is single-statement.
func (s *DB) execTx(ctx context.Context, fn func(*sqlite.Queries) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	if err := fn(s.q.WithTx(tx)); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
