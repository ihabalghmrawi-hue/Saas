-- ════════════════════════════════════════════════
-- MODULE: Customer Transactions & Debt Ledger
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'payment', 'return', 'adjustment')),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer ON customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_company ON customer_transactions(company_id);

ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_customer_transactions" ON customer_transactions;
CREATE POLICY "allow_all_customer_transactions" ON customer_transactions FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════
-- MODULE: Returns / Refunds
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  return_number TEXT NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash' CHECK (refund_method IN ('cash', 'wallet', 'credit', 'exchange')),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, return_number)
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_company ON returns(company_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_returns" ON returns;
CREATE POLICY "allow_all_returns" ON returns FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_return_items" ON return_items;
CREATE POLICY "allow_all_return_items" ON return_items FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════
-- MODULE: Shift Management
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  cashier_name TEXT NOT NULL,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  difference NUMERIC(12,2),
  total_sales NUMERIC(12,2) DEFAULT 0,
  total_returns NUMERIC(12,2) DEFAULT 0,
  total_cash_sales NUMERIC(12,2) DEFAULT 0,
  total_card_sales NUMERIC(12,2) DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_shifts_company ON shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(company_id, status);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_shifts" ON shifts;
CREATE POLICY "allow_all_shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════
-- FUNCTION: Generate return number
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_return_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM returns WHERE company_id = p_company_id;
  v_number := 'RET-' || LPAD(v_count::TEXT, 5, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
