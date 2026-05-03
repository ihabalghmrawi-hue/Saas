-- ============================================================
-- ERP COMPLETE SCHEMA - Run after base schema
-- ============================================================

-- ============================================================
-- PRODUCTS & INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  parent_id UUID REFERENCES product_categories(id),
  icon VARCHAR(50),
  color VARCHAR(20) DEFAULT '#3B82F6',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  name_ar VARCHAR(50),
  abbreviation VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_categories(id),
  unit_id UUID REFERENCES units(id),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  description TEXT,
  type VARCHAR(20) DEFAULT 'product' CHECK (type IN ('product', 'service', 'bundle')),
  cost_price DECIMAL(15,2) DEFAULT 0,
  sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  wholesale_price DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  has_variants BOOLEAN DEFAULT false,
  track_inventory BOOLEAN DEFAULT true,
  min_stock_level DECIMAL(15,3) DEFAULT 0,
  max_stock_level DECIMAL(15,3) DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku),
  UNIQUE(company_id, barcode)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  attributes JSONB DEFAULT '{}', -- {"color": "red", "size": "XL"}
  cost_price DECIMAL(15,2),
  sale_price DECIMAL(15,2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  location TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quantity DECIMAL(15,3) DEFAULT 0,
  reserved_quantity DECIMAL(15,3) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, variant_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('purchase', 'sale', 'return_sale', 'return_purchase', 'adjustment', 'transfer_in', 'transfer_out', 'opening')),
  quantity DECIMAL(15,3) NOT NULL,
  quantity_before DECIMAL(15,3) DEFAULT 0,
  quantity_after DECIMAL(15,3) DEFAULT 0,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  tax_number VARCHAR(100),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  tax_number VARCHAR(100),
  balance DECIMAL(15,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES (POS)
-- ============================================================

CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  change_amount DECIMAL(15,2) DEFAULT 0,
  due_amount DECIMAL(15,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'refunded')),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled', 'returned')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash', 'card', 'wallet', 'bank_transfer', 'credit')),
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  purchase_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_amount DECIMAL(15,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  status VARCHAR(20) DEFAULT 'received' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash', 'card', 'wallet', 'bank_transfer', 'credit')),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  icon VARCHAR(50),
  color VARCHAR(20) DEFAULT '#EF4444',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) DEFAULT 'cash',
  reference VARCHAR(100),
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(company_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_company ON inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required)
CREATE POLICY "allow_all_product_categories" ON product_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_product_variants" ON product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_units" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_warehouses" ON warehouses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sale_items" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sale_payments" ON sale_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_purchases" ON purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_purchase_items" ON purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_purchase_payments" ON purchase_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- Also fix existing tables to allow all (no auth)
DROP POLICY IF EXISTS "Users can view their companies" ON companies;
DROP POLICY IF EXISTS "Users can update their companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can view their memberships" ON memberships;
DROP POLICY IF EXISTS "Users can insert memberships" ON memberships;
DROP POLICY IF EXISTS "Users can view company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete company transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage categories" ON categories;
DROP POLICY IF EXISTS "Users can manage accounts" ON accounts;
DROP POLICY IF EXISTS "Users can manage parties" ON parties;
DROP POLICY IF EXISTS "Users can manage journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can manage journal entry lines" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can manage wallets" ON wallets;
DROP POLICY IF EXISTS "Users can manage wallet transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Users can manage reports cache" ON reports_cache;

CREATE POLICY "allow_all_companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_memberships" ON memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_parties" ON parties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_journal_entries" ON journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_journal_entry_lines" ON journal_entry_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wallets" ON wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wallet_transactions" ON wallet_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reports_cache" ON reports_cache FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory (product_id, warehouse_id, company_id, quantity)
    VALUES (NEW.product_id, (SELECT warehouse_id FROM sales WHERE id = NEW.sale_id),
            (SELECT company_id FROM sales WHERE id = NEW.sale_id), -NEW.quantity)
    ON CONFLICT (product_id, warehouse_id, variant_id)
    DO UPDATE SET quantity = inventory.quantity - NEW.quantity, updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inventory_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id UUID;
  v_company_id UUID;
BEGIN
  SELECT warehouse_id, company_id INTO v_warehouse_id, v_company_id
  FROM purchases WHERE id = NEW.purchase_id;

  INSERT INTO inventory (product_id, warehouse_id, company_id, quantity)
  VALUES (NEW.product_id, v_warehouse_id, v_company_id, NEW.quantity)
  ON CONFLICT (product_id, warehouse_id, variant_id)
  DO UPDATE SET quantity = inventory.quantity + NEW.quantity, updated_at = NOW();

  -- Update product cost price
  UPDATE products SET cost_price = NEW.unit_cost WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEQUENCE FOR INVOICE NUMBERS
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invoice_number(p_company_id UUID, p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_number TEXT;
BEGIN
  IF p_prefix = 'INV' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM sales WHERE company_id = p_company_id;
  ELSE
    SELECT COUNT(*) + 1 INTO v_count FROM purchases WHERE company_id = p_company_id;
  END IF;

  v_number := p_prefix || '-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ERP DEFAULT SEED DATA
-- ============================================================

CREATE OR REPLACE FUNCTION create_erp_default_data(p_company_id UUID)
RETURNS void AS $$
BEGIN
  -- Default warehouse
  INSERT INTO warehouses (company_id, name, name_ar, is_default)
  VALUES (p_company_id, 'Main Warehouse', 'المستودع الرئيسي', true)
  ON CONFLICT DO NOTHING;

  -- Default units
  INSERT INTO units (company_id, name, name_ar, abbreviation)
  VALUES
    (p_company_id, 'Piece', 'قطعة', 'قطعة'),
    (p_company_id, 'Box', 'صندوق', 'صندوق'),
    (p_company_id, 'Kilogram', 'كيلو', 'كغ'),
    (p_company_id, 'Liter', 'لتر', 'لتر'),
    (p_company_id, 'Meter', 'متر', 'م')
  ON CONFLICT DO NOTHING;

  -- Default product categories
  INSERT INTO product_categories (company_id, name, name_ar, color)
  VALUES
    (p_company_id, 'General', 'عام', '#6B7280'),
    (p_company_id, 'Food & Beverages', 'أغذية ومشروبات', '#10B981'),
    (p_company_id, 'Electronics', 'إلكترونيات', '#3B82F6'),
    (p_company_id, 'Clothing', 'ملابس', '#8B5CF6'),
    (p_company_id, 'Medicines', 'أدوية', '#EF4444')
  ON CONFLICT DO NOTHING;

  -- Default expense categories
  INSERT INTO expense_categories (company_id, name, name_ar, icon, color)
  VALUES
    (p_company_id, 'Rent', 'إيجار', 'home', '#EF4444'),
    (p_company_id, 'Salaries', 'رواتب', 'users', '#F59E0B'),
    (p_company_id, 'Utilities', 'فواتير', 'zap', '#3B82F6'),
    (p_company_id, 'Transport', 'نقل', 'car', '#10B981'),
    (p_company_id, 'Marketing', 'تسويق', 'megaphone', '#8B5CF6'),
    (p_company_id, 'Other', 'أخرى', 'more-horizontal', '#6B7280')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
