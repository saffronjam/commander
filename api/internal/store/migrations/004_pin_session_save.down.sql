-- One save per session makes the inverse exact: every history row belongs to
-- the session's pinned save, so save_name can be restored from the join.
--
-- Staging outside the foreign key graph for the same reason as the up
-- migration: DROP TABLE fires ON DELETE CASCADE when foreign_keys is ON.
CREATE TABLE history_stage (
    session_id   TEXT    NOT NULL,
    save_name    TEXT    NOT NULL,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL
);

INSERT INTO history_stage (session_id, save_name, data_type, game_time_id, data)
SELECT h.session_id, s.save_name, h.data_type, h.game_time_id, h.data
FROM history_points h
JOIN sessions s ON s.id = h.session_id;

DROP TABLE history_points;

CREATE TABLE sessions_old (
    id           TEXT      PRIMARY KEY,
    name         TEXT      NOT NULL,
    address      TEXT      NOT NULL,
    session_name TEXT      NOT NULL DEFAULT '',
    is_paused    INTEGER   NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sessions_old (id, name, address, session_name, is_paused, created_at)
SELECT id, name, address, save_name, is_paused, created_at FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_old RENAME TO sessions;

CREATE TABLE history_points (
    session_id   TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    save_name    TEXT    NOT NULL,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL,
    PRIMARY KEY (session_id, save_name, data_type, game_time_id)
);

INSERT INTO history_points (session_id, save_name, data_type, game_time_id, data)
SELECT session_id, save_name, data_type, game_time_id, data
FROM history_stage
WHERE session_id IN (SELECT id FROM sessions);

DROP TABLE history_stage;
