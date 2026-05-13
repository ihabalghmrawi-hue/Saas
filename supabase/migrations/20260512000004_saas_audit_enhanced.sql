ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'; -- info, warning, critical
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_severity ON audit_logs(company_id, severity, created_at DESC);
