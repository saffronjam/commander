-- name: GetSetting :one
SELECT key, value FROM settings WHERE key = ?;

-- name: ListSettings :many
SELECT key, value FROM settings;

-- name: UpsertSetting :exec
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
