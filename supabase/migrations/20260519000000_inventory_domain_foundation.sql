-- ============================================================
-- INVENTORY & WAREHOUSE DOMAIN FOUNDATION
-- Enterprise-grade immutable stock movement architecture
-- ============================================================

-- 1. WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  type TEXT NOT NULL DEFAULT 'physical' CHECK (type IN ('physical', 'virtual', 'transit', 'consignment')),
  address TEXT,
  city TEXT,
  country TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  branch_id UUID,
  manager_id UUID,
  contact_phone TEXT,
  contact_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 2. WAREHOUSE LOCATIONS (bins/shelves/racks)
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  name_ar TEXT,
  type TEXT NOT NULL DEFAULT 'storage' CHECK (type IN ('receiving', 'storage', 'picking', 'shipping', 'quarantine', 'damaged', 'return')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pickable BOOLEAN NOT NULL DEFAULT true,
  max_weight NUMERIC(18,6),
  max_volume NUMERIC(18,6),
  zone TEXT,
  aisle TEXT,
  rack TEXT,
  shelf TEXT,
  barcode TEXT,
  parent_location_id UUID REFERENCES warehouse_locations(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- 3. INVENTORY ITEMS (master product catalog)
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'service', 'raw_material', 'wip', 'finished_good', 'consumable', 'asset', 'packaging')),
  unit TEXT NOT NULL DEFAULT 'piece',
  cost_method TEXT NOT NULL DEFAULT 'weighted_average' CHECK (cost_method IN ('fifo', 'weighted_average', 'standard')),
  standard_cost NUMERIC(18,6) DEFAULT 0,
  is_tracked BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_serialized BOOLEAN NOT NULL DEFAULT false,
  is_batch_tracked BOOLEAN NOT NULL DEFAULT false,
  has_expiry BOOLEAN NOT NULL DEFAULT false,
  shelf_life_days INTEGER,
  barcode TEXT,
  sku TEXT,
  tax_rate_id UUID,
  account_revenue_id UUID,
  account_cogs_id UUID,
  account_inventory_id UUID,
  image_url TEXT,
  weight NUMERIC(18,6),
  volume NUMERIC(18,6),
  category_id UUID,
  default_warehouse_id UUID REFERENCES warehouses(id),
  min_stock NUMERIC(18,6) DEFAULT 0,
  max_stock NUMERIC(18,6),
  reorder_point NUMERIC(18,6) DEFAULT 0,
  reorder_qty NUMERIC(18,6) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 4. INVENTORY VARIANTS
CREATE TABLE IF NOT EXISTS inventory_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  name_ar TEXT,
  sku TEXT,
  barcode TEXT,
  attributes JSONB DEFAULT '{}',
  unit TEXT NOT NULL DEFAULT 'piece',
  cost_method TEXT,
  standard_cost NUMERIC(18,6) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  weight NUMERIC(18,6),
  volume NUMERIC(18,6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 5. INVENTORY UNITS OF MEASURE
CREATE TABLE IF NOT EXISTS inventory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  name TEXT,
  name_ar TEXT,
  conversion_factor NUMERIC(18,6) NOT NULL DEFAULT 1,
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_purchase BOOLEAN NOT NULL DEFAULT false,
  is_sales BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(18,6),
  volume NUMERIC(18,6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, item_id, unit)
);

-- 6. INVENTORY BATCHES (lot tracking)
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_no TEXT NOT NULL,
  supplier_batch TEXT,
  manufacturing_date DATE,
  expiry_date DATE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  initial_qty NUMERIC(18,6) NOT NULL,
  available_qty NUMERIC(18,6) NOT NULL,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  location_id UUID REFERENCES warehouse_locations(id),
  warehouse_id UUID REFERENCES warehouses(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'expired', 'depleted', 'quarantine')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, batch_no)
);

