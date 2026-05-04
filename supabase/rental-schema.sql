-- ════════════════════════════════════════════════
-- Dress Rental Module Schema
-- Isolated from sales/inventory — no shared tables
-- ════════════════════════════════════════════════

-- Dress catalog
CREATE TABLE IF NOT EXISTS dresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  code         TEXT,                          -- internal reference code
  category     TEXT NOT NULL DEFAULT 'wedding', -- wedding | evening | casual | other
  size         TEXT,
  color        TEXT,
  description  TEXT,
  rental_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'available', -- available | rented | maintenance | retired
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dresses_company   ON dresses(company_id);
CREATE INDEX IF NOT EXISTS idx_dresses_status    ON dresses(company_id, status);
CREATE INDEX IF NOT EXISTS idx_dresses_category  ON dresses(company_id, category);

ALTER TABLE dresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_dresses" ON dresses;
CREATE POLICY "allow_all_dresses" ON dresses FOR ALL USING (true) WITH CHECK (true);

-- Rental orders (bookings)
CREATE TABLE IF NOT EXISTS rental_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      TEXT NOT NULL,
  order_number    TEXT NOT NULL,
  dress_id        UUID NOT NULL REFERENCES dresses(id) ON DELETE RESTRICT,
  customer_id     UUID,                              -- optional link, no FK to keep module isolated
  customer_name   TEXT NOT NULL,             -- denormalized for walk-ins
  customer_phone  TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days            INT GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  rental_price    NUMERIC(12,2) NOT NULL,    -- price per day
  total_price     NUMERIC(12,2) NOT NULL,    -- rental_price * days
  deposit         NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_paid    BOOLEAN NOT NULL DEFAULT false,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'booked', -- booked | active | returned | late | cancelled
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_company   ON rental_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_dress     ON rental_orders(dress_id);
CREATE INDEX IF NOT EXISTS idx_rental_status    ON rental_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_rental_dates     ON rental_orders(company_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rental_customer  ON rental_orders(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_number ON rental_orders(company_id, order_number);

ALTER TABLE rental_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rental_orders" ON rental_orders;
CREATE POLICY "allow_all_rental_orders" ON rental_orders FOR ALL USING (true) WITH CHECK (true);

-- Rental returns
CREATE TABLE IF NOT EXISTS rental_returns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      TEXT NOT NULL,
  rental_id       UUID NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
  returned_at     TIMESTAMPTZ DEFAULT NOW(),
  condition       TEXT NOT NULL DEFAULT 'good', -- good | minor_damage | major_damage | lost
  extra_fees      NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_refund  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_rental   ON rental_returns(rental_id);
CREATE INDEX IF NOT EXISTS idx_returns_company  ON rental_returns(company_id);

ALTER TABLE rental_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rental_returns" ON rental_returns;
CREATE POLICY "allow_all_rental_returns" ON rental_returns FOR ALL USING (true) WITH CHECK (true);

-- Auto-generate order numbers
CREATE OR REPLACE FUNCTION generate_rental_number(p_company_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_count INT;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM rental_orders WHERE company_id = p_company_id;
  v_number := 'RNT-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function: check dress availability for a date range
CREATE OR REPLACE FUNCTION is_dress_available(
  p_dress_id UUID,
  p_start DATE,
  p_end DATE,
  p_exclude_order_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conflicts INT;
BEGIN
  SELECT COUNT(*) INTO v_conflicts
  FROM rental_orders
  WHERE dress_id = p_dress_id
    AND status IN ('booked', 'active')
    AND (p_exclude_order_id IS NULL OR id != p_exclude_order_id)
    AND NOT (end_date < p_start OR start_date > p_end);
  RETURN v_conflicts = 0;
END;
$$ LANGUAGE plpgsql;