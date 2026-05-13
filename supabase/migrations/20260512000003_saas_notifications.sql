CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- subscription_expiring, payment_failed, quota_exceeded, system_incident, suspicious_activity
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info', -- info, warning, critical
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- in_app, email, webhook
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(company_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity);
