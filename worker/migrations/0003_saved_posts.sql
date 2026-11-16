-- Persistent per-user saved posts; deletion cascades with the original post.
CREATE TABLE IF NOT EXISTS online_bookmarks (
 user_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 post_id TEXT NOT NULL REFERENCES online_posts(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,post_id)
);
CREATE INDEX IF NOT EXISTS idx_online_bookmarks_recent ON online_bookmarks(user_id,created_at DESC,post_id DESC);
