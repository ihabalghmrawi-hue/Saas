-- ============================================================
-- SALES, INVOICING, RETURNS & ORDER MANAGEMENT FOUNDATION
-- Enterprise-grade commercial transaction engine
-- ============================================================

-- 1. QUOTATIONS
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quotation_no TEXT NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT,
  customer_tax_no TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  branch_id UUID,
  cost_center_id UUID,
  currency TEXT NOT NULL DEFAULT 'SAR',
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID,
  approved_by UUID,
  converted_to_order_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, quotation_no)
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 0,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  qty NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_rate NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  warehouse_id UUID,
  delivery_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SALES ORDERS
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL,
  quotation_id UUID REFERENCES quotations(id),
  customer_id UUID NOT NULL,
  customer_name TEXT,
  customer_tax_no TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  branch_id UUID,
  cost_center_id UUID,
  currency TEXT NOT NULL DEFAULT 'SAR',
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'partially_fulfilled', 'fulfilled', 'cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  balance_due NUMERIC(18,6) GENERATED ALWAYS AS (total - paid_amount) STORED,
  notes TEXT,
  terms TEXT,
  shipping_address TEXT,
  billing_address TEXT,
  created_by UUID,
  approved_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, order_no)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 0,
  item_id UUID,
  variant_id UUID,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  qty NUMERIC(18,6) NOT NULL DEFAULT 1,
  qty_fulfilled NUMERIC(18,6) NOT NULL DEFAULT 0,
  qty_invoiced NUMERIC(18,6) NOT NULL DEFAULT 0,
  qty_returned NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) DEFAULT 0,
  discount_percent NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_rate NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  warehouse_id UUID,
  expected_delivery_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  order_id UUID REFERENCES sales_orders(id),
  quotation_id UUID REFERENCES quotations(id),
  customer_id UUID NOT NULL,
  customer_name TEXT,
  customer_tax_no TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  branch_id UUID,
  cost_center_id UUID,
  currency TEXT NOT NULL DEFAULT 'SAR',
  exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'partially_paid', 'paid', 'overdue', 'reversed', 'cancelled')),
  invoice_type TEXT NOT NULL DEFAULT 'standard' CHECK (invoice_type IN ('standard', 'proforma', 'correction', 'recurring')),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  balance_due NUMERIC(18,6) GENERATED ALWAYS AS (total - paid_amount) STORED,
  notes TEXT,
  terms TEXT,
  reversed_from_id UUID REFERENCES invoices(id),
  reversal_reason TEXT,
  created_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 0,
  item_id UUID,
  variant_id UUID,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  qty NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) DEFAULT 0,
  discount_percent NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_rate NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  warehouse_id UUID,
  cost_center_id UUID,
  account_revenue_id UUID,
  account_cogs_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CREDIT NOTES
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_note_no TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID NOT NULL,
  customer_name TEXT,
  customer_tax_no TEXT,
  branch_id UUID,
  cost_center_id UUID,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'applied', 'cancelled')),
  credit_note_type TEXT NOT NULL DEFAULT 'return' CHECK (credit_note_type IN ('return', 'correction', 'write_off', 'goodwill')),
  reason TEXT,
  reason_ar TEXT,
  subtotal NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(18,6) GENERATED ALWAYS AS (total - COALESCE(applied_amount, 0)) STORED,
  applied_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, credit_note_no)
);

CREATE TABLE IF NOT EXISTS credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_line_id UUID REFERENCES invoice_lines(id),
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  description TEXT,
  qty NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'piece',
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) DEFAULT 0,
  discount_amount NUMERIC(18,6) DEFAULT 0,
  tax_rate NUMERIC(18,6) DEFAULT 0,
  tax_amount NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CUSTOMER PAYMENTS
CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_no TEXT NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'wallet', 'pos', 'online')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(18,6) NOT NULL,
  unallocated_amount NUMERIC(18,6) GENERATED ALWAYS AS (amount - COALESCE(allocated_amount, 0)) STORED,
  allocated_amount NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  reference TEXT,
  cheque_no TEXT,
  cheque_date DATE,
  bank_account TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed', 'cancelled')),
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, payment_no)
);

-- 6. PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  credit_note_id UUID REFERENCES credit_notes(id),
  amount NUMERIC(18,6) NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 7. CUSTOMER WALLETS
CREATE TABLE IF NOT EXISTS customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL UNIQUE,
  balance NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(18,6) DEFAULT 0,
  available_balance NUMERIC(18,6) GENERATED ALWAYS AS (balance + COALESCE(credit_limit, 0)) STORED,
  currency TEXT NOT NULL DEFAULT 'SAR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, customer_id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES customer_wallets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment', 'refund', 'credit_note', 'adjustment', 'fee', 'transfer')),
  amount NUMERIC(18,6) NOT NULL,
  balance_before NUMERIC(18,6) NOT NULL,
  balance_after NUMERIC(18,6) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SHIPMENTS
