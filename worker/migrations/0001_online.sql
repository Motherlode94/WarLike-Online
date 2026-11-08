-- WarLike Online: tables D1. Apply with wrangler d1 migrations apply.
CREATE TABLE IF NOT EXISTS online_users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS online_sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_online_sessions_user ON online_sessions(user_id);
CREATE TABLE IF NOT EXISTS online_posts (
 id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 body TEXT NOT NULL DEFAULT '', media_key TEXT, media_type TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(length(body) <= 2000)
);
CREATE INDEX IF NOT EXISTS idx_online_posts_created ON online_posts(created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS online_likes (
 post_id TEXT NOT NULL REFERENCES online_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS online_comments (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES online_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(length(body) BETWEEN 1 AND 350)
);
CREATE INDEX IF NOT EXISTS idx_online_comments_post ON online_comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS online_follows (
 follower_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 followed_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(follower_id, followed_id), CHECK(follower_id <> followed_id)
);
