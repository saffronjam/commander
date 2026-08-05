package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// GetInstance returns the singleton instance row, or ErrNotFound before the
// first EnsureInstance.
func (s *DB) GetInstance(ctx context.Context) (Instance, error) {
	row, err := s.q.GetInstance(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return Instance{}, ErrNotFound
	}
	if err != nil {
		return Instance{}, fmt.Errorf("get instance: %w", err)
	}

	inst := Instance{
		AuthMode:  AuthMode(row.AuthMode),
		CreatedAt: row.CreatedAt,
	}
	if row.InitializedAt != nil {
		inst.Initialized = true
		inst.InitializedAt = *row.InitializedAt
	}
	if row.BootstrapTokenHash != nil {
		inst.BootstrapTokenHash = *row.BootstrapTokenHash
	}
	return inst, nil
}

// EnsureInstance creates the singleton row if it is absent, leaving an existing
// row untouched.
func (s *DB) EnsureInstance(ctx context.Context) error {
	if err := s.q.EnsureInstance(ctx); err != nil {
		return fmt.Errorf("ensure instance: %w", err)
	}
	return nil
}

// SetBootstrapTokenHash stores the digest of the first-run claim token. An empty
// hash clears it.
func (s *DB) SetBootstrapTokenHash(ctx context.Context, hash string) error {
	var arg *string
	if hash != "" {
		arg = &hash
	}
	if err := s.q.SetBootstrapTokenHash(ctx, arg); err != nil {
		return fmt.Errorf("set bootstrap token hash: %w", err)
	}
	return nil
}

// CompleteInstanceSetup stamps the instance as initialized in the given auth
// mode and clears the bootstrap token. It reports false when the instance was
// already initialized, which makes setup single-use without a read-then-write
// race.
func (s *DB) CompleteInstanceSetup(ctx context.Context, mode AuthMode) (bool, error) {
	n, err := s.q.CompleteInstanceSetup(ctx, string(mode))
	if err != nil {
		return false, fmt.Errorf("complete instance setup: %w", err)
	}
	return n > 0, nil
}

// SetAuthMode switches an already-initialized instance between open and
// password mode.
func (s *DB) SetAuthMode(ctx context.Context, mode AuthMode) error {
	if err := s.q.SetAuthMode(ctx, string(mode)); err != nil {
		return fmt.Errorf("set auth mode: %w", err)
	}
	return nil
}
