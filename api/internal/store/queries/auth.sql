-- name: GetAuthPassword :one
SELECT hash, updated_at FROM auth_password WHERE id = 1;

-- name: UpsertAuthPassword :exec
INSERT INTO auth_password (id, hash, updated_at)
VALUES (1, sqlc.arg(hash), CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE
    SET hash = excluded.hash,
        updated_at = excluded.updated_at;

-- name: DeleteAuthPassword :exec
DELETE FROM auth_password WHERE id = 1;

-- name: InsertToken :exec
INSERT INTO auth_tokens (token_hash, created_at, last_used, expires_at, client_ip)
VALUES (sqlc.arg(token_hash), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        sqlc.arg(expires_at), sqlc.arg(client_ip));

-- name: GetValidToken :one
SELECT token_hash, created_at, last_used, expires_at, client_ip
FROM auth_tokens
WHERE token_hash = sqlc.arg(token_hash)
  AND expires_at > sqlc.arg(now);

-- name: TouchToken :exec
UPDATE auth_tokens
SET last_used = CURRENT_TIMESTAMP,
    expires_at = sqlc.arg(expires_at),
    client_ip = sqlc.arg(client_ip)
WHERE token_hash = sqlc.arg(token_hash);

-- name: DeleteToken :exec
DELETE FROM auth_tokens WHERE token_hash = sqlc.arg(token_hash);

-- name: DeleteAllTokens :exec
DELETE FROM auth_tokens;

-- name: RunTokenPrune :execrows
DELETE FROM auth_tokens WHERE expires_at <= sqlc.arg(now);
