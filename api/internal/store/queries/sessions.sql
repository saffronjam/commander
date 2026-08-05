-- name: CreateSession :exec
INSERT INTO sessions (id, name, address, created_at)
VALUES (sqlc.arg(id), sqlc.arg(name), sqlc.arg(address), CURRENT_TIMESTAMP);

-- name: GetSession :one
SELECT id, name, address, session_name, is_paused, created_at
FROM sessions WHERE id = sqlc.arg(id);

-- name: ListSessions :many
SELECT id, name, address, session_name, is_paused, created_at
FROM sessions ORDER BY created_at ASC;

-- name: UpdateSession :exec
UPDATE sessions
SET name = sqlc.arg(name),
    address = sqlc.arg(address),
    is_paused = sqlc.arg(is_paused)
WHERE id = sqlc.arg(id);

-- name: UpdateSessionSaveName :exec
UPDATE sessions
SET session_name = sqlc.arg(session_name)
WHERE id = sqlc.arg(id);

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = sqlc.arg(id);
