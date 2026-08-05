-- name: GetInstance :one
SELECT initialized_at, auth_mode, bootstrap_token_hash, created_at
FROM instance WHERE id = 1;

-- name: EnsureInstance :exec
INSERT INTO instance (id) VALUES (1)
ON CONFLICT(id) DO NOTHING;

-- name: SetBootstrapTokenHash :exec
UPDATE instance
SET bootstrap_token_hash = sqlc.arg(bootstrap_token_hash)
WHERE id = 1;

-- name: CompleteInstanceSetup :execrows
UPDATE instance
SET initialized_at       = CURRENT_TIMESTAMP,
    auth_mode            = sqlc.arg(auth_mode),
    bootstrap_token_hash = NULL
WHERE id = 1
  AND initialized_at IS NULL;

-- name: SetAuthMode :exec
UPDATE instance
SET auth_mode = sqlc.arg(auth_mode)
WHERE id = 1;
