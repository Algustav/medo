-- Run against the existing meDo database (tasks table must already exist).
CREATE TABLE IF NOT EXISTS kclip_devices (
  device TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kclip_receipts (
  id TEXT PRIMARY KEY,
  device TEXT NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
