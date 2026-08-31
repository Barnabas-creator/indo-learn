CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  trial_ends_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS codes (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER,
  issued_at INTEGER NOT NULL,
  used_at INTEGER,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS content_keys (
  version TEXT PRIMARY KEY,
  cek TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts ON attempts (ip, endpoint, ts);

CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT,
  message TEXT
);

CREATE TABLE IF NOT EXISTS content (
  module   TEXT NOT NULL,
  unit_id  TEXT NOT NULL,
  tier     TEXT NOT NULL,
  version  TEXT NOT NULL,
  title    TEXT,
  body     TEXT NOT NULL,
  PRIMARY KEY (module, unit_id)
);

CREATE TABLE IF NOT EXISTS content_meta (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  version  TEXT NOT NULL,
  built_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS content_hits (
  subject TEXT NOT NULL,
  day     TEXT NOT NULL,
  n       INTEGER NOT NULL,
  PRIMARY KEY (subject, day)
);
