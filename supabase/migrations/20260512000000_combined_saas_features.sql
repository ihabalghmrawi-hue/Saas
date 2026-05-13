-- ==========================================================
-- Combined SaaS Feature Migrations
-- Order: billing → analytics (views) → notifications → audit → security
-- All statements use IF NOT EXISTS — safe to run multiple times
-- ==========================================================

-- ═══════════════════════════════════════════════════════════
-- 1. Billing (20260512000001)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  paddle_customer_id TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  invoice_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  due_date DATE,
  stripe_invoice_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_plan TEXT,
  new_plan TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  max_uses_per_company INTEGER DEFAULT 1,
  plan_ids UUID[],
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_company ON billing_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_company ON subscription_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);


-- ═══════════════════════════════════════════════════════════
-- 2. Analytics Materialized Views (20260512000002)
-- ═══════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mrr_daily AS
WITH daily AS (
  SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*) FILTER (WHERE plan IN ('basic', 'pro') AND status = 'active') AS active_paid_subscriptions,
    COUNT(*) FILTER (WHERE plan = 'basic' AND status = 'active') AS basic_active,
    COUNT(*) FILTER (WHERE plan = 'pro' AND status = 'active') AS pro_active,
    COUNT(*) FILTER (WHERE status = 'active') AS total_active,
    COUNT(*) FILTER (WHERE status = 'trialing') AS trialing,
    COUNT(*) FILTER (WHERE status = 'expired') AS expired,
    COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
  FROM subscriptions
  GROUP BY date_trunc('day', created_at)
)
SELECT * FROM daily
ORDER BY day DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_stats AS
SELECT
  COUNT(*) AS total_companies,
  COUNT(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id::text = companies.id::text AND s.status = 'active')
  ) AS with_active_subscription,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_last_30d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_last_7d
FROM companies;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mrr_daily ON mv_mrr_daily(day);


-- ═══════════════════════════════════════════════════════════
-- 3. Notifications (20260512000003)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table already existed without them
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(company_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity);


-- ═══════════════════════════════════════════════════════════
-- 4. Enhanced Audit Logs (20260512000004)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_severity ON audit_logs(company_id, severity, created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- 5. Security Tables (20260512000005)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, last_active_at DESC);