CREATE TABLE IF NOT EXISTS sales_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shipment_no TEXT NOT NULL,
  order_id UUID REFERENCES sales_orders(id),
  invoice_id UUID REFERENCES invoices(id),
  warehouse_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  customer_name TEXT,
  shipping_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picking', 'packed', 'shipped', 'delivered', 'returned', 'cancelled')),
  carrier TEXT,
  tracking_no TEXT,
  shipped_date TIMESTAMPTZ,
  delivered_date TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, shipment_no)
);

CREATE TABLE IF NOT EXISTS shipment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES sales_shipments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES sales_order_lines(id),
  item_id UUID NOT NULL,
  item_code TEXT,
  item_name TEXT,
  qty NUMERIC(18,6) NOT NULL,
  qty_delivered NUMERIC(18,6) NOT NULL DEFAULT 0,
  warehouse_id UUID,
  batch_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. RETURNS
CREATE TABLE IF NOT EXISTS sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  return_no TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  order_id UUID REFERENCES sales_orders(id),
  shipment_id UUID REFERENCES sales_shipments(id),
  customer_id UUID NOT NULL,
  customer_name TEXT,
  branch_id UUID,
  warehouse_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'received', 'completed', 'cancelled')),
  return_type TEXT NOT NULL DEFAULT 'full' CHECK (return_type IN ('full', 'partial', 'replacement', 'warranty')),
  reason TEXT,
  reason_ar TEXT,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_note_id UUID REFERENCES credit_notes(id),
  created_by UUID,
  approved_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, return_no)
);

CREATE TABLE IF NOT EXISTS return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_line_id UUID REFERENCES invoice_lines(id),
  item_id UUID NOT NULL,
  item_code TEXT,
  item_name TEXT,
  qty NUMERIC(18,6) NOT NULL,
  unit_price NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) DEFAULT 0,
  total NUMERIC(18,6) NOT NULL DEFAULT 0,
  condition TEXT CHECK (condition IN ('new', 'good', 'damaged', 'defective')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PRICING RULES
CREATE TABLE IF NOT EXISTS sales_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  type TEXT NOT NULL CHECK (type IN ('item_discount', 'order_discount', 'buy_x_get_y', 'volume', 'promotion', 'customer_group')),
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  apply_to TEXT NOT NULL DEFAULT 'all' CHECK (apply_to IN ('all', 'item', 'category', 'customer', 'customer_group')),
  apply_value TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_item')),
  discount_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  min_qty NUMERIC(18,6),
  max_discount_amount NUMERIC(18,6),
  valid_from DATE,
  valid_to DATE,
  days_of_week INTEGER[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 11. CREDIT LIMITS
CREATE TABLE IF NOT EXISTS customer_credit_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  credit_limit NUMERIC(18,6) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,6) NOT NULL DEFAULT 0,
  available_credit NUMERIC(18,6) GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_terms INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  risk_score TEXT DEFAULT 'normal' CHECK (risk_score IN ('low', 'normal', 'high', 'critical')),
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, customer_id)
);

