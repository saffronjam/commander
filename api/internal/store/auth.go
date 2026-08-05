package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"api/internal/auth"
	"api/internal/store/sqlite"
)

// TokenTTL is the lifetime of a freshly issued access token.
const TokenTTL = 7 * 24 * time.Hour

// GetAuthPassword returns the singleton password row, or ErrNotFound when the
// instance has no password (open mode, or setup not yet completed).
func (s *DB) GetAuthPassword(ctx context.Context) (AuthPassword, error) {
	row, err := s.q.GetAuthPassword(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return AuthPassword{}, ErrNotFound
	}
	if err != nil {
		return AuthPassword{}, fmt.Errorf("get auth password: %w", err)
	}
	return AuthPassword{Hash: row.Hash, UpdatedAt: row.UpdatedAt}, nil
}

// UpsertAuthPassword writes the shared password hash.
func (s *DB) UpsertAuthPassword(ctx context.Context, hash string) error {
	if err := s.q.UpsertAuthPassword(ctx, hash); err != nil {
		return fmt.Errorf("upsert auth password: %w", err)
	}
	return nil
}

// DeleteAuthPassword removes the password row, which is how an instance moves to
// open mode.
func (s *DB) DeleteAuthPassword(ctx context.Context) error {
	if err := s.q.DeleteAuthPassword(ctx); err != nil {
		return fmt.Errorf("delete auth password: %w", err)
	}
	return nil
}

// InsertToken stores a freshly issued token by its hash.
func (s *DB) InsertToken(ctx context.Context, hash auth.TokenHash, expiresAt time.Time, clientIP string) error {
	if err := s.q.InsertToken(ctx, sqlite.InsertTokenParams{
		TokenHash: hash,
		ExpiresAt: expiresAt,
		ClientIp:  clientIP,
	}); err != nil {
		return fmt.Errorf("insert token: %w", err)
	}
	return nil
}

// GetValidToken returns a token only if it has not expired as of now.
func (s *DB) GetValidToken(ctx context.Context, hash auth.TokenHash, now time.Time) (Token, error) {
	row, err := s.q.GetValidToken(ctx, sqlite.GetValidTokenParams{TokenHash: hash, Now: now})
	if errors.Is(err, sql.ErrNoRows) {
		return Token{}, ErrNotFound
	}
	if err != nil {
		return Token{}, fmt.Errorf("get valid token: %w", err)
	}
	return tokenFromRow(row), nil
}

// TouchToken applies sliding expiration: bump last_used, expires_at, client_ip.
func (s *DB) TouchToken(ctx context.Context, hash auth.TokenHash, expiresAt time.Time, clientIP string) error {
	if err := s.q.TouchToken(ctx, sqlite.TouchTokenParams{
		ExpiresAt: expiresAt,
		ClientIp:  clientIP,
		TokenHash: hash,
	}); err != nil {
		return fmt.Errorf("touch token: %w", err)
	}
	return nil
}

// DeleteToken removes a single token (logout).
func (s *DB) DeleteToken(ctx context.Context, hash auth.TokenHash) error {
	if err := s.q.DeleteToken(ctx, hash); err != nil {
		return fmt.Errorf("delete token: %w", err)
	}
	return nil
}

// DeleteAllTokens revokes every session, used when the password changes or auth
// is switched off.
func (s *DB) DeleteAllTokens(ctx context.Context) error {
	if err := s.q.DeleteAllTokens(ctx); err != nil {
		return fmt.Errorf("delete all tokens: %w", err)
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
		TokenHash: r.TokenHash,
		CreatedAt: r.CreatedAt,
		LastUsed:  r.LastUsed,
		ExpiresAt: r.ExpiresAt,
		ClientIP:  r.ClientIp,
	}
}
