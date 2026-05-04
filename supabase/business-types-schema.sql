-- ════════════════════════════════════════════════
-- Business Type & Dynamic Feature Schema
-- ════════════════════════════════════════════════

-- Company settings (business type + misc config)
CREATE TABLE IF NOT EXISTS company_settings (
  company_id UUID PRIMARY KEY,
  business_type TEXT NOT NULL DEFAULT 'retail',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_company_settings" ON company_settings;
CREATE POLICY "allow_all_company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);

-- Extend products with pharmacy / expiry fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_qty INT DEFAULT 1;

-- Product variants (clothing: size/color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  sku TEXT,
  barcode TEXT,
  price_override NUMERIC(12,2),
  cost_override NUMERIC(12,2),
  stock INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_company ON product_variants(company_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_variants" ON product_variants;
CREATE POLICY "allow_all_variants" ON product_variants FOR ALL USING (true) WITH CHECK (true);

-- Bulk pricing tiers (wholesale)
CREATE TABLE IF NOT EXISTS product_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  min_qty INT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiers_product ON product_price_tiers(product_id);

ALTER TABLE product_price_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_tiers" ON product_price_tiers;
CREATE POLICY "allow_all_tiers" ON product_price_tiers FOR ALL USING (true) WITH CHECK (true);
