package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"api/internal/auth"
	"api/internal/store/sqlite"
)

// TokenTTL is the lifetime of a freshly issued access token.
const TokenTTL = 7 * 24 * time.Hour

// GetAuthPassword returns the singleton password row, or ErrNotFound.
func (s *DB) GetAuthPassword(ctx context.Context) (AuthPassword, error) {
	row, err := s.q.GetAuthPassword(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return AuthPassword{}, ErrNotFound
	}
	if err != nil {
		return AuthPassword{}, fmt.Errorf("get auth password: %w", err)
	}
	return AuthPassword{Hash: row.Hash, IsDefault: int64ToBool(row.IsDefault), UpdatedAt: row.UpdatedAt}, nil
}

// UpsertAuthPassword writes the shared password hash and default flag.
func (s *DB) UpsertAuthPassword(ctx context.Context, hash string, isDefault bool) error {
	if err := s.q.UpsertAuthPassword(ctx, sqlite.UpsertAuthPasswordParams{
		Hash:      hash,
		IsDefault: boolToInt64(isDefault),
	}); err != nil {
		return fmt.Errorf("upsert auth password: %w", err)
	}
	return nil
}

// EnsureBootstrapPassword seeds the bootstrap password row if none exists,
// hashing the configured plaintext and marking it as the default password.
// This is the clean-wipe cutover: a fresh DB re-bootstraps to the bootstrap
// password with is_default = 1.
func (s *DB) EnsureBootstrapPassword(ctx context.Context, bootstrapPlaintext string) error {
	_, err := s.q.GetAuthPassword(ctx)
	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("check auth password: %w", err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(bootstrapPlaintext), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash bootstrap password: %w", err)
	}
	return s.UpsertAuthPassword(ctx, string(hash), true)
}

// IsUsingDefaultPassword reports whether the stored password is still the
// bootstrap default.
func (s *DB) IsUsingDefaultPassword(ctx context.Context) (bool, error) {
	pw, err := s.GetAuthPassword(ctx)
	if err != nil {
		return false, err
	}
	return pw.IsDefault, nil
}

// InsertToken stores a freshly issued token.
func (s *DB) InsertToken(ctx context.Context, token auth.Token, expiresAt time.Time, clientIP string) error {
	if err := s.q.InsertToken(ctx, sqlite.InsertTokenParams{
		Token:     token,
		ExpiresAt: expiresAt,
		ClientIp:  clientIP,
	}); err != nil {
		return fmt.Errorf("insert token: %w", err)
	}
	return nil
}

// GetValidToken returns a token only if it has not expired as of now.
func (s *DB) GetValidToken(ctx context.Context, token auth.Token, now time.Time) (Token, error) {
	row, err := s.q.GetValidToken(ctx, sqlite.GetValidTokenParams{Token: token, Now: now})
	if errors.Is(err, sql.ErrNoRows) {
		return Token{}, ErrNotFound
	}
	if err != nil {
		return Token{}, fmt.Errorf("get valid token: %w", err)
	}
	return tokenFromRow(row), nil
}

// TouchToken applies sliding expiration: bump last_used, expires_at, client_ip.
func (s *DB) TouchToken(ctx context.Context, token auth.Token, expiresAt time.Time, clientIP string) error {
	if err := s.q.TouchToken(ctx, sqlite.TouchTokenParams{
		ExpiresAt: expiresAt,
		ClientIp:  clientIP,
		Token:     token,
	}); err != nil {
		return fmt.Errorf("touch token: %w", err)
	}
	return nil
}

// DeleteToken removes a single token (logout).
func (s *DB) DeleteToken(ctx context.Context, token auth.Token) error {
	if err := s.q.DeleteToken(ctx, token); err != nil {
		return fmt.Errorf("delete token: %w", err)
	}
	return nil
}

// RunTokenPrune deletes all tokens expired as of now and returns the count.
func (s *DB) RunTokenPrune(ctx context.Context, now time.Time) (int64, error) {
	n, err := s.q.RunTokenPrune(ctx, now)
	if err != nil {
		return 0, fmt.Errorf("run token prune: %w", err)
	}
	return n, nil
}

func tokenFromRow(r sqlite.AuthToken) Token {
	return Token{
		Token:     r.Token,
		CreatedAt: r.CreatedAt,
		LastUsed:  r.LastUsed,
		ExpiresAt: r.ExpiresAt,
		ClientIP:  r.ClientIp,
	}
}
