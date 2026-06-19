CREATE TABLE history_points (
    session_id   TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    save_name    TEXT    NOT NULL,
    data_type    TEXT    NOT NULL,
    game_time_id INTEGER NOT NULL,
    data         TEXT    NOT NULL,
    PRIMARY KEY (session_id, save_name, data_type, game_time_id)
);

INSERT OR IGNORE INTO settings (key, value)
    VALUES ('history.max_sample_game_duration', '0');
