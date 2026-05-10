-- ============================================================
-- Inventory Management Functions
-- Atomic operations to prevent race conditions and negative stock
-- ============================================================

-- ── deduct_inventory: atomic inventory deduction ──────────────────────────────
-- Returns the new quantity or raises an exception if insufficient.

CREATE OR REPLACE FUNCTION deduct_inventory(
  p_company_id  uuid,
  p_product_id  uuid,
  p_quantity    numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_qty  numeric;
  v_new_qty      numeric;
BEGIN
  -- Lock the row for this product to prevent concurrent deductions
  SELECT quantity
  INTO   v_current_qty
  FROM   inventory
  WHERE  company_id = p_company_id
    AND  product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج غير موجود في المخزن (product_id: %)', p_product_id;
  END IF;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'المخزون غير كافٍ. متاح: %, مطلوب: %', v_current_qty, p_quantity;
  END IF;

  UPDATE inventory
  SET    quantity   = v_new_qty,
         updated_at = now()
  WHERE  company_id = p_company_id
    AND  product_id = p_product_id;

  RETURN v_new_qty;
END;
$$;

-- ── add_inventory: atomic inventory addition ──────────────────────────────────

CREATE OR REPLACE FUNCTION add_inventory(
  p_company_id  uuid,
  p_product_id  uuid,
  p_quantity    numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_qty numeric;
BEGIN
  INSERT INTO inventory(company_id, product_id, quantity, updated_at)
  VALUES (p_company_id, p_product_id, p_quantity, now())
  ON CONFLICT (company_id, product_id)
  DO UPDATE SET
    quantity   = inventory.quantity + p_quantity,
    updated_at = now()
  RETURNING quantity INTO v_new_qty;

  RETURN v_new_qty;
END;
$$;

-- ── transfer_inventory: move stock between warehouses ─────────────────────────

CREATE OR REPLACE FUNCTION transfer_inventory(
  p_company_id    uuid,
  p_product_id    uuid,
  p_from_warehouse uuid,
  p_to_warehouse   uuid,
  p_quantity      numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_qty numeric;
BEGIN
  -- Lock source
  SELECT quantity
  INTO   v_current_qty
  FROM   inventory
  WHERE  company_id    = p_company_id
    AND  product_id    = p_product_id
    AND  warehouse_id  = p_from_warehouse
  FOR UPDATE;

  IF NOT FOUND OR v_current_qty < p_quantity THEN
    RAISE EXCEPTION 'المخزون غير كافٍ في المستودع المصدر';
  END IF;

  -- Deduct from source
  UPDATE inventory
  SET    quantity   = quantity - p_quantity,
         updated_at = now()
  WHERE  company_id   = p_company_id
    AND  product_id   = p_product_id
    AND  warehouse_id = p_from_warehouse;

  -- Add to destination
  INSERT INTO inventory(company_id, product_id, warehouse_id, quantity, updated_at)
  VALUES (p_company_id, p_product_id, p_to_warehouse, p_quantity, now())
  ON CONFLICT (company_id, product_id, warehouse_id)
  DO UPDATE SET
    quantity   = inventory.quantity + p_quantity,
    updated_at = now();
END;
$$;

-- ── create_journal_entry_atomic: full transactional journal posting ───────────

CREATE OR REPLACE FUNCTION create_journal_entry_atomic(
  p_company_id     uuid,
  p_entry_number   text,
  p_date           date,
  p_description    text,
  p_reference      text,
  p_source         text,
  p_source_id      uuid,
  p_status         text,
  p_total_debit    numeric,
  p_total_credit   numeric,
  p_auto_generated boolean,
  p_lines          jsonb    -- [{account_id, debit, credit, description}]
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id   uuid;
  v_line       jsonb;
BEGIN
  -- Validate balance
  IF ABS(p_total_debit - p_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'القيد غير متوازن: مدين % ≠ دائن %', p_total_debit, p_total_credit;
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'القيد يجب أن يحتوي على سطرين على الأقل';
  END IF;

  -- Insert header
  INSERT INTO journal_entries(
    company_id, entry_number, date, description, reference,
    source, source_id, status, total_debit, total_credit,
    is_balanced, auto_generated, is_posted, posted_at
  )
  VALUES (
    p_company_id, p_entry_number, p_date, p_description, p_reference,
    p_source, p_source_id, p_status, p_total_debit, p_total_credit,
    true, p_auto_generated,
    p_auto_generated, CASE WHEN p_auto_generated THEN now() ELSE NULL END
  )
  RETURNING id INTO v_entry_id;

  -- Insert lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_entry_lines(
      journal_entry_id, account_id, debit, credit, description
    )
    VALUES (
      v_entry_id,
      (v_line->>'account_id')::uuid,
      (v_line->>'debit')::numeric,
      (v_line->>'credit')::numeric,
      v_line->>'description'
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$;
