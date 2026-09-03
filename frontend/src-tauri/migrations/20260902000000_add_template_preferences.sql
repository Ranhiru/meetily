CREATE TABLE IF NOT EXISTS template_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    global_default_id TEXT NOT NULL DEFAULT 'standard_meeting'
);

INSERT OR IGNORE INTO template_preferences (id, global_default_id)
VALUES (1, 'standard_meeting');

ALTER TABLE meetings ADD COLUMN template_override_id TEXT;

