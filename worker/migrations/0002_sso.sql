-- Link verified WarLike Server subjects to local Online profiles.
CREATE TABLE IF NOT EXISTS online_identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES online_users(id) ON DELETE CASCADE,
  PRIMARY KEY(provider,subject),
  UNIQUE(provider,user_id)
);
CREATE TABLE IF NOT EXISTS online_assertion_nonces (
  nonce_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_assertion_nonces_expires ON online_assertion_nonces(expires_at);
