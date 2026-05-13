-- billing_customers: links companies to Stripe/Paddle customers
CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  paddle_customer_id TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

-- invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  invoice_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled, refunded
  paid_at TIMESTAMPTZ,
  due_date DATE,
  stripe_invoice_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

-- subscription_events: audit trail for subscription changes
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- created, renewed, upgraded, downgraded, cancelled, expired, suspended, payment_failed
  old_status TEXT,
  new_status TEXT,
  old_plan TEXT,
  new_plan TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- promo_codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL, -- percentage, fixed
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  max_uses_per_company INTEGER DEFAULT 1,
  plan_ids UUID[],
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_billing_customers_company ON billing_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_company ON subscription_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