-- 12. INTEGRITY LOGS
CREATE TABLE IF NOT EXISTS sales_integrity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  description TEXT,
  details JSONB DEFAULT '{}',
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation ON quotation_lines(quotation_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(company_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order ON sales_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(company_id, due_date) WHERE status NOT IN ('paid', 'cancelled', 'reversed');
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_lines_note ON credit_note_lines(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_status ON customer_payments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_order ON sales_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_status ON sales_shipments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_shipment ON shipment_lines(shipment_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_return_lines_return ON return_lines(return_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON sales_pricing_rules(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_credit_limits_customer ON customer_credit_limits(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_integrity_logs ON sales_integrity_logs(company_id, detected_at DESC);

-- ============================================================
-- IMMUTABLE INVOICE POSTING TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION fn_invoice_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'posted' AND NEW.status NOT IN ('partially_paid', 'paid', 'overdue', 'reversed') THEN
      RAISE EXCEPTION 'لا يمكن تعديل فاتورة مرحلة' USING ERRCODE = 'IM001';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'partially_paid', 'paid') THEN
      RAISE EXCEPTION 'لا يمكن حذف فاتورة مرحلة' USING ERRCODE = 'IM002';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoice_immutable
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_invoice_immutable();

-- ============================================================
-- IDEMPOTENCY TRIGGER (prevent duplicate source references)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sales_idempotent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->>'source_id' IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM invoices
      WHERE company_id = NEW.company_id
        AND metadata->>'source' = NEW.metadata->>'source'
        AND metadata->>'source_id' = NEW.metadata->>'source_id'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) THEN
      RAISE EXCEPTION 'فاتورة مكررة: % %', NEW.metadata->>'source', NEW.metadata->>'source_id' USING ERRCODE = 'IM003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_idempotent
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION fn_sales_idempotent();

-- ============================================================
-- AUDIT TRIGGERS (auto updated_at)
-- ============================================================
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_order_lines_updated_at BEFORE UPDATE ON sales_order_lines FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_credit_notes_updated_at BEFORE UPDATE ON credit_notes FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customer_payments_updated_at BEFORE UPDATE ON customer_payments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customer_wallets_updated_at BEFORE UPDATE ON customer_wallets FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_customer_credit_limits_updated_at BEFORE UPDATE ON customer_credit_limits FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_shipments_updated_at BEFORE UPDATE ON sales_shipments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_shipment_lines_updated_at BEFORE UPDATE ON shipment_lines FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_returns_updated_at BEFORE UPDATE ON sales_returns FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_sales_pricing_rules_updated_at BEFORE UPDATE ON sales_pricing_rules FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'quotations', 'quotation_lines', 'sales_orders', 'sales_order_lines',
    'invoices', 'invoice_lines', 'credit_notes', 'credit_note_lines',
    'customer_payments', 'payment_allocations', 'customer_wallets', 'wallet_transactions',
    'sales_shipments', 'shipment_lines', 'sales_returns', 'return_lines',
    'sales_pricing_rules', 'customer_credit_limits', 'sales_integrity_logs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY company_isolation ON %I USING (company_id = (SELECT current_company_id()::uuid)) WITH CHECK (company_id = (SELECT current_company_id()::uuid))',
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- RPC: GET CUSTOMER BALANCE
-- ============================================================
CREATE OR REPLACE FUNCTION get_customer_balance(
  p_company_id UUID,
  p_customer_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_receivable NUMERIC;
  v_total_paid NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total - paid_amount), 0) INTO v_total_receivable
  FROM invoices
  WHERE company_id = p_company_id
    AND customer_id = p_customer_id
    AND status NOT IN ('paid', 'cancelled', 'reversed');

  SELECT COALESCE(SUM(total - applied_amount), 0) INTO v_total_paid
  FROM credit_notes
  WHERE company_id = p_company_id
    AND customer_id = p_customer_id
    AND status = 'posted';

  RETURN v_total_receivable - v_total_paid;
END;
$$;

-- ============================================================
-- RPC: GET CUSTOMER AGING
-- ============================================================
CREATE OR REPLACE FUNCTION get_customer_aging(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  customer_id UUID,
  customer_name TEXT,
  total_balance NUMERIC,
  current_amount NUMERIC,
  days_1_30 NUMERIC,
  days_31_60 NUMERIC,
  days_61_90 NUMERIC,
  days_90_plus NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.customer_id,
    i.customer_name,
    SUM(i.balance_due) AS total_balance,
    SUM(CASE WHEN (p_as_of_date - i.due_date) <= 0 THEN i.balance_due ELSE 0 END) AS current_amount,
    SUM(CASE WHEN (p_as_of_date - i.due_date) BETWEEN 1 AND 30 THEN i.balance_due ELSE 0 END) AS days_1_30,
    SUM(CASE WHEN (p_as_of_date - i.due_date) BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) AS days_31_60,
    SUM(CASE WHEN (p_as_of_date - i.due_date) BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) AS days_61_90,
    SUM(CASE WHEN (p_as_of_date - i.due_date) > 90 THEN i.balance_due ELSE 0 END) AS days_90_plus
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.status NOT IN ('paid', 'cancelled', 'reversed')
    AND i.balance_due > 0
  GROUP BY i.customer_id, i.customer_name
  ORDER BY total_balance DESC;
END;
$$;

-- ============================================================
-- RPC: GET SALES SUMMARY
-- ============================================================
CREATE OR REPLACE FUNCTION get_sales_summary(
  p_company_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  period_date DATE,
  invoice_count BIGINT,
  total_sales NUMERIC,
  total_tax NUMERIC,
  total_discount NUMERIC,
  net_sales NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.invoice_date AS period_date,
    COUNT(*)::BIGINT AS invoice_count,
    SUM(i.subtotal) AS total_sales,
    SUM(i.tax_amount) AS total_tax,
    SUM(i.discount_amount) AS total_discount,
    SUM(i.total) AS net_sales
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.status NOT IN ('cancelled', 'reversed')
    AND i.invoice_date BETWEEN p_from_date AND p_to_date
  GROUP BY i.invoice_date
  ORDER BY i.invoice_date DESC;
END;
$$;
