-- Rental Pricing Rules
CREATE TABLE IF NOT EXISTS rental_pricing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    TEXT NOT NULL,
  dress_id      UUID REFERENCES dresses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'per_day', -- per_day | package | weekend | event
  base_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_type  TEXT NOT NULL DEFAULT 'fixed',   -- fixed | percentage
  deposit_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  packages      JSONB DEFAULT '[]',
  weekend       JSONB DEFAULT '{"days":[5,6],"multiplier":1.5}',
  events        JSONB DEFAULT '[]',
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_company ON rental_pricing_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_pricing_dress   ON rental_pricing_rules(dress_id);
CREATE INDEX IF NOT EXISTS idx_pricing_active  ON rental_pricing_rules(company_id, active);

ALTER TABLE rental_pricing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_pricing" ON rental_pricing_rules;
CREATE POLICY "allow_all_pricing" ON rental_pricing_rules FOR ALL USING (true) WITH CHECK (true);
