CREATE TABLE IF NOT EXISTS online_posts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,username TEXT NOT NULL,caption TEXT NOT NULL DEFAULT '',media_key TEXT,media_type TEXT,created_at INTEGER NOT NULL,deleted_at INTEGER,deleted_by TEXT);
CREATE INDEX IF NOT EXISTS online_posts_date ON online_posts(created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS online_likes (post_id TEXT NOT NULL REFERENCES online_posts(id),user_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(post_id,user_id));
CREATE TABLE IF NOT EXISTS online_comments (id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES online_posts(id),user_id TEXT NOT NULL,username TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS online_comments_post ON online_comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS online_rate_limits (user_id TEXT NOT NULL,kind TEXT NOT NULL,window INTEGER NOT NULL,hits INTEGER NOT NULL,PRIMARY KEY(user_id,kind));
