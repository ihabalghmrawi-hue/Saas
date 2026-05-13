-- ============================================================
-- Materialized View & RPC Validation Tests
-- اختبارات التحقق من العرض المادي وإجراءات RPC
-- Run in Supabase SQL Editor
-- ============================================================

DO $$
DECLARE
  v_company_id     UUID;
  v_company2_id    UUID;
  v_cash_id        UUID;
  v_ar_id          UUID;
  v_ap_id          UUID;
  v_equipment_id   UUID;
  v_revenue_id     UUID;
  v_cogs_id        UUID;
  v_expense_id     UUID;
  v_capital_id     UUID;
  v_retained_id    UUID;
  v_net_income_id  UUID;
  v_je1_id         UUID;
  v_je2_id         UUID;
  v_je3_id         UUID;
  v_bs_result      JSONB;
  v_is_result      JSONB;
  v_cf_result      JSONB;
  v_tb_count       INT;
  v_is_count       INT;
  v_bs_count       INT;
  v_idx_count      INT;
  v_stale_balance  NUMERIC;
  v_fresh_balance  NUMERIC;
  v_idx_exists     BOOLEAN;
  v_error_msg      TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting MV/RPC Validation Tests';
  RAISE NOTICE 'بدء اختبارات التحقق من العرض المادي';
  RAISE NOTICE '========================================';

  -- ═══════════════════════════════════════════════════
  -- 1. TEST DATA SETUP - إعداد بيانات الاختبار
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '1. Setting up test data...';
  RAISE NOTICE '١. جاري إعداد بيانات الاختبار...';

  -- Create test companies
  INSERT INTO companies (id, name, slug, currency, language)
  VALUES (gen_random_uuid(), 'Test Co Alpha', 'test-alpha', 'SAR', 'ar')
  RETURNING id INTO v_company_id;

  INSERT INTO companies (id, name, slug, currency, language)
  VALUES (gen_random_uuid(), 'Test Co Beta', 'test-beta', 'SAR', 'ar')
  RETURNING id INTO v_company2_id;

  RAISE NOTICE '  Created companies: %, %', v_company_id, v_company2_id;

  -- Create chart of accounts for company 1
  INSERT INTO accounts (company_id, code, name, name_ar, type, normal_balance, opening_balance, is_active)
  VALUES
    (v_company_id, '1101', 'Cash', 'نقدية', 'asset', 'debit', 0, true),
    (v_company_id, '1110', 'Accounts Receivable', 'ذمم مدينة', 'asset', 'debit', 0, true),
    (v_company_id, '1201', 'Equipment', 'معدات', 'asset', 'debit', 0, true),
    (v_company_id, '2101', 'Accounts Payable', 'ذمم دائنة', 'liability', 'credit', 0, true),
    (v_company_id, '3001', 'Capital', 'رأس المال', 'equity', 'credit', 100000, true),
    (v_company_id, '3002', 'Retained Earnings', 'أرباح مرحّلة', 'equity', 'credit', 25000, true),
    (v_company_id, '3003', 'Net Income', 'صافي الدخل', 'equity', 'credit', 0, true),
    (v_company_id, '4001', 'Sales Revenue', 'إيرادات المبيعات', 'revenue', 'credit', 0, true),
    (v_company_id, '5001', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', 'cogs', 'debit', 0, true),
    (v_company_id, '6501', 'Salaries Expense', 'مصروفات رواتب', 'expense', 'debit', 0, true)
  RETURNING array_agg(id) INTO v_cash_id;

  SELECT id INTO v_cash_id FROM accounts WHERE company_id = v_company_id AND code = '1101';
  SELECT id INTO v_ar_id FROM accounts WHERE company_id = v_company_id AND code = '1110';
  SELECT id INTO v_ap_id FROM accounts WHERE company_id = v_company_id AND code = '2101';
  SELECT id INTO v_equipment_id FROM accounts WHERE company_id = v_company_id AND code = '1201';
  SELECT id INTO v_revenue_id FROM accounts WHERE company_id = v_company_id AND code = '4001';
  SELECT id INTO v_cogs_id FROM accounts WHERE company_id = v_company_id AND code = '5001';
  SELECT id INTO v_expense_id FROM accounts WHERE company_id = v_company_id AND code = '6501';
  SELECT id INTO v_capital_id FROM accounts WHERE company_id = v_company_id AND code = '3001';
  SELECT id INTO v_retained_id FROM accounts WHERE company_id = v_company_id AND code = '3002';
  SELECT id INTO v_net_income_id FROM accounts WHERE company_id = v_company_id AND code = '3003';

  -- Create accounts for company 2 (minimal set for isolation testing)
  INSERT INTO accounts (company_id, code, name, name_ar, type, normal_balance, opening_balance, is_active)
  VALUES
    (v_company2_id, '1101', 'Cash', 'نقدية', 'asset', 'debit', 0, true),
    (v_company2_id, '4001', 'Sales', 'مبيعات', 'revenue', 'credit', 0, true);

  RAISE NOTICE '  Created chart of accounts';

  -- Post journal entry 1: Revenue transaction (100,000 SAR sale on credit)
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit)
  VALUES (v_company_id, 'JE-2024-0001', '2024-06-15', 'مبيعات آجلة - June Sales', 'posted', 100000, 100000)
  RETURNING id INTO v_je1_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES
    (v_je1_id, v_ar_id,    100000, 0,      1),
    (v_je1_id, v_revenue_id, 0,    100000, 2);

  -- Journal entry 2: Cash collection (30,000 SAR)
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit)
  VALUES (v_company_id, 'JE-2024-0002', '2024-06-20', 'تحصيل نقدي - Cash Collection', 'posted', 30000, 30000)
  RETURNING id INTO v_je2_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES
    (v_je2_id, v_cash_id, 30000, 0,     1),
    (v_je2_id, v_ar_id,   0,     30000, 2);

  -- Journal entry 3: Expenses (20,000 SAR salaries + 10,000 SAR COGS)
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit)
  VALUES (v_company_id, 'JE-2024-0003', '2024-06-25', 'مصروفات تشغيلية - Operating Expenses', 'posted', 30000, 30000)
  RETURNING id INTO v_je3_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES
    (v_je3_id, v_expense_id, 20000, 0,     1),
    (v_je3_id, v_cogs_id,    10000, 0,     2),
    (v_je3_id, v_cash_id,    0,     30000, 3);

  RAISE NOTICE '  Posted 3 journal entries';
  RAISE NOTICE '  JE1 (Sale): DR AR 100,000 / CR Revenue 100,000';
  RAISE NOTICE '  JE2 (Collection): DR Cash 30,000 / CR AR 30,000';
  RAISE NOTICE '  JE3 (Expenses): DR Salaries 20,000 + COGS 10,000 / CR Cash 30,000';

  -- ═══════════════════════════════════════════════════
  -- 2. REFRESH MATERIALIZED VIEWS - تحديث العروض المادية
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '2. Refreshing materialized views...';
  RAISE NOTICE '٢. جاري تحديث العروض المادية...';

  BEGIN
    PERFORM refresh_reporting_views();
    RAISE NOTICE '  refresh_reporting_views() completed successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: refresh_reporting_views() threw: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 3. VERIFY mv_trial_balance - التحقق من ميزان المراجعة
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '3. Verifying mv_trial_balance...';
  RAISE NOTICE '٣. جاري التحقق من ميزان المراجعة...';

  SELECT COUNT(*) INTO v_tb_count FROM mv_trial_balance WHERE company_id = v_company_id;

  IF v_tb_count = 0 THEN
    RAISE EXCEPTION 'FAIL: mv_trial_balance is empty for company %', v_company_id;
  ELSE
    RAISE NOTICE '  mv_trial_balance has % rows for company', v_tb_count;
  END IF;

  -- Verify cash account (1101): opening 0, DR 30000, CR 0 → balance 30000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_trial_balance
      WHERE company_id = v_company_id AND account_code = '1101'
        AND total_debit = 30000 AND total_credit = 0
    ) THEN
      RAISE EXCEPTION 'FAIL: Cash account (1101) has wrong totals in mv_trial_balance';
    END IF;
    RAISE NOTICE '  ✓ Cash (1101): DR 30,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Verify AR account (1110): DR 100,000 - CR 30,000 = DR 70,000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_trial_balance
      WHERE company_id = v_company_id AND account_code = '1110'
        AND total_debit = 100000 AND total_credit = 30000
    ) THEN
      RAISE EXCEPTION 'FAIL: AR account (1110) has wrong totals in mv_trial_balance';
    END IF;
    RAISE NOTICE '  ✓ AR (1110): DR 100,000 / CR 30,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Verify revenue account (4001): CR 100,000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_trial_balance
      WHERE company_id = v_company_id AND account_code = '4001'
        AND total_credit = 100000
    ) THEN
      RAISE EXCEPTION 'FAIL: Revenue account (4001) has wrong totals in mv_trial_balance';
    END IF;
    RAISE NOTICE '  ✓ Revenue (4001): CR 100,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Verify trial balance debit = credit
  BEGIN
    IF (
      SELECT COALESCE(SUM(total_debit), 0) - COALESCE(SUM(total_credit), 0)
      FROM mv_trial_balance WHERE company_id = v_company_id
    ) != 0 THEN
      RAISE EXCEPTION 'FAIL: Trial balance is not balanced in mv_trial_balance';
    END IF;
    RAISE NOTICE '  ✓ Trial balance is balanced ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 4. VERIFY mv_income_statement - التحقق من قائمة الدخل
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '4. Verifying mv_income_statement...';
  RAISE NOTICE '٤. جاري التحقق من قائمة الدخل...';

  SELECT COUNT(*) INTO v_is_count FROM mv_income_statement WHERE company_id = v_company_id;

  IF v_is_count = 0 THEN
    RAISE EXCEPTION 'FAIL: mv_income_statement is empty';
  END IF;
  RAISE NOTICE '  mv_income_statement has % rows', v_is_count;

  -- Revenue: net_amount = debit - credit = 0 - 100000 = -100000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_income_statement
      WHERE company_id = v_company_id AND account_code = '4001'
        AND net_amount = -100000 AND account_type = 'revenue'
    ) THEN
      RAISE EXCEPTION 'FAIL: Revenue net_amount should be -100,000';
    END IF;
    RAISE NOTICE '  ✓ Revenue net_amount = -100,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- COGS: net_amount = 10000 - 0 = 10000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_income_statement
      WHERE company_id = v_company_id AND account_code = '5001'
        AND net_amount = 10000 AND account_type = 'cogs'
    ) THEN
      RAISE EXCEPTION 'FAIL: COGS net_amount should be 10,000';
    END IF;
    RAISE NOTICE '  ✓ COGS net_amount = 10,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Expense: net_amount = 20000 - 0 = 20000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_income_statement
      WHERE company_id = v_company_id AND account_code = '6501'
        AND net_amount = 20000 AND account_type = 'expense'
    ) THEN
      RAISE EXCEPTION 'FAIL: Expense net_amount should be 20,000';
    END IF;
    RAISE NOTICE '  ✓ Expense net_amount = 20,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Verify fiscal year/month extraction
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_income_statement
      WHERE company_id = v_company_id AND fiscal_year = 2024 AND fiscal_month = 6
    ) THEN
      RAISE EXCEPTION 'FAIL: Fiscal year/month not extracted correctly (expected 2024/6)';
    END IF;
    RAISE NOTICE '  ✓ Fiscal year=2024, month=6 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 5. VERIFY mv_balance_sheet - التحقق من الميزانية العمومية
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '5. Verifying mv_balance_sheet...';
  RAISE NOTICE '٥. جاري التحقق من الميزانية العمومية...';

  SELECT COUNT(*) INTO v_bs_count FROM mv_balance_sheet WHERE company_id = v_company_id;

  IF v_bs_count = 0 THEN
    RAISE EXCEPTION 'FAIL: mv_balance_sheet is empty';
  END IF;
  RAISE NOTICE '  mv_balance_sheet has % rows', v_bs_count;

  -- Cash: opening_balance 0 + (30000 - 0) = 30000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_balance_sheet
      WHERE company_id = v_company_id AND account_code = '1101'
        AND calculated_balance = 30000
    ) THEN
      RAISE EXCEPTION 'FAIL: Cash calculated_balance should be 30,000';
    END IF;
    RAISE NOTICE '  ✓ Cash calculated_balance = 30,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Capital: opening_balance 100000 + (0 - 0) = 100000
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_balance_sheet
      WHERE company_id = v_company_id AND account_code = '3001'
        AND calculated_balance = 100000
    ) THEN
      RAISE EXCEPTION 'FAIL: Capital calculated_balance should be 100,000';
    END IF;
    RAISE NOTICE '  ✓ Capital calculated_balance = 100,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 6. TEST RPC: get_income_statement() - اختبار RPC قائمة الدخل
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '6. Testing get_income_statement() RPC...';
  RAISE NOTICE '٦. جاري اختبار RPC قائمة الدخل...';

  SELECT get_income_statement(v_company_id, '2024-01-01', '2024-12-31') INTO v_is_result;

  -- Validate revenue section
  BEGIN
    IF v_is_result IS NULL THEN
      RAISE EXCEPTION 'FAIL: get_income_statement() returned NULL';
    END IF;

    IF NOT (v_is_result ? 'revenue') THEN
      RAISE EXCEPTION 'FAIL: Income statement missing revenue section';
    END IF;

    IF jsonb_array_length(v_is_result->'revenue') = 0 THEN
      RAISE EXCEPTION 'FAIL: Revenue section is empty';
    END IF;

    RAISE NOTICE '  ✓ Revenue section present with items ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate COGS section
  BEGIN
    IF NOT (v_is_result ? 'cogs') THEN
      RAISE EXCEPTION 'FAIL: Income statement missing cogs section';
    END IF;
    RAISE NOTICE '  ✓ COGS section present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate expenses section
  BEGIN
    IF NOT (v_is_result ? 'expenses') THEN
      RAISE EXCEPTION 'FAIL: Income statement missing expenses section';
    END IF;
    RAISE NOTICE '  ✓ Expenses section present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate period fields
  BEGIN
    IF v_is_result->>'period_from' IS NULL OR v_is_result->>'period_to' IS NULL THEN
      RAISE EXCEPTION 'FAIL: Income statement missing period fields';
    END IF;
    RAISE NOTICE '  ✓ Period fields present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Revenue amount should be positive (ABS of net_amount)
  BEGIN
    IF (v_is_result->'revenue'->0->>'amount')::numeric <= 0 THEN
      RAISE EXCEPTION 'FAIL: Revenue amount should be positive';
    END IF;
    RAISE NOTICE '  ✓ Revenue amount is positive ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 7. TEST RPC: get_balance_sheet() - اختبار RPC الميزانية العمومية
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '7. Testing get_balance_sheet() RPC...';
  RAISE NOTICE '٧. جاري اختبار RPC الميزانية العمومية...';

  SELECT get_balance_sheet(v_company_id, '2024-12-31') INTO v_bs_result;

  -- Validate assets structure
  BEGIN
    IF v_bs_result IS NULL THEN
      RAISE EXCEPTION 'FAIL: get_balance_sheet() returned NULL';
    END IF;

    IF NOT (v_bs_result ? 'assets') THEN
      RAISE EXCEPTION 'FAIL: Balance sheet missing assets section';
    END IF;

    IF NOT (v_bs_result->'assets' ? 'current') THEN
      RAISE EXCEPTION 'FAIL: Assets missing current subsection';
    END IF;

    IF NOT (v_bs_result->'assets' ? 'fixed') THEN
      RAISE EXCEPTION 'FAIL: Assets missing fixed subsection';
    END IF;

    RAISE NOTICE '  ✓ Assets structure correct ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate liabilities structure
  BEGIN
    IF NOT (v_bs_result ? 'liabilities') THEN
      RAISE EXCEPTION 'FAIL: Balance sheet missing liabilities section';
    END IF;
    IF NOT (v_bs_result->'liabilities' ? 'current') THEN
      RAISE EXCEPTION 'FAIL: Liabilities missing current subsection';
    END IF;
    IF NOT (v_bs_result->'liabilities' ? 'long_term') THEN
      RAISE EXCEPTION 'FAIL: Liabilities missing long_term subsection';
    END IF;
    RAISE NOTICE '  ✓ Liabilities structure correct ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate equity structure
  BEGIN
    IF NOT (v_bs_result ? 'equity') THEN
      RAISE EXCEPTION 'FAIL: Balance sheet missing equity section';
    END IF;
    IF NOT (v_bs_result->'equity' ? 'capital') THEN
      RAISE EXCEPTION 'FAIL: Equity missing capital';
    END IF;
    IF NOT (v_bs_result->'equity' ? 'retained_earnings') THEN
      RAISE EXCEPTION 'FAIL: Equity missing retained_earnings';
    END IF;
    IF NOT (v_bs_result->'equity' ? 'net_income') THEN
      RAISE EXCEPTION 'FAIL: Equity missing net_income';
    END IF;
    RAISE NOTICE '  ✓ Equity structure correct ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate current asset classification (account_code LIKE '11%')
  BEGIN
    IF jsonb_array_length(v_bs_result->'assets'->'current') > 0 THEN
      IF (v_bs_result->'assets'->'current'->0->>'code') NOT LIKE '11%' THEN
        RAISE EXCEPTION 'FAIL: Current asset code should start with 11';
      END IF;
    END IF;
    RAISE NOTICE '  ✓ Current asset classification (11% prefix) ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate period_date
  BEGIN
    IF v_bs_result->>'period_date' IS NULL THEN
      RAISE EXCEPTION 'FAIL: Balance sheet missing period_date';
    END IF;
    RAISE NOTICE '  ✓ period_date present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 8. TEST RPC: get_cash_flow() - اختبار RPC قائمة التدفقات النقدية
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '8. Testing get_cash_flow() RPC...';
  RAISE NOTICE '٨. جاري اختبار RPC قائمة التدفقات النقدية...';

  SELECT get_cash_flow(v_company_id, '2024-01-01', '2024-12-31') INTO v_cf_result;

  -- Validate operating section
  BEGIN
    IF v_cf_result IS NULL THEN
      RAISE EXCEPTION 'FAIL: get_cash_flow() returned NULL';
    END IF;

    IF NOT (v_cf_result ? 'operating') THEN
      RAISE EXCEPTION 'FAIL: Cash flow missing operating section';
    END IF;

    IF NOT (v_cf_result ? 'investing') THEN
      RAISE EXCEPTION 'FAIL: Cash flow missing investing section';
    END IF;

    IF NOT (v_cf_result ? 'financing') THEN
      RAISE EXCEPTION 'FAIL: Cash flow missing financing section';
    END IF;

    IF NOT (v_cf_result ? 'net_change') THEN
      RAISE EXCEPTION 'FAIL: Cash flow missing net_change';
    END IF;

    RAISE NOTICE '  ✓ All sections present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate AR change calculation
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_cf_result->'operating'->'items') AS item
      WHERE item->>'code' = '1110'
    ) THEN
      RAISE EXCEPTION 'FAIL: Cash flow missing AR change item (code 1110)';
    END IF;
    RAISE NOTICE '  ✓ AR change (1110) present ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Validate net_change calculation: operating + investing + financing
  BEGIN
    IF (
      (v_cf_result->'operating'->>'total')::numeric +
      (v_cf_result->'investing'->>'total')::numeric +
      (v_cf_result->'financing'->>'total')::numeric
    ) != (v_cf_result->>'net_change')::numeric THEN
      RAISE EXCEPTION 'FAIL: net_change does not equal sum of sections';
    END IF;
    RAISE NOTICE '  ✓ net_change = sum of operating + investing + financing ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 9. TEST TENANT ISOLATION - اختبار عزل الشركات
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '9. Testing tenant isolation...';
  RAISE NOTICE '٩. جاري اختبار عزل الشركات...';

  BEGIN
    SELECT COUNT(*) INTO v_tb_count FROM mv_trial_balance WHERE company_id = v_company2_id;
    IF v_tb_count != 0 THEN
      RAISE EXCEPTION 'FAIL: Company 2 should have no trial balance entries (no journal entries posted)';
    END IF;
    RAISE NOTICE '  ✓ Tenant isolation works: company 2 has 0 rows ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 10. TEST STALE DATA DETECTION - اختبار اكتشاف البيانات القديمة
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '10. Testing stale data detection pattern...';
  RAISE NOTICE '١٠. جاري اختبار اكتشاف البيانات القديمة...';

  -- Get balance before new entry (MV should show stale data if not refreshed)
  SELECT COALESCE(calculated_balance, 0) INTO v_stale_balance
  FROM mv_balance_sheet WHERE company_id = v_company_id AND account_code = '1101';

  -- Post a new journal entry without refreshing MV
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit)
  VALUES (v_company_id, 'JE-2024-0004', '2024-07-01', 'إيداع إضافي - Additional Deposit', 'posted', 50000, 50000)
  RETURNING id INTO v_je1_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES
    (v_je1_id, v_cash_id, 50000, 0, 1),
    (v_je1_id, v_revenue_id, 0, 50000, 2);

  -- Before refresh, MV should still show old balance
  SELECT COALESCE(calculated_balance, 0) INTO v_fresh_balance
  FROM mv_balance_sheet WHERE company_id = v_company_id AND account_code = '1101';

  IF v_stale_balance != v_fresh_balance THEN
    RAISE NOTICE '  ⚠ MV auto-refreshed? stale=% fresh=%', v_stale_balance, v_fresh_balance;
  ELSE
    RAISE NOTICE '  ✓ Stale data confirmed: MV unchanged (%) after new post ✓', v_stale_balance;
  END IF;

  -- Now refresh and verify
  BEGIN
    PERFORM refresh_reporting_views();
    RAISE NOTICE '  ✓ refresh_reporting_views() called ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: refresh_reporting_views() failed: %', SQLERRM;
  END;

  SELECT COALESCE(calculated_balance, 0) INTO v_fresh_balance
  FROM mv_balance_sheet WHERE company_id = v_company_id AND account_code = '1101';

  IF v_fresh_balance <= v_stale_balance THEN
    RAISE EXCEPTION 'FAIL: Balance should have increased after refresh (was %, now %)', v_stale_balance, v_fresh_balance;
  END IF;
  RAISE NOTICE '  ✓ After refresh: Cash balance updated to % ✓', v_fresh_balance;

  -- ═══════════════════════════════════════════════════
  -- 11. TEST CONCURRENT REFRESH SAFETY - اختبار أمان التحديث المتزامن
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '11. Testing concurrent refresh safety...';
  RAISE NOTICE '١١. جاري اختبار أمان التحديث المتزامن...';

  -- Test that refresh_reporting_views can be called multiple times safely
  BEGIN
    PERFORM refresh_reporting_views();
    PERFORM refresh_reporting_views();
    PERFORM refresh_reporting_views();
    RAISE NOTICE '  ✓ Sequential refresh_reporting_views() calls succeeded ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: Sequential refresh failed: %', SQLERRM;
  END;

  -- Verify MV contents survived sequential refreshes without data loss or corruption
  BEGIN
    SELECT COUNT(*) INTO v_tb_count FROM mv_trial_balance WHERE company_id = v_company_id;
    IF v_tb_count = 0 THEN
      RAISE EXCEPTION 'FAIL: mv_trial_balance empty after concurrent refresh';
    END IF;
    RAISE NOTICE '  ✓ mv_trial_balance has % rows after refreshes ✓', v_tb_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 12. VERIFY UNIQUE INDEXES - التحقق من وجود الفهارس الفريدة
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '12. Verifying materialized view indexes...';
  RAISE NOTICE '١٢. جاري التحقق من فهارس العرض المادي...';

  -- Check idx_mv_trial_balance_pk
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE indexname = 'idx_mv_trial_balance_pk';

  IF v_idx_count = 0 THEN
    RAISE EXCEPTION 'FAIL: idx_mv_trial_balance_pk does not exist';
  END IF;
  RAISE NOTICE '  ✓ idx_mv_trial_balance_pk exists ✓';

  -- Check idx_mv_income_statement_pk
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE indexname = 'idx_mv_income_statement_pk';

  IF v_idx_count = 0 THEN
    RAISE EXCEPTION 'FAIL: idx_mv_income_statement_pk does not exist';
  END IF;
  RAISE NOTICE '  ✓ idx_mv_income_statement_pk exists ✓';

  -- Check idx_mv_balance_sheet_pk
  SELECT COUNT(*) INTO v_idx_count
  FROM pg_indexes
  WHERE indexname = 'idx_mv_balance_sheet_pk';

  IF v_idx_count = 0 THEN
    RAISE EXCEPTION 'FAIL: idx_mv_balance_sheet_pk does not exist';
  END IF;
  RAISE NOTICE '  ✓ idx_mv_balance_sheet_pk exists ✓';

  -- Verify unique constraint on idx_mv_trial_balance_pk
  SELECT indisunique INTO v_idx_exists
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE c.relname = 'idx_mv_trial_balance_pk';

  IF NOT v_idx_exists THEN
    RAISE EXCEPTION 'FAIL: idx_mv_trial_balance_pk is not unique';
  END IF;
  RAISE NOTICE '  ✓ idx_mv_trial_balance_pk is unique ✓';

  -- ═══════════════════════════════════════════════════
  -- 13. TEST INCREMENTAL AGGREGATION - اختبار التجميع التدريجي
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '13. Testing incremental aggregation update...';
  RAISE NOTICE '١٣. جاري اختبار التجميع التدريجي...';

  -- Post another revenue entry
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit)
  VALUES (v_company_id, 'JE-2024-0005', '2024-07-15', 'مبيعات إضافية - Additional Sales', 'posted', 25000, 25000)
  RETURNING id INTO v_je2_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES
    (v_je2_id, v_ar_id,    25000, 0,     1),
    (v_je2_id, v_revenue_id, 0,   25000, 2);

  -- Refresh
  PERFORM refresh_reporting_views();

  -- Verify revenue total in income statement aggregated correctly
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM mv_income_statement
      WHERE company_id = v_company_id AND account_code = '4001'
        AND fiscal_year = 2024 AND fiscal_month = 7
        AND net_amount = -25000
    ) THEN
      RAISE EXCEPTION 'FAIL: Additional revenue not aggregated correctly in mv_income_statement';
    END IF;
    RAISE NOTICE '  ✓ July revenue aggregated correctly (net_amount = -25,000) ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- Verify total revenue across both months
  BEGIN
    IF (
      SELECT SUM(net_amount) FROM mv_income_statement
      WHERE company_id = v_company_id AND account_code = '4001'
    ) != -125000 THEN
      RAISE EXCEPTION 'FAIL: Total revenue mismatch (expected -125,000)';
    END IF;
    RAISE NOTICE '  ✓ Total revenue across all periods = -125,000 ✓';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: %', SQLERRM;
  END;

  -- ═══════════════════════════════════════════════════
  -- 14. CLEANUP - تنظيف بيانات الاختبار
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '14. Cleaning up test data...';
  RAISE NOTICE '١٤. جاري تنظيف بيانات الاختبار...';

  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE company_id IN (v_company_id, v_company2_id)
  );
  DELETE FROM journal_entries WHERE company_id IN (v_company_id, v_company2_id);
  DELETE FROM accounts WHERE company_id IN (v_company_id, v_company2_id);
  DELETE FROM companies WHERE id IN (v_company_id, v_company2_id);

  RAISE NOTICE '  ✓ Test data cleaned up ✓';

  -- ═══════════════════════════════════════════════════
  -- SUMMARY - ملخص النتائج
  -- ═══════════════════════════════════════════════════

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ALL TESTS PASSED SUCCESSFULLY';
  RAISE NOTICE 'جميع الاختبارات نجحت بنجاح';
  RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '========================================';
  RAISE WARNING 'TEST FAILED: %', SQLERRM;
  RAISE WARNING 'اختبار فشل: %', SQLERRM;
  RAISE WARNING '========================================';

  -- Cleanup even on failure
  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE company_id IN (v_company_id, v_company2_id)
  );
  DELETE FROM journal_entries WHERE company_id IN (v_company_id, v_company2_id);
  DELETE FROM accounts WHERE company_id IN (v_company_id, v_company2_id);
  DELETE FROM companies WHERE id IN (v_company_id, v_company2_id);

  RAISE EXCEPTION 'TEST FAILED: %', SQLERRM;
END;
$$;
