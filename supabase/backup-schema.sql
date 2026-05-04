-- ============================================================
-- BACKUP SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Backup snapshot metadata table
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    TEXT NOT NULL,
  label         TEXT NOT NULL,                 -- human-readable name e.g. "يومي - 2026-05-04"
  type          TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'auto')),
  format        TEXT NOT NULL DEFAULT 'json'   CHECK (format IN ('json', 'csv')),
  storage_path  TEXT NOT NULL,                 -- path inside the bucket
  file_size     BIGINT DEFAULT 0,              -- bytes
  table_counts  JSONB DEFAULT '{}',            -- {"customers": 42, "sales": 150, ...}
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'restoring')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_backup_company    ON backup_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_backup_created_at ON backup_snapshots(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_type       ON backup_snapshots(company_id, type);

ALTER TABLE backup_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_backups" ON backup_snapshots FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKET (run in Supabase dashboard > Storage, or via API)
-- This SQL only works if the pg extension is available.
-- Otherwise create the bucket manually: name = "company-backups", public = false
-- ============================================================

-- Insert bucket record (safe to run, won't fail if storage schema doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'company-backups',
      'company-backups',
      false,
      104857600,  -- 100 MB per file
      ARRAY['application/json', 'text/csv', 'application/zip', 'application/octet-stream']
    )
    ON CONFLICT (id) DO NOTHING;

    -- Allow authenticated and service-role access only
    INSERT INTO storage.policies (name, bucket_id, operation, definition)
    VALUES
      ('backup-upload',   'company-backups', 'INSERT', 'true'),
      ('backup-read',     'company-backups', 'SELECT', 'true'),
      ('backup-delete',   'company-backups', 'DELETE', 'true')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- HELPER: cleanup expired backups (call from a scheduled job)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM backup_snapshots
  WHERE expires_at < NOW() AND status = 'ready';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
