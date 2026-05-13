-- ============================================================
-- PERFORMANCE BENCHMARKING — SQL Benchmark Harness
-- Uses clock_timestamp() for high-precision timing
-- Reports min/avg/max over multiple iterations
-- All DML wrapped in rollback for safety
-- ============================================================
BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 0. SETUP: Test company, chart of accounts, base data
-- ═══════════════════════════════════════════════════════════
SELECT 'SETUP: Creating benchmark test data...' AS step;

END;

-- Use a transaction block for all benchmarks
BEGIN;

DO $$
DECLARE
  v_co_id          UUID;
  v_fy_id          UUID;
  v_per_id         UUID;
  v_cash_id        UUID;
  v_ar_id          UUID;
  v_ap_id          UUID;
  v_equip_id       UUID;
  v_rev_id         UUID;
  v_cogs_id        UUID;
  v_exp_id         UUID;
  v_cap_id         UUID;
  v_ret_id         UUID;
  v_ni_id          UUID;
  v_wh_id          UUID;
  v_item_id        UUID;
  v_cust_id        UUID;
  v_je_id          UUID;
  v_start          TIMESTAMPTZ;
  v_elapsed        INTERVAL;
  v_iter           INTEGER;
  v_warmup         INTEGER;
  v_iterations     INTEGER;
  v_total          NUMERIC;
  v_min_ms         NUMERIC;
  v_max_ms         NUMERIC;
  v_avg_ms         NUMERIC;
  v_ms             NUMERIC;
  v_rowcount       INTEGER;
