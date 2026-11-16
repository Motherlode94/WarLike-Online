-- Dedicated D1 database for Transcribe projects. Do not apply to Online's DB.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS transcribe_projects(
 id TEXT PRIMARY KEY,
 owner_member_id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 150),
 language TEXT NOT NULL DEFAULT '' CHECK(length(language)<=8),
 transcript TEXT NOT NULL DEFAULT '' CHECK(length(transcript)<=250000),
 subtitles_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(subtitles_json)),
 audio_key TEXT,
 audio_type TEXT,
 audio_bytes INTEGER NOT NULL DEFAULT 0 CHECK(audio_bytes>=0),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transcribe_owner_recent ON transcribe_projects(owner_member_id,updated_at DESC,id DESC);