-- 7. STOCK MOVEMENTS (IMMUTABLE - single source of truth)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_id UUID REFERENCES inventory_batches(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  to_location_id UUID REFERENCES warehouse_locations(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'receipt', 'issue', 'transfer_out', 'transfer_in', 'return',
    'adjustment_up', 'adjustment_down', 'reservation', 'unreservation',
    'manufacturing_issue', 'manufacturing_completion', 'scrap', 'write_off',
    'recount_up', 'recount_down', 'initial_balance'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'internal')),
  qty NUMERIC(18,6) NOT NULL,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_price NUMERIC(18,6),
  reference_type TEXT,
  reference_id UUID,
  reference_line_id UUID,
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  description TEXT,
  created_by UUID,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reversed_from_id UUID REFERENCES stock_movements(id),
  reversal_reason TEXT,
  metadata JSONB DEFAULT '{}',
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INVENTORY RESERVATIONS
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_id UUID REFERENCES inventory_batches(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id),
  order_id UUID,
  order_type TEXT,
  order_line_id UUID,
  qty NUMERIC(18,6) NOT NULL,
  qty_delivered NUMERIC(18,6) NOT NULL DEFAULT 0,
  qty_cancelled NUMERIC(18,6) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'soft' CHECK (type IN ('soft', 'hard', 'backorder')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partial', 'fulfilled', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ,
  created_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. INVENTORY ALLOCATIONS (picking assignments)
CREATE TABLE IF NOT EXISTS inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES inventory_reservations(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES inventory_batches(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id),
  picker_id UUID,
  order_line_id UUID,
  qty NUMERIC(18,6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'packed', 'shipped', 'cancelled')),
  picked_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INVENTORY TRANSFERS
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_no TEXT NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  from_branch_id UUID,
  to_branch_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_transit', 'received', 'cancelled', 'completed')),
  type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'inter_branch', 'return', 'direct')),
  requested_by UUID,
  approved_by UUID,
  received_by UUID,
  notes TEXT,
  notes_ar TEXT,
  expected_delivery_date DATE,
  received_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, transfer_no)
);

-- 11. TRANSFER LINES
CREATE TABLE IF NOT EXISTS transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_id UUID REFERENCES inventory_batches(id),
  from_location_id UUID REFERENCES warehouse_locations(id),
  to_location_id UUID REFERENCES warehouse_locations(id),
  qty NUMERIC(18,6) NOT NULL,
  qty_received NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. INVENTORY ADJUSTMENTS
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_no TEXT NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  type TEXT NOT NULL CHECK (type IN ('count', 'damage', 'expiry', 'correction', 'write_off', 'write_on', 'reclassify')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted', 'cancelled')),
  reason TEXT,
  reason_ar TEXT,
  reference_type TEXT,
  reference_id UUID,
  approved_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, adjustment_no)
);

-- 13. INVENTORY VALUATION LAYERS (FIFO support)
CREATE TABLE IF NOT EXISTS inventory_valuation_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_id UUID REFERENCES inventory_batches(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  layer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  qty_in NUMERIC(18,6) NOT NULL DEFAULT 0,
  qty_out NUMERIC(18,6) NOT NULL DEFAULT 0,
  qty_remaining NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost_in NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost_out NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_cost_remaining NUMERIC(18,6) NOT NULL DEFAULT 0,
  movement_id UUID REFERENCES stock_movements(id),
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. INVENTORY SNAPSHOTS
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  item_id UUID REFERENCES inventory_items(id),
  variant_id UUID REFERENCES inventory_variants(id),
  qty NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_value NUMERIC(18,6) NOT NULL DEFAULT 0,
  snapshot_type TEXT NOT NULL DEFAULT 'daily' CHECK (snapshot_type IN ('daily', 'weekly', 'monthly', 'manual', 'closing')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. INTEGRITY LOGS
CREATE TABLE IF NOT EXISTS inventory_integrity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  description TEXT,
  details JSONB DEFAULT '{}',
  item_id UUID REFERENCES inventory_items(id),
  warehouse_id UUID REFERENCES warehouses(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- 16. REORDER RULES
CREATE TABLE IF NOT EXISTS reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  min_stock NUMERIC(18,6) NOT NULL DEFAULT 0,
  max_stock NUMERIC(18,6),
  reorder_point NUMERIC(18,6) NOT NULL DEFAULT 0,
  reorder_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_generate BOOLEAN NOT NULL DEFAULT false,
  preferred_supplier_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, item_id, warehouse_id)
);

-- 17. COUNT SESSIONS
CREATE TABLE IF NOT EXISTS inventory_count_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  session_no TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cycle' CHECK (type IN ('full', 'cycle', 'spot', 'annual')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'approved', 'cancelled')),
  started_by UUID,
  completed_by UUID,
  approved_by UUID,
  notes TEXT,
  scheduled_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, session_no)
);

