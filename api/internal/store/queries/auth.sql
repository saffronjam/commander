-- name: GetAuthPassword :one
SELECT hash, is_default, updated_at FROM auth_password WHERE id = 1;

-- name: UpsertAuthPassword :exec
INSERT INTO auth_password (id, hash, is_default, updated_at)
VALUES (1, sqlc.arg(hash), sqlc.arg(is_default), CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE
    SET hash = excluded.hash,
        is_default = excluded.is_default,
        updated_at = excluded.updated_at;

-- name: InsertToken :exec
INSERT INTO auth_tokens (token, created_at, last_used, expires_at, client_ip)
VALUES (sqlc.arg(token), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        sqlc.arg(expires_at), sqlc.arg(client_ip));

-- name: GetValidToken :one
SELECT token, created_at, last_used, expires_at, client_ip
FROM auth_tokens
WHERE token = sqlc.arg(token)
  AND expires_at > sqlc.arg(now);

-- name: TouchToken :exec
UPDATE auth_tokens
SET last_used = CURRENT_TIMESTAMP,
    expires_at = sqlc.arg(expires_at),
    client_ip = sqlc.arg(client_ip)
WHERE token = sqlc.arg(token);

-- name: DeleteToken :exec
DELETE FROM auth_tokens WHERE token = sqlc.arg(token);

-- name: RunTokenPrune :execrows
DELETE FROM auth_tokens WHERE expires_at <= sqlc.arg(now);
