-- ════════════════════════════════════════════════
-- Business Template Seeder
-- Seeds categories + sample products per business type
-- Usage: SELECT seed_business_template('company-id', 'pharmacy');
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION seed_business_template(
  p_company_id TEXT,
  p_business_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_cat_ids JSONB := '{}';
  v_cat_id UUID;
  v_result JSONB;
  v_cats_inserted INT := 0;
  v_prods_inserted INT := 0;
BEGIN

  -- ─── PHARMACY ────────────────────────────────
  IF p_business_type = 'pharmacy' THEN

    -- Categories
    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'painkillers',   'مسكنات الألم',    '#ef4444', true),
      (p_company_id::UUID, 'antibiotics',   'مضادات حيوية',    '#f97316', true),
      (p_company_id::UUID, 'vitamins',      'فيتامينات',        '#22c55e', true),
      (p_company_id::UUID, 'cold_flu',      'برد وإنفلونزا',   '#3b82f6', true),
      (p_company_id::UUID, 'skin_care',     'عناية بالبشرة',   '#a855f7', true),
      (p_company_id::UUID, 'baby',          'منتجات الأطفال',  '#ec4899', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    -- Get first category id for sample products
    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'painkillers' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, track_inventory, is_active, type, category_id, min_stock_level, expiry_date, batch_number)
    VALUES
      (p_company_id::UUID, 'Panadol 500mg', 'بنادول 500مج', 8, 12, true, true, 'product', v_cat_id, 20,
       (NOW() + INTERVAL '18 months')::DATE, 'BATCH-001'),
      (p_company_id::UUID, 'Aspirin 100mg', 'أسبرين 100مج', 5, 9, true, true, 'product', v_cat_id, 15,
       (NOW() + INTERVAL '24 months')::DATE, 'BATCH-002'),
      (p_company_id::UUID, 'Ibuprofen 400mg', 'إيبوبروفين 400مج', 10, 16, true, true, 'product', v_cat_id, 10,
       (NOW() + INTERVAL '20 months')::DATE, 'BATCH-003')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  -- ─── RETAIL (GROCERY) ────────────────────────
  ELSIF p_business_type = 'retail' THEN

    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'food',       'غذاء وأكل',      '#22c55e', true),
      (p_company_id::UUID, 'drinks',     'مشروبات',         '#3b82f6', true),
      (p_company_id::UUID, 'cleaning',   'منظفات',          '#f59e0b', true),
      (p_company_id::UUID, 'dairy',      'ألبان وأجبان',    '#fbbf24', true),
      (p_company_id::UUID, 'bakery',     'مخبوزات',         '#d97706', true),
      (p_company_id::UUID, 'snacks',     'مقرمشات وحلويات', '#ec4899', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'drinks' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, track_inventory, is_active, type, category_id, min_stock_level, barcode)
    VALUES
      (p_company_id::UUID, 'Water 1.5L',    'ماء معدني 1.5 لتر',  1,   2,   true, true, 'product', v_cat_id, 50, '6281234560001'),
      (p_company_id::UUID, 'Pepsi 330ml',   'بيبسي 330 مل',       2,   3.5, true, true, 'product', v_cat_id, 30, '6281234560002'),
      (p_company_id::UUID, 'Orange Juice',  'عصير برتقال 1L',     6,   10,  true, true, 'product', v_cat_id, 20, '6281234560003')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  -- ─── WHOLESALE ───────────────────────────────
  ELSIF p_business_type = 'wholesale' THEN

    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'food_bulk',    'مواد غذائية',    '#22c55e', true),
      (p_company_id::UUID, 'drinks_bulk',  'مشروبات',         '#3b82f6', true),
      (p_company_id::UUID, 'cleaning_bulk','منظفات ومواد',    '#f59e0b', true),
      (p_company_id::UUID, 'packaging',    'تغليف وعبوات',   '#8b5cf6', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'food_bulk' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, wholesale_price, track_inventory, is_active, type, category_id, min_stock_level, min_qty)
    VALUES
      (p_company_id::UUID, 'Rice 50kg Bag',     'أرز 50 كيلو',        180, 220, 200, true, true, 'product', v_cat_id, 10, 5),
      (p_company_id::UUID, 'Sugar 50kg Bag',    'سكر 50 كيلو',        160, 195, 178, true, true, 'product', v_cat_id, 10, 5),
      (p_company_id::UUID, 'Cooking Oil 20L',   'زيت طعام 20 لتر',   200, 250, 225, true, true, 'product', v_cat_id, 8,  3)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  -- ─── CLOTHING ────────────────────────────────
  ELSIF p_business_type = 'clothing' THEN

    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'men',      'رجالي',     '#3b82f6', true),
      (p_company_id::UUID, 'women',    'نسائي',     '#ec4899', true),
      (p_company_id::UUID, 'kids',     'أطفال',     '#22c55e', true),
      (p_company_id::UUID, 'shoes',    'أحذية',     '#f59e0b', true),
      (p_company_id::UUID, 'bags',     'حقائب',     '#a855f7', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'men' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, track_inventory, is_active, type, category_id, min_stock_level, has_variants)
    VALUES
      (p_company_id::UUID, 'Classic T-Shirt', 'تيشيرت كلاسيك',  40,  85,  true, true, 'product', v_cat_id, 5, true),
      (p_company_id::UUID, 'Jeans Pants',     'بنطلون جينز',     120, 250, true, true, 'product', v_cat_id, 3, true),
      (p_company_id::UUID, 'Polo Shirt',      'بولو شيرت',       60,  120, true, true, 'product', v_cat_id, 5, true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  -- ─── STATIONERY ──────────────────────────────
  ELSIF p_business_type = 'stationery' THEN

    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'pens',       'أقلام',           '#3b82f6', true),
      (p_company_id::UUID, 'notebooks',  'دفاتر وكراسات',  '#22c55e', true),
      (p_company_id::UUID, 'art',        'أدوات رسم وفن',  '#f59e0b', true),
      (p_company_id::UUID, 'office',     'لوازم مكتبية',   '#8b5cf6', true),
      (p_company_id::UUID, 'school',     'مستلزمات مدرسية','#ec4899', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'pens' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, track_inventory, is_active, type, category_id, min_stock_level)
    VALUES
      (p_company_id::UUID, 'Blue Pen',        'قلم جاف أزرق',    0.5, 1.5,  true, true, 'product', v_cat_id, 50),
      (p_company_id::UUID, 'Black Pen',       'قلم جاف أسود',    0.5, 1.5,  true, true, 'product', v_cat_id, 50),
      (p_company_id::UUID, 'Pencil HB',       'قلم رصاص HB',     0.3, 1,    true, true, 'product', v_cat_id, 50),
      (p_company_id::UUID, 'A4 Notebook 100p','دفتر A4 100 ورقة', 4,   8,   true, true, 'product', v_cat_id, 20)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  -- ─── TOOLS ───────────────────────────────────
  ELSIF p_business_type = 'tools' THEN

    INSERT INTO product_categories (company_id, name, name_ar, color, is_active)
    VALUES
      (p_company_id::UUID, 'hand_tools',    'أدوات يدوية',    '#f59e0b', true),
      (p_company_id::UUID, 'electric',      'أدوات كهربائية', '#3b82f6', true),
      (p_company_id::UUID, 'plumbing',      'سباكة',           '#22c55e', true),
      (p_company_id::UUID, 'paint',         'دهانات',          '#ec4899', true),
      (p_company_id::UUID, 'spare_parts',   'قطع غيار',        '#8b5cf6', true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_cats_inserted = ROW_COUNT;

    SELECT id INTO v_cat_id FROM product_categories
    WHERE company_id = p_company_id::UUID AND name = 'hand_tools' LIMIT 1;

    INSERT INTO products (company_id, name, name_ar, cost_price, sale_price, track_inventory, is_active, type, category_id, min_stock_level)
    VALUES
      (p_company_id::UUID, 'Hammer',       'مطرقة',        15, 30, true, true, 'product', v_cat_id, 5),
      (p_company_id::UUID, 'Screwdriver',  'مفك براغي',    8,  18, true, true, 'product', v_cat_id, 10),
      (p_company_id::UUID, 'Wrench 12"',   'مفتاح إنجليزي 12', 25, 55, true, true, 'product', v_cat_id, 5)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_prods_inserted = ROW_COUNT;

  END IF;

  v_result := jsonb_build_object(
    'business_type', p_business_type,
    'categories_inserted', v_cats_inserted,
    'products_inserted', v_prods_inserted
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
