-- name: UpsertHistoryPoint :exec
INSERT INTO history_points (session_id, data_type, game_time_id, data)
VALUES (
    sqlc.arg(session_id),
    sqlc.arg(data_type),
    sqlc.arg(game_time_id),
    sqlc.arg(data)
)
ON CONFLICT(session_id, data_type, game_time_id)
DO UPDATE SET data = excluded.data;

-- name: QueryHistoryRaw :many
SELECT game_time_id, data
FROM (
    SELECT game_time_id, data
    FROM history_points
    WHERE session_id = sqlc.arg(session_id)
      AND data_type = sqlc.arg(data_type)
      AND game_time_id > CAST(sqlc.arg(since) AS INTEGER)
      AND game_time_id <= CAST(sqlc.arg(to_id) AS INTEGER)
    ORDER BY game_time_id DESC
    LIMIT IIF(CAST(sqlc.arg(lim) AS INTEGER) > 0, CAST(sqlc.arg(lim) AS INTEGER), -1)
) AS newest
ORDER BY game_time_id ASC;

-- name: QueryHistoryBucketed :many
WITH bucketed AS (
    SELECT game_time_id, data,
           game_time_id / CAST(sqlc.arg(bucket_seconds) AS INTEGER) AS bucket
    FROM history_points
    WHERE session_id = sqlc.arg(session_id)
      AND data_type = sqlc.arg(data_type)
      AND game_time_id > CAST(sqlc.arg(since) AS INTEGER)
      AND game_time_id <= CAST(sqlc.arg(to_id) AS INTEGER)
),
newest AS (
    SELECT b.game_time_id, b.data
    FROM bucketed b
    WHERE b.game_time_id = (
        SELECT MAX(b2.game_time_id) FROM bucketed b2 WHERE b2.bucket = b.bucket
    )
    ORDER BY b.game_time_id DESC
    LIMIT IIF(CAST(sqlc.arg(lim) AS INTEGER) > 0, CAST(sqlc.arg(lim) AS INTEGER), -1)
)
SELECT game_time_id, data FROM newest ORDER BY game_time_id ASC;

-- name: PruneHistoryOlderThan :execrows
DELETE FROM history_points
WHERE session_id = sqlc.arg(session_id)
  AND data_type = sqlc.arg(data_type)
  AND game_time_id < CAST(sqlc.arg(cutoff) AS INTEGER);