-- 18. COUNT LINES
CREATE TABLE IF NOT EXISTS inventory_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES inventory_count_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id),
  batch_id UUID REFERENCES inventory_batches(id),
  location_id UUID REFERENCES warehouse_locations(id),
  expected_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(18,6),
  variance_qty NUMERIC(18,6) GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  unit_cost NUMERIC(18,6) DEFAULT 0,
  variance_cost NUMERIC(18,6) GENERATED ALWAYS AS ((COALESCE(counted_qty, 0) - expected_qty) * COALESCE(unit_cost, 0)) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'counted', 'verified', 'adjusted', 'skipped')),
  counted_by UUID,
  verified_by UUID,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_warehouses_company ON warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse ON warehouse_locations(warehouse_id, is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_company ON warehouse_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company ON inventory_items(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(company_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory_items(company_id, type);
CREATE INDEX IF NOT EXISTS idx_inventory_variants_item ON inventory_variants(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variants_company ON inventory_variants(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item ON inventory_batches(item_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_batches_company ON inventory_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source ON stock_movements(source, source_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(company_id, movement_type, posted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_item ON inventory_reservations(item_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory_reservations(order_id, order_type);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_company ON inventory_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_allocations_reservation ON inventory_allocations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_company ON inventory_transfers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from ON inventory_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer ON transfer_lines(transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_company ON inventory_adjustments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_valuation_layers_item ON inventory_valuation_layers(item_id, warehouse_id, layer_date);
CREATE INDEX IF NOT EXISTS idx_valuation_layers_company ON inventory_valuation_layers(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date ON inventory_snapshots(company_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_logs_company ON inventory_integrity_logs(company_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_item ON reorder_rules(item_id, warehouse_id, is_active);
CREATE INDEX IF NOT EXISTS idx_count_sessions_company ON inventory_count_sessions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_count_lines_session ON inventory_count_lines(session_id);

-- ============================================================
-- IMMUTABLE STOCK MOVEMENT TRIGGER
-- Prevent updates/deletes on posted stock movements
-- ============================================================
CREATE OR REPLACE FUNCTION fn_stock_movement_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.posted_at IS NOT NULL AND NEW.posted_at IS NOT NULL THEN
      RAISE EXCEPTION 'لا يمكن تعديل حركة مخزون مرحلة' USING ERRCODE = 'IM001';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.posted_at IS NOT NULL THEN
      RAISE EXCEPTION 'لا يمكن حذف حركة مخزون مرحلة' USING ERRCODE = 'IM002';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_stock_movement_immutable
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_stock_movement_immutable();

-- ============================================================
-- AUDIT TRIGGER (auto updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_warehouse_locations_updated_at BEFORE UPDATE ON warehouse_locations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_variants_updated_at BEFORE UPDATE ON inventory_variants FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_batches_updated_at BEFORE UPDATE ON inventory_batches FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_transfers_updated_at BEFORE UPDATE ON inventory_transfers FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_transfer_lines_updated_at BEFORE UPDATE ON transfer_lines FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_adjustments_updated_at BEFORE UPDATE ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_reservations_updated_at BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_inventory_allocations_updated_at BEFORE UPDATE ON inventory_allocations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_reorder_rules_updated_at BEFORE UPDATE ON reorder_rules FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_count_sessions_updated_at BEFORE UPDATE ON inventory_count_sessions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_count_lines_updated_at BEFORE UPDATE ON inventory_count_lines FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- DUPLICATE MOVEMENT PREVENTION (idempotency)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_stock_movement_idempotent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM stock_movements
      WHERE company_id = NEW.company_id
        AND source = NEW.source
        AND source_id = NEW.source_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) THEN
      RAISE EXCEPTION 'حركة مخزون مكررة: % %', NEW.source, NEW.source_id USING ERRCODE = 'IM003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movement_idempotent
  BEFORE INSERT OR UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_stock_movement_idempotent();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_valuation_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_integrity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines ENABLE ROW LEVEL SECURITY;

-- Company-level isolation policy
CREATE OR REPLACE FUNCTION fn_inventory_rls_policy(table_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN format(
    'CREATE POLICY company_isolation ON %I USING (company_id = (SELECT current_company_id()::uuid)) WITH CHECK (company_id = (SELECT current_company_id()::uuid))',
    table_name
  );
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'warehouses', 'warehouse_locations', 'inventory_items', 'inventory_variants',
    'inventory_units', 'inventory_batches', 'stock_movements', 'inventory_reservations',
    'inventory_allocations', 'inventory_transfers', 'transfer_lines', 'inventory_adjustments',
    'inventory_valuation_layers', 'inventory_snapshots', 'inventory_integrity_logs',
    'reorder_rules', 'inventory_count_sessions', 'inventory_count_lines'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY company_isolation ON %I USING (company_id = (SELECT current_company_id()::uuid)) WITH CHECK (company_id = (SELECT current_company_id()::uuid))',
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- RPC: GET CURRENT STOCK (single item)
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_stock(
  p_company_id UUID,
  p_item_id UUID,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qty NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN direction = 'in' THEN qty
         WHEN direction = 'out' THEN -qty
         ELSE 0 END
  ), 0) INTO v_qty
  FROM stock_movements
  WHERE company_id = p_company_id
    AND item_id = p_item_id
    AND (p_warehouse_id IS NULL OR warehouse_id = p_warehouse_id)
    AND is_reversed = false;
  RETURN v_qty;
END;
$$;

-- ============================================================
-- RPC: GET WAREHOUSE BALANCES
-- ============================================================
CREATE OR REPLACE FUNCTION get_warehouse_balances(
  p_company_id UUID,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE(
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  warehouse_id UUID,
  warehouse_code TEXT,
  warehouse_name TEXT,
  current_qty NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH stock AS (
    SELECT
      sm.item_id,
      sm.warehouse_id,
      COALESCE(SUM(CASE WHEN sm.direction = 'in' THEN sm.qty ELSE 0 END), 0) AS in_qty,
      COALESCE(SUM(CASE WHEN sm.direction = 'out' THEN sm.qty ELSE 0 END), 0) AS out_qty,
      COALESCE(AVG(sm.unit_cost) FILTER (WHERE sm.direction = 'in' AND sm.unit_cost > 0), 0) AS avg_cost
    FROM stock_movements sm
    WHERE sm.company_id = p_company_id
      AND sm.is_reversed = false
      AND (p_warehouse_id IS NULL OR sm.warehouse_id = p_warehouse_id)
    GROUP BY sm.item_id, sm.warehouse_id
  )
  SELECT
    s.item_id,
    ii.code AS item_code,
    ii.name AS item_name,
    s.warehouse_id,
    w.code AS warehouse_code,
    w.name AS warehouse_name,
    (s.in_qty - s.out_qty) AS current_qty,
    s.avg_cost AS unit_cost,
    (s.in_qty - s.out_qty) * s.avg_cost AS total_value
  FROM stock s
  JOIN inventory_items ii ON ii.id = s.item_id
  JOIN warehouses w ON w.id = s.warehouse_id
  WHERE (s.in_qty - s.out_qty) != 0
  ORDER BY ii.code;
END;
$$;

-- ============================================================
-- RPC: GET MOVEMENT HISTORY
-- ============================================================
CREATE OR REPLACE FUNCTION get_movement_history(
  p_company_id UUID,
  p_item_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  movement_type TEXT,
  direction TEXT,
  qty NUMERIC,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  item_code TEXT,
  item_name TEXT,
  warehouse_code TEXT,
  batch_no TEXT,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.movement_type,
    sm.direction,
    sm.qty,
    sm.unit_cost,
    sm.total_cost,
    ii.code AS item_code,
    ii.name AS item_name,
    w.code AS warehouse_code,
    ib.batch_no,
    sm.reference_type,
    sm.reference_id,
    sm.description,
    sm.created_by,
    sm.posted_at,
    sm.created_at
  FROM stock_movements sm
  JOIN inventory_items ii ON ii.id = sm.item_id
  JOIN warehouses w ON w.id = sm.warehouse_id
  LEFT JOIN inventory_batches ib ON ib.id = sm.batch_id
  WHERE sm.company_id = p_company_id
    AND (p_item_id IS NULL OR sm.item_id = p_item_id)
    AND (p_warehouse_id IS NULL OR sm.warehouse_id = p_warehouse_id)
    AND (p_from_date IS NULL OR sm.posted_at::date >= p_from_date)
    AND (p_to_date IS NULL OR sm.posted_at::date <= p_to_date)
  ORDER BY sm.posted_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- RPC: INVENTORY TURNOVER ANALYSIS
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_turnover(
  p_company_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  avg_stock NUMERIC,
  total_issues NUMERIC,
  turnover_ratio NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH avg_stock AS (
    SELECT
      sm.item_id,
      AVG(ABS(COALESCE(SUM(CASE WHEN sm.direction = 'in' THEN sm.qty ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN sm.direction = 'out' THEN sm.qty ELSE 0 END), 0))) AS avg_qty
    FROM stock_movements sm
    WHERE sm.company_id = p_company_id
      AND sm.posted_at::date BETWEEN p_from_date AND p_to_date
    GROUP BY sm.item_id
  ),
  total_issues AS (
    SELECT
      sm.item_id,
      COALESCE(SUM(sm.qty), 0) AS total_issued
    FROM stock_movements sm
    WHERE sm.company_id = p_company_id
      AND sm.direction = 'out'
      AND sm.posted_at::date BETWEEN p_from_date AND p_to_date
    GROUP BY sm.item_id
  )
  SELECT
    ii.id AS item_id,
    ii.code AS item_code,
    ii.name AS item_name,
    COALESCE(a.avg_qty, 0) AS avg_stock,
    COALESCE(t.total_issued, 0) AS total_issues,
    CASE WHEN COALESCE(a.avg_qty, 0) > 0 THEN COALESCE(t.total_issued, 0) / a.avg_qty ELSE 0 END AS turnover_ratio
  FROM inventory_items ii
  LEFT JOIN avg_stock a ON a.item_id = ii.id
  LEFT JOIN total_issues t ON t.item_id = ii.id
  WHERE ii.company_id = p_company_id
    AND (COALESCE(a.avg_qty, 0) > 0 OR COALESCE(t.total_issued, 0) > 0)
  ORDER BY turnover_ratio DESC;
END;
$$;

-- ============================================================
-- RPC: INVENTORY AGING
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_aging(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  batch_no TEXT,
  received_date DATE,
  qty NUMERIC,
  unit_cost NUMERIC,
  total_value NUMERIC,
  age_days INTEGER,
  aging_bucket TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ii.id AS item_id,
    ii.code AS item_code,
    ii.name AS item_name,
    ib.batch_no,
    ib.received_date,
    ib.available_qty AS qty,
    ib.unit_cost,
    ib.available_qty * ib.unit_cost AS total_value,
    (p_as_of_date - ib.received_date) AS age_days,
    CASE
      WHEN (p_as_of_date - ib.received_date) <= 30 THEN '0-30'
      WHEN (p_as_of_date - ib.received_date) <= 60 THEN '31-60'
      WHEN (p_as_of_date - ib.received_date) <= 90 THEN '61-90'
      ELSE '90+'
    END AS aging_bucket
  FROM inventory_batches ib
  JOIN inventory_items ii ON ii.id = ib.item_id
  WHERE ib.company_id = p_company_id
    AND ib.available_qty > 0
    AND ib.is_active = true
  ORDER BY ib.received_date;
END;
$$;

-- ============================================================
-- RPC: GENERATE DAILY INVENTORY SNAPSHOT
-- ============================================================
CREATE OR REPLACE FUNCTION generate_inventory_snapshot(
  p_company_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO inventory_snapshots (company_id, snapshot_date, warehouse_id, item_id, variant_id, qty, unit_cost, total_value, snapshot_type)
  SELECT
    p_company_id,
    p_snapshot_date,
    wb.warehouse_id,
    wb.item_id,
    NULL::UUID,
    wb.current_qty,
    wb.unit_cost,
    wb.total_value,
    'daily'
  FROM get_warehouse_balances(p_company_id, p_warehouse_id) wb;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