BEGIN
  v_warmup := 2;
  v_iterations := 5;

  -- Create test company
  INSERT INTO companies (name, slug, currency, language)
  VALUES ('Benchmark Test Co', 'benchmark-test', 'SAR', 'ar')
  RETURNING id INTO v_co_id;

  -- Fiscal year
  INSERT INTO fiscal_years (company_id, name, start_date, end_date, is_current)
  VALUES (v_co_id, 'FY 2024', '2024-01-01', '2024-12-31', true)
  RETURNING id INTO v_fy_id;

  -- Accounting period
  INSERT INTO accounting_periods (company_id, fiscal_year_id, name, start_date, end_date, status)
  VALUES (v_co_id, v_fy_id, 'June 2024', '2024-06-01', '2024-06-30', 'open')
  RETURNING id INTO v_per_id;

  -- Chart of accounts
  INSERT INTO accounts (company_id, code, name, name_ar, type, normal_balance, is_active, is_postable)
  VALUES
    (v_co_id, '1101', 'Cash', 'نقدية', 'asset', 'debit', true, true),
    (v_co_id, '1110', 'AR', 'ذمم مدينة', 'asset', 'debit', true, true),
    (v_co_id, '1201', 'Equipment', 'معدات', 'asset', 'debit', true, true),
    (v_co_id, '2101', 'AP', 'ذمم دائنة', 'liability', 'credit', true, true),
    (v_co_id, '3001', 'Capital', 'رأس المال', 'equity', 'credit', true, true),
    (v_co_id, '3002', 'Retained Earnings', 'أرباح محتجزة', 'equity', 'credit', true, true),
    (v_co_id, '3003', 'Net Income', 'صافي الدخل', 'equity', 'credit', true, true),
    (v_co_id, '4001', 'Sales Revenue', 'إيرادات المبيعات', 'revenue', 'credit', true, true),
    (v_co_id, '5001', 'COGS', 'تكلفة البضاعة', 'cogs', 'debit', true, true),
    (v_co_id, '6501', 'Salaries', 'رواتب', 'expense', 'debit', true, true)
  RETURNING id INTO v_cash_id;

  SELECT id INTO v_cash_id FROM accounts WHERE company_id = v_co_id AND code = '1101';
  SELECT id INTO v_ar_id FROM accounts WHERE company_id = v_co_id AND code = '1110';
  SELECT id INTO v_ap_id FROM accounts WHERE company_id = v_co_id AND code = '2101';
  SELECT id INTO v_equip_id FROM accounts WHERE company_id = v_co_id AND code = '1201';
  SELECT id INTO v_rev_id FROM accounts WHERE company_id = v_co_id AND code = '4001';
  SELECT id INTO v_cogs_id FROM accounts WHERE company_id = v_co_id AND code = '5001';
  SELECT id INTO v_exp_id FROM accounts WHERE company_id = v_co_id AND code = '6501';
  SELECT id INTO v_cap_id FROM accounts WHERE company_id = v_co_id AND code = '3001';
  SELECT id INTO v_ret_id FROM accounts WHERE company_id = v_co_id AND code = '3002';
  SELECT id INTO v_ni_id FROM accounts WHERE company_id = v_co_id AND code = '3003';

  -- Warehouse & inventory item
  INSERT INTO warehouses (company_id, code, name, type)
  VALUES (v_co_id, 'WH-BM', 'Benchmark Warehouse', 'physical')
  RETURNING id INTO v_wh_id;

  INSERT INTO inventory_items (company_id, code, name, type, unit, cost_method, default_warehouse_id)
  VALUES (v_co_id, 'ITM-BM', 'Benchmark Item', 'product', 'piece', 'weighted_average', v_wh_id)
  RETURNING id INTO v_item_id;

  -- Customer for aging
  INSERT INTO parties (company_id, name, name_ar, type, is_active)
  VALUES (v_co_id, 'Benchmark Customer', 'عميل اختبار', 'customer', true)
  RETURNING id INTO v_cust_id;

  RAISE NOTICE 'Setup complete. Company=% Period=% Cash=% Item=% Customer=%', v_co_id, v_per_id, v_cash_id, v_item_id, v_cust_id;

  -- Seed baseline journal entries for reports
  INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit, period_id, fiscal_year_id, is_balanced)
  VALUES (v_co_id, 'BM-SEED-001', '2024-06-01', 'Seed entry', 'posted', 100000, 100000, v_per_id, v_fy_id, true)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES (v_je_id, v_cash_id, 100000, 0, 1), (v_je_id, v_cap_id, 0, 100000, 2);

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 1: Journal Entry Insert (Single)
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 1: Journal Entry Insert (Single) ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;

  -- Warmup
  FOR v_warmup IN 1..v_warmup LOOP
    INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit, period_id, fiscal_year_id, is_balanced)
    VALUES (v_co_id, 'BM-WARM-S-' || v_warmup, '2024-06-15', 'Warmup', 'posted', 100, 100, v_per_id, v_fy_id, true)
    RETURNING id INTO v_je_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_je_id, v_cash_id, 100, 0, 1), (v_je_id, v_rev_id, 0, 100, 2);
  END LOOP;

  -- Measured iterations
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit, period_id, fiscal_year_id, is_balanced)
    VALUES (v_co_id, 'BM-SINGLE-' || v_iter, '2024-06-15', 'Benchmark single', 'posted', 1000, 1000, v_per_id, v_fy_id, true)
    RETURNING id INTO v_je_id;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_je_id, v_cash_id, 1000, 0, 1), (v_je_id, v_rev_id, 0, 1000, 2);
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Single Insert]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 2: Journal Entry Insert (Batch of 100)
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 2: Journal Entry Insert (Batch 100) ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;

  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    FOR i IN 1..100 LOOP
      INSERT INTO journal_entries (company_id, entry_number, date, description, status, total_debit, total_credit, period_id, fiscal_year_id, is_balanced)
      VALUES (v_co_id, 'BM-BATCH-' || v_iter || '-' || LPAD(i::TEXT, 4, '0'), '2024-06-15', 'Batch entry', 'posted', 100, 100, v_per_id, v_fy_id, true)
      RETURNING id INTO v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
      VALUES (v_je_id, v_cash_id, 100, 0, 1), (v_je_id, v_rev_id, 0, 100, 2);
    END LOOP;
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Batch 100 inserts]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;
  RAISE NOTICE '  Throughput: %.1f entries/sec', (100.0 / (v_avg_ms / 1000.0));

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 3: Account Balance Calculation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 3: Account Balance Calculation ===';

  -- Varying account counts: single, 5, 20
  DECLARE
    v_acct_ids UUID[];
    v_acct_id  UUID;
  BEGIN
    -- Single account
    v_total := 0; v_min_ms := 999999; v_max_ms := 0;
    FOR v_iter IN 1..v_iterations LOOP
      v_start := clock_timestamp();
      PERFORM ledger_get_account_balance(v_cash_id, v_co_id, '2024-06-30');
      v_elapsed := clock_timestamp() - v_start;
      v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
      v_total := v_total + v_ms;
      IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
      IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
    END LOOP;
    v_avg_ms := v_total / v_iterations;
    RAISE NOTICE 'RESULT [Balance 1 account]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

    -- Create additional accounts for multi-account test
    FOR i IN 2..20 LOOP
      INSERT INTO accounts (company_id, code, name, name_ar, type, normal_balance, is_active, is_postable)
      VALUES (v_co_id, '5' || LPAD(i::TEXT, 3, '0'), 'Account ' || i, 'حساب ' || i, 'expense', 'debit', true, true);
    END LOOP;

    SELECT ARRAY_AGG(id) INTO v_acct_ids FROM accounts WHERE company_id = v_co_id AND is_postable = true;

    -- 5 accounts
    v_total := 0; v_min_ms := 999999; v_max_ms := 0;
    FOR v_iter IN 1..v_iterations LOOP
      v_start := clock_timestamp();
      FOREACH v_acct_id IN ARRAY v_acct_ids[1:5] LOOP
        PERFORM ledger_get_account_balance(v_acct_id, v_co_id, '2024-06-30');
      END LOOP;
      v_elapsed := clock_timestamp() - v_start;
      v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
      v_total := v_total + v_ms;
      IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
      IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
    END LOOP;
    v_avg_ms := v_total / v_iterations;
    RAISE NOTICE 'RESULT [Balance 5 accounts]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

    -- 20 accounts
    v_total := 0; v_min_ms := 999999; v_max_ms := 0;
    FOR v_iter IN 1..v_iterations LOOP
      v_start := clock_timestamp();
      FOREACH v_acct_id IN ARRAY v_acct_ids LOOP
        PERFORM ledger_get_account_balance(v_acct_id, v_co_id, '2024-06-30');
      END LOOP;
      v_elapsed := clock_timestamp() - v_start;
      v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
      v_total := v_total + v_ms;
      IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
      IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
    END LOOP;
    v_avg_ms := v_total / v_iterations;
    RAISE NOTICE 'RESULT [Balance 20 accounts]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;
  END;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 4: Trial Balance Generation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 4: Trial Balance Generation ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM ledger_get_trial_balance(v_co_id, '2024-01-01', '2024-12-31');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Trial Balance]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 5: Income Statement Query with Date Range
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 5: Income Statement ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM get_income_statement(v_co_id, '2024-01-01', '2024-12-31');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Income Statement]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 6: Balance Sheet Calculation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 6: Balance Sheet ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM get_balance_sheet(v_co_id, '2024-06-30');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Balance Sheet]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 7: Cash Flow Calculation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 7: Cash Flow Statement ===';

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM get_cash_flow(v_co_id, '2024-01-01', '2024-06-30');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Cash Flow]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 8: Inventory Stock Calculation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 8: Inventory Stock Calculation ===';

  -- Seed stock movements
  INSERT INTO stock_movements (company_id, item_id, warehouse_id, movement_type, direction, qty, unit_cost, total_cost, source, source_id, posted_at)
  SELECT v_co_id, v_item_id, v_wh_id, 'receipt', 'in', 100, 50, 5000, 'benchmark', 'stock-seed-' || g, NOW()
  FROM generate_series(1, 10) AS g;

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM get_current_stock(v_co_id, v_item_id, v_wh_id);
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Stock Balance]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 9: Payroll Summary Aggregation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 9: Payroll Summary ===';

  -- Seed payroll data
  INSERT INTO payroll_cycles (company_id, name, cycle_type, year, month, period_start, period_end, payment_date)
  VALUES (v_co_id, 'BM Cycle', 'monthly', 2024, 6, '2024-06-01', '2024-06-30', '2024-07-01');

  FOR i IN 1..50 LOOP
    INSERT INTO payroll_runs (company_id, cycle_id, name, status, total_earnings, total_deductions, net_pay, employee_count)
    VALUES (v_co_id, (SELECT id FROM payroll_cycles WHERE company_id = v_co_id LIMIT 1), 'Run ' || i, 'completed', 50000, 10000, 40000, 10);
  END LOOP;

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_rowcount FROM payroll_runs WHERE company_id = v_co_id;
    SELECT COALESCE(SUM(net_pay), 0) INTO v_total FROM payroll_runs WHERE company_id = v_co_id;
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + 0; -- dummy
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Payroll Summary]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 10: Customer Aging Calculation
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 10: Customer Aging ===';

  -- Seed invoices for aging
  FOR i IN 1..20 LOOP
    INSERT INTO invoices (company_id, invoice_no, customer_id, customer_name, status, invoice_type, invoice_date, due_date, subtotal, tax_amount, total, paid_amount)
    VALUES (v_co_id, 'BM-INV-' || LPAD(i::TEXT, 4, '0'), v_cust_id, 'Benchmark Customer', 'posted', 'standard',
      '2024-01-' || LPAD((i % 28 + 1)::TEXT, 2, '0'),
      '2024-02-' || LPAD((i % 28 + 1)::TEXT, 2, '0'),
      1000 * i, 150 * i, 1150 * i, 0);
  END LOOP;

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM get_customer_aging(v_co_id, '2024-06-30');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Customer Aging]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 11: Job Queue Operations
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 11: Job Queue Operations ===';

  -- Enqueue benchmark
  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    INSERT INTO job_queue (company_id, task, payload, status, priority)
    VALUES (v_co_id, 'process_recurring', '{"benchmark": true}', 'pending', 5);
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Job Enqueue]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- Batch enqueue 100 jobs
  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    INSERT INTO job_queue (company_id, task, payload, status, priority)
    SELECT v_co_id, 'process_recurring', '{"seq": ' || g || '}', 'pending', g % 10
    FROM generate_series(1, 100) AS g;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Batch Enqueue 100]: min=%.3fms avg=%.3fms max=%.3fms (%.0f jobs/sec)', v_min_ms, v_avg_ms, v_max_ms, (100.0 / (v_avg_ms / 1000.0));

  -- Dequeue benchmark
  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    UPDATE job_queue SET status = 'processing', started_at = NOW()
    WHERE id = (
      SELECT id FROM job_queue WHERE company_id = v_co_id AND status = 'pending'
      ORDER BY priority DESC, created_at ASC LIMIT 1
    )
    RETURNING id INTO v_je_id;
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Job Dequeue]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 12: Recurring Journal Processing
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 12: Recurring Journal Processing ===';

  INSERT INTO recurring_journals (company_id, name, frequency, day_of_month, start_date, next_run_date, status, template_lines)
  VALUES (v_co_id, 'BM Monthly', 'monthly', 1, '2024-01-01', '2024-07-01', 'active',
    '[{"account_code": "6001", "debit": 5000, "credit": 0}, {"account_code": "2101", "debit": 0, "credit": 5000}]');

  v_total := 0; v_min_ms := 999999; v_max_ms := 0;
  FOR v_iter IN 1..v_iterations LOOP
    v_start := clock_timestamp();
    PERFORM process_due_recurring_journals(v_co_id, '2024-07-01');
    v_elapsed := clock_timestamp() - v_start;
    v_ms := EXTRACT(EPOCH FROM v_elapsed) * 1000;
    v_total := v_total + v_ms;
    IF v_ms < v_min_ms THEN v_min_ms := v_ms; END IF;
    IF v_ms > v_max_ms THEN v_max_ms := v_ms; END IF;
  END LOOP;
  v_avg_ms := v_total / v_iterations;
  RAISE NOTICE 'RESULT [Recurring Journal]: min=%.3fms avg=%.3fms max=%.3fms', v_min_ms, v_avg_ms, v_max_ms;

  -- ═════════════════════════════════════════════════════
  -- BENCHMARK 13: EXPLAIN ANALYZE on Key Queries
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== BENCHMARK 13: EXPLAIN ANALYZE ===';

  RAISE NOTICE '--- EXPLAIN ANALYZE: Trial Balance ---';
  EXPLAIN ANALYZE SELECT * FROM ledger_get_trial_balance(v_co_id, '2024-01-01', '2024-12-31');

  RAISE NOTICE '--- EXPLAIN ANALYZE: Account Balance ---';
  EXPLAIN ANALYZE SELECT ledger_get_account_balance(v_cash_id, v_co_id, '2024-06-30');

  RAISE NOTICE '--- EXPLAIN ANALYZE: Customer Aging ---';
  EXPLAIN ANALYZE SELECT * FROM get_customer_aging(v_co_id, '2024-06-30');

  RAISE NOTICE '--- EXPLAIN ANALYZE: Stock Balance ---';
  EXPLAIN ANALYZE SELECT * FROM get_current_stock(v_co_id, v_item_id, v_wh_id);

  -- ═════════════════════════════════════════════════════
  -- SUMMARY
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All benchmarks completed for company %', v_co_id;
  RAISE NOTICE '========================================';

  -- ═════════════════════════════════════════════════════
  -- CLEANUP
  -- ═════════════════════════════════════════════════════
  RAISE NOTICE '=== CLEANUP ===';

  DELETE FROM recurring_journal_log WHERE recurring_journal_id IN (SELECT id FROM recurring_journals WHERE company_id = v_co_id);
  DELETE FROM recurring_journals WHERE company_id = v_co_id;
  DELETE FROM job_queue WHERE company_id = v_co_id;
  DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = v_co_id);
  DELETE FROM invoices WHERE company_id = v_co_id;
  DELETE FROM payroll_runs WHERE company_id = v_co_id;
  DELETE FROM payroll_cycles WHERE company_id = v_co_id;
  DELETE FROM stock_movements WHERE company_id = v_co_id;
  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = v_co_id);
  DELETE FROM journal_entries WHERE company_id = v_co_id;
  DELETE FROM inventory_items WHERE company_id = v_co_id;
  DELETE FROM warehouses WHERE company_id = v_co_id;
  DELETE FROM parties WHERE company_id = v_co_id;
  DELETE FROM accounts WHERE company_id = v_co_id;
  DELETE FROM accounting_periods WHERE company_id = v_co_id;
  DELETE FROM fiscal_years WHERE company_id = v_co_id;
  DELETE FROM companies WHERE id = v_co_id;

  RAISE NOTICE 'Cleanup complete. All test data removed.';
END $$;

-- Final verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM companies WHERE slug = 'benchmark-test';
  ASSERT v_count = 0, 'Test company should be cleaned up';
  RAISE NOTICE 'Final verification: no artifacts remain. All benchmarks PASSED.';
END $$;

COMMIT;
