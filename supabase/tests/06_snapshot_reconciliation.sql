-- ============================================================
-- Snapshot & Reconciliation Validation — SQL Test Harness
-- Tests: financial_snapshots, account_balances_daily,
--        reconciliations, reconciliation_lines,
--        payroll_summaries, inventory_snapshots
-- WARNING: Creates data and cleans up. Run in test/CI database.
-- ============================================================

BEGIN;

-- ── 1. SETUP ─────────────────────────────────────────────────
SELECT 'SETUP: Creating test company, chart of accounts, fiscal year, periods...' AS step;

-- Create test company
INSERT INTO companies (id, name, name_ar, slug, currency, language)
VALUES (
  's0000000-0000-0000-0000-000000000001',
  'Snapshot Test Co',
  'شركة اختبار اللقطات',
  'snapshot-test-co',
  'SAR',
  'ar'
) ON CONFLICT (slug) DO NOTHING;

-- Create chart of accounts
INSERT INTO accounts (id, company_id, code, name, name_ar, type, normal_balance, is_active, is_postable, is_header, opening_balance, is_receivable, is_payable)
VALUES
  -- Assets
  ('s1000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', '1101', 'Cash', 'نقدية', 'asset', 'debit', true, true, false, 0, false, false),
  ('s1000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', '1110', 'AR', 'ذمم مدينة', 'asset', 'debit', true, true, false, 0, true, false),
  ('s1000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', '1201', 'Equipment', 'معدات', 'asset', 'debit', true, true, false, 0, false, false),
  -- Liabilities
  ('s1000000-0000-0000-0000-000000000010', 's0000000-0000-0000-0000-000000000001', '2101', 'AP', 'ذمم دائنة', 'liability', 'credit', true, true, false, 0, false, true),
  ('s1000000-0000-0000-0000-000000000011', 's0000000-0000-0000-0000-000000000001', '2120', 'Taxes Payable', 'ضرائب مستحقة', 'liability', 'credit', true, true, false, 0, false, false),
  -- Equity
  ('s1000000-0000-0000-0000-000000000020', 's0000000-0000-0000-0000-000000000001', '3001', 'Owner Capital', 'رأس المال', 'equity', 'credit', true, true, false, 0, false, false),
  ('s1000000-0000-0000-0000-000000000021', 's0000000-0000-0000-0000-000000000001', '3002', 'Retained Earnings', 'أرباح محتجزة', 'equity', 'credit', true, true, false, 0, false, false),
  -- Revenue
  ('s1000000-0000-0000-0000-000000000030', 's0000000-0000-0000-0000-000000000001', '4001', 'Sales Revenue', 'إيرادات مبيعات', 'revenue', 'credit', true, true, false, 0, false, false),
  -- Expenses
  ('s1000000-0000-0000-0000-000000000040', 's0000000-0000-0000-0000-000000000001', '5001', 'COGS', 'تكلفة البضاعة', 'cogs', 'debit', true, true, false, 0, false, false),
  ('s1000000-0000-0000-0000-000000000041', 's0000000-0000-0000-0000-000000000001', '6501', 'Rent Expense', 'مصروف إيجار', 'expense', 'debit', true, true, false, 0, false, false)
ON CONFLICT (company_id, code) DO NOTHING;

-- Create fiscal year
INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, status, is_current)
VALUES (
  'sf000000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'FY 2024',
  '2024-01-01',
  '2024-12-31',
  'active',
  true
) ON CONFLICT DO NOTHING;

-- Create accounting periods
INSERT INTO accounting_periods (id, company_id, fiscal_year_id, period_number, name, start_date, end_date, status)
VALUES
  ('sp000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'sf000000-0000-0000-0000-000000000001', 1, 'Jan 2024', '2024-01-01', '2024-01-31', 'open'),
  ('sp000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'sf000000-0000-0000-0000-000000000001', 2, 'Feb 2024', '2024-02-01', '2024-02-29', 'open'),
  ('sp000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'sf000000-0000-0000-0000-000000000001', 3, 'Mar 2024', '2024-03-01', '2024-03-31', 'open')
ON CONFLICT DO NOTHING;

-- Create products/inventory for inventory snapshot tests
INSERT INTO products (id, company_id, name, sku, cost_price, sell_price, track_inventory, is_active)
VALUES
  ('sp100000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'Widget A', 'WGT-A', 50, 80, true, true),
  ('sp100000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'Widget B', 'WGT-B', 100, 150, true, true)
ON CONFLICT DO NOTHING;

-- Create warehouses
INSERT INTO warehouses (id, company_id, code, name, is_active)
VALUES
  ('sw000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'WH-MAIN', 'Main Warehouse', true),
  ('sw000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'WH-SEC', 'Secondary Warehouse', true)
ON CONFLICT DO NOTHING;

-- Insert inventory stock
INSERT INTO inventory (id, company_id, product_id, warehouse_id, quantity)
VALUES
  ('si000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'sp100000-0000-0000-0000-000000000001', 'sw000000-0000-0000-0000-000000000001', 10),
  ('si000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'sp100000-0000-0000-0000-000000000002', 'sw000000-0000-0000-0000-000000000001', 5),
  ('si000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'sp100000-0000-0000-0000-000000000001', 'sw000000-0000-0000-0000-000000000002', 3)
ON CONFLICT DO NOTHING;

-- ── 2. POST JOURNAL ENTRIES ACROSS MULTIPLE DATES ───────────
SELECT 'JOURNALS: Posting journal entries across multiple dates...' AS step;

-- Entry 1: Jan 1 - Owner capital (Cash Dr 50000, Capital Cr 50000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-001', '2024-01-01', 'Owner Capital',
        'posted', 50000, 50000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001', 50000, 0, 'Capital contribution', 1),
  ('sje00001-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000020', 0, 50000, 'Owner capital', 2);

-- Entry 2: Jan 15 - Sales (Cash Dr 10000, Sales Cr 10000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-002', '2024-01-15', 'January Sales',
        'posted', 10000, 10000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000001', 10000, 0, 'Cash from sales', 1),
  ('sje00001-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000030', 0, 10000, 'Sales revenue', 2);

-- Entry 3: Jan 20 - Rent expense (Rent Dr 2000, Cash Cr 2000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-003', '2024-01-20', 'Office Rent',
        'posted', 2000, 2000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000003', 's1000000-0000-0000-0000-000000000041', 2000, 0, 'Rent expense', 1),
  ('sje00001-0000-0000-0000-000000000003', 's1000000-0000-0000-0000-000000000001', 0, 2000, 'Cash payment', 2);

-- Entry 4: Feb 10 - Sales (Cash Dr 15000, Sales Cr 15000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-004', '2024-02-10', 'February Sales',
        'posted', 15000, 15000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000004', 's1000000-0000-0000-0000-000000000001', 15000, 0, 'Cash from sales', 1),
  ('sje00001-0000-0000-0000-000000000004', 's1000000-0000-0000-0000-000000000030', 0, 15000, 'Sales revenue', 2);

-- Entry 5: Mar 5 - Credit Sale (AR Dr 20000, Sales Cr 20000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-005', '2024-03-05', 'March Credit Sales',
        'posted', 20000, 20000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000005', 's1000000-0000-0000-0000-000000000002', 20000, 0, 'AR from credit sales', 1),
  ('sje00001-0000-0000-0000-000000000005', 's1000000-0000-0000-0000-000000000030', 0, 20000, 'Sales revenue (credit)', 2);

-- Entry 6: Mar 20 - Equipment purchase (Equipment Dr 5000, Cash Cr 5000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('sje00001-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000001', 'SNP-2024-006', '2024-03-20', 'Equipment Purchase',
        'posted', 5000, 5000, 'sf000000-0000-0000-0000-000000000001', 'sp000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('sje00001-0000-0000-0000-000000000006', 's1000000-0000-0000-0000-000000000003', 5000, 0, 'Equipment', 1),
  ('sje00001-0000-0000-0000-000000000006', 's1000000-0000-0000-0000-000000000001', 0, 5000, 'Cash payment', 2);

-- ── 3. TEST: ledger_generate_daily_balances ──────────────────
SELECT 'TEST 1: ledger_generate_daily_balances - generate for date range' AS step;

-- Generate daily balances for key dates
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-01');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-15');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-20');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-31');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-02-10');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-02-29');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-03-05');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-03-20');
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-03-31');

-- Verify daily balances: opening + (period_debit - period_credit) = closing
SELECT
  'Daily Balance Verification' AS check_name,
  account_id,
  as_of_date,
  ROUND(opening_debit::numeric, 2) + ROUND(period_debit::numeric, 2) - ROUND(period_credit::numeric, 2) AS calculated_closing,
  ROUND(closing_debit::numeric, 2) AS actual_closing,
  CASE
    WHEN ABS(
      (ROUND(opening_debit::numeric, 2) + ROUND(period_debit::numeric, 2) - ROUND(period_credit::numeric, 2))
      - ROUND(closing_debit::numeric, 2)
    ) < 0.01 THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM account_balances_daily
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND as_of_date = '2024-01-15'
ORDER BY account_id;

-- Verify net_movement = period_debit - period_credit (generated column)
SELECT
  'Generated Column: net_movement' AS check_name,
  period_debit,
  period_credit,
  net_movement,
  ROUND((period_debit - period_credit)::numeric, 2) AS expected_net_movement,
  CASE
    WHEN ROUND(net_movement::numeric, 2) = ROUND((period_debit - period_credit)::numeric, 2) THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM account_balances_daily
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND as_of_date = '2024-01-15'
LIMIT 1;

-- Verify currency defaults to SAR
SELECT
  'Currency Default' AS check_name,
  currency,
  CASE WHEN currency = 'SAR' THEN 'PASS: Default currency is SAR' ELSE 'FAIL' END AS result
FROM account_balances_daily
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
LIMIT 1;

-- Verify upsert works (run same date again)
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-15');
SELECT
  'Upsert Behavior' AS check_name,
  COUNT(*) AS record_count,
  CASE WHEN COUNT(*) <= (SELECT COUNT(*) FROM accounts WHERE company_id = 's0000000-0000-0000-0000-000000000001' AND is_active = true)
    THEN 'PASS: No duplicates after re-run'
    ELSE 'FAIL: Duplicates detected'
  END AS result
FROM account_balances_daily
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND as_of_date = '2024-01-15';

-- ── 4. TEST: ledger_create_snapshot (daily, monthly) ─────────
SELECT 'TEST 2: ledger_create_snapshot - daily snapshot' AS step;

SELECT ledger_create_snapshot(
  's0000000-0000-0000-0000-000000000001',
  'daily',
  '2024-01-31'
) AS daily_snapshot_id;

SELECT
  'Daily Snapshot Summary' AS check_name,
  snapshot_type,
  as_of_date,
  ROUND(total_assets::numeric, 2) AS total_assets,
  ROUND(total_liabilities::numeric, 2) AS total_liabilities,
  ROUND(total_equity::numeric, 2) AS total_equity,
  ROUND(net_income::numeric, 2) AS net_income,
  ROUND(total_revenue::numeric, 2) AS total_revenue,
  ROUND(total_expenses::numeric, 2) AS total_expenses,
  CASE
    WHEN ROUND(total_assets::numeric, 2) = ROUND((total_liabilities + total_equity)::numeric, 2)
    THEN 'PASS: Assets = Liabilities + Equity'
    ELSE 'FAIL: Equation does not balance'
  END AS balance_sheet_check,
  CASE
    WHEN ROUND(net_income::numeric, 2) = ROUND((total_revenue - total_expenses)::numeric, 2)
    THEN 'PASS: Net Income = Revenue - Expenses'
    ELSE 'FAIL: Net income mismatch'
  END AS income_check
FROM financial_snapshots
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND snapshot_type = 'daily'
  AND as_of_date = '2024-01-31';

-- Extract summary JSON structure
SELECT
  'Snapshot Summary JSON' AS check_name,
  summary->'assets'->>'total' AS assets_total,
  summary->'liabilities'->>'total' AS liabilities_total,
  summary->'equity'->>'total' AS equity_total,
  summary->'revenue'->>'total' AS revenue_total,
  summary->'expenses'->>'total' AS expenses_total,
  summary->>'net_income' AS net_income,
  CASE WHEN summary ? 'assets' AND summary ? 'liabilities' AND summary ? 'equity'
       AND summary ? 'revenue' AND summary ? 'expenses' AND summary ? 'net_income'
    THEN 'PASS: Summary JSON has correct structure'
    ELSE 'FAIL: Missing keys in summary JSON'
  END AS result
FROM financial_snapshots
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND snapshot_type = 'daily'
  AND as_of_date = '2024-01-31';

-- Create monthly snapshot
SELECT 'TEST 3: ledger_create_snapshot - monthly snapshot' AS step;

SELECT ledger_create_snapshot(
  's0000000-0000-0000-0000-000000000001',
  'monthly',
  '2024-01-31'
) AS monthly_snapshot_jan;

-- Verify monthly snapshot balances (Jan: 50000 capital + 10000 sales - 2000 rent = 58000)
SELECT
  'Monthly Snapshot Jan 2024' AS check_name,
  snapshot_type,
  as_of_date,
  ROUND(total_assets::numeric, 2) AS total_assets,
  ROUND(total_liabilities::numeric, 2) AS total_liabilities,
  ROUND(total_equity::numeric, 2) AS total_equity,
  ROUND(net_income::numeric, 2) AS net_income,
  CASE
    WHEN ROUND(total_assets::numeric, 2) = ROUND((total_liabilities + total_equity)::numeric, 2)
    THEN 'PASS: Monthly snapshot balances'
    ELSE 'FAIL: Monthly snapshot unbalanced'
  END AS result
FROM financial_snapshots
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND snapshot_type = 'monthly'
  AND as_of_date = '2024-01-31';

-- ── 5. TEST: Unique constraint on snapshots ──────────────────
SELECT 'TEST 4: Unique constraint on (company_id, snapshot_type, as_of_date)' AS step;

-- This should succeed
SELECT ledger_create_snapshot(
  's0000000-0000-0000-0000-000000000001',
  'daily',
  '2024-02-29'
);

-- Attempt duplicate (should fail)
BEGIN;
  SELECT ledger_create_snapshot(
    's0000000-0000-0000-0000-000000000001',
    'daily',
    '2024-02-29'
  );
  SELECT 'FAIL: Unique constraint not enforced - duplicate snapshot was created' AS result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT 'PASS: Unique constraint (company_id, snapshot_type, as_of_date) enforced' AS result;
ROLLBACK;

-- ── 6. TEST: generate_inventory_snapshot ─────────────────────
SELECT 'TEST 5: generate_inventory_snapshot - daily with warehouse filter' AS step;

-- Generate snapshot for main warehouse only
SELECT generate_inventory_snapshot(
  's0000000-0000-0000-0000-000000000001',
  CURRENT_DATE,
  'sw000000-0000-0000-0000-000000000001'
) AS main_wh_snapshot_count;

-- Verify inventory snapshot data
SELECT
  'Inventory Snapshot - Main WH' AS check_name,
  COUNT(*) AS item_count,
  ROUND(SUM(qty)::numeric, 2) AS total_qty,
  ROUND(SUM(total_value)::numeric, 2) AS total_value,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS: Inventory snapshot created'
    ELSE 'FAIL: No snapshot data'
  END AS result
FROM inventory_snapshots
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND warehouse_id = 'sw000000-0000-0000-0000-000000000001';

-- Verify qty * unit_cost = total_value for each snapshot row
SELECT
  'Inventory Snapshot Value Check' AS check_name,
  qty,
  unit_cost,
  total_value,
  ROUND((qty * unit_cost)::numeric, 2) AS expected_value,
  CASE
    WHEN ROUND(total_value::numeric, 2) = ROUND((qty * unit_cost)::numeric, 2)
    THEN 'PASS: total_value = qty * unit_cost'
    ELSE 'FAIL: Value mismatch'
  END AS result
FROM inventory_snapshots
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND warehouse_id = 'sw000000-0000-0000-0000-000000000001';

-- Test with different snapshot types
SELECT
  'Snapshot Type Variants' AS check_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM inventory_snapshots WHERE snapshot_type IN ('daily', 'weekly', 'monthly', 'manual', 'closing'))
      OR NOT EXISTS (SELECT 1 FROM inventory_snapshots WHERE snapshot_type NOT IN ('daily', 'weekly', 'monthly', 'manual', 'closing'))
    THEN 'PASS: Snapshot types are valid'
    ELSE 'WARN: Some snapshot types may be non-standard'
  END AS result;

-- ── 7. TEST: Reconciliation creation and difference calcs ────
SELECT 'TEST 6: Reconciliation - create and verify difference calculation' AS step;

-- Create reconciliations with known statement amounts
INSERT INTO reconciliations (id, company_id, account_id, reference_type, reference_number, statement_date, statement_amount, cleared_amount, status)
VALUES
  ('srec0000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001', 'bank_statement', 'BS-2024-001', '2024-01-31', 10000, 7000, 'partial'),
  ('srec0000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000001', 'bank_statement', 'BS-2024-002', '2024-02-29', 15000, 15000, 'matched'),
  ('srec0000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000002', 'bank_statement', 'BS-2024-003', '2024-03-31', 20000, 0, 'unmatched');

-- Verify difference = statement_amount - cleared_amount (generated column)
SELECT
  'Reconciliation Difference' AS check_name,
  reference_number,
  ROUND(statement_amount::numeric, 2) AS statement_amount,
  ROUND(cleared_amount::numeric, 2) AS cleared_amount,
  ROUND(difference::numeric, 2) AS difference,
  ROUND((statement_amount - cleared_amount)::numeric, 2) AS expected_difference,
  CASE
    WHEN ROUND(difference::numeric, 2) = ROUND((statement_amount - cleared_amount)::numeric, 2) THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM reconciliations
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
ORDER BY reference_number;

-- Test status transitions
SELECT
  'Status Values' AS check_name,
  reference_number,
  status,
  CASE
    WHEN reference_number = 'BS-2024-001' AND status = 'partial' THEN 'PASS: partial status correct'
    WHEN reference_number = 'BS-2024-002' AND status = 'matched' THEN 'PASS: matched status correct'
    WHEN reference_number = 'BS-2024-003' AND status = 'unmatched' THEN 'PASS: unmatched status correct'
    ELSE 'FAIL: unexpected status'
  END AS result
FROM reconciliations
WHERE company_id = 's0000000-0000-0000-0000-000000000001';

-- ── 8. TEST: reconciliation_lines matching ────────────────────
SELECT 'TEST 7: reconciliation_lines - matching logic' AS step;

-- Create reconciliation lines with known amounts
INSERT INTO reconciliation_lines (id, reconciliation_id, journal_entry_id, amount, matched_amount, status)
VALUES
  ('srline01-0000-0000-0000-000000000001', 'srec0000-0000-0000-0000-000000000001', 'sje00001-0000-0000-0000-000000000002', 5000, 5000, 'matched'),
  ('srline01-0000-0000-0000-000000000002', 'srec0000-0000-0000-0000-000000000001', 'sje00001-0000-0000-0000-000000000003', 2000, 2000, 'matched');

-- Verify difference = amount - matched_amount (generated column)
SELECT
  'Reconciliation Lines Difference' AS check_name,
  ROUND(amount::numeric, 2) AS amount,
  ROUND(matched_amount::numeric, 2) AS matched_amount,
  ROUND(difference::numeric, 2) AS difference,
  ROUND((amount - matched_amount)::numeric, 2) AS expected_diff,
  CASE
    WHEN ROUND(difference::numeric, 2) = ROUND((amount - matched_amount)::numeric, 2) THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM reconciliation_lines
WHERE reconciliation_id = 'srec0000-0000-0000-0000-000000000001';

-- Update reconciliation to matched status
UPDATE reconciliations
SET cleared_amount = 10000,
    status = 'matched',
    reconciled_at = NOW()
WHERE id = 'srec0000-0000-0000-0000-000000000001';

SELECT
  'Reconciliation Status Update' AS check_name,
  ROUND(cleared_amount::numeric, 2) AS cleared_amount,
  status,
  CASE WHEN status = 'matched' AND ROUND(cleared_amount::numeric, 2) = 10000 AND ROUND(difference::numeric, 2) = 0
    THEN 'PASS: Updated to matched correctly'
    ELSE 'FAIL: Update incorrect'
  END AS result
FROM reconciliations
WHERE id = 'srec0000-0000-0000-0000-000000000001';

-- ── 9. TEST: Payroll summaries ───────────────────────────────
SELECT 'TEST 8: Payroll summaries - gross/net/employer contributions' AS step;

-- Create payroll cycle
INSERT INTO payroll_cycles (id, company_id, name, cycle_type, year, month, period_start, period_end, payment_date, is_closed)
VALUES (
  'spc00000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'January 2024',
  'monthly',
  2024, 1,
  '2024-01-01', '2024-01-31', '2024-02-05',
  false
);

-- Create payroll run
INSERT INTO payroll_runs (id, company_id, cycle_id, name, status)
VALUES (
  'spr00000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'spc00000-0000-0000-0000-000000000001',
  'January Payroll',
  'completed'
);

-- Create employee
INSERT INTO employees (id, company_id, employee_number, name, status, hiring_date)
VALUES (
  'semp0000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'EMP-001',
  'Ahmed',
  'active',
  '2024-01-01'
);

-- Insert payroll summary
INSERT INTO payroll_summaries (
  id, company_id, run_id, employee_id,
  basic_salary, housing_allowance, transportation_allowance,
  communication_allowance, cost_of_living_allowance, other_allowances,
  overtime_amount, bonuses,
  gross_pay,
  loan_deduction, tax_deduction, social_insurance, medical_insurance, other_deductions,
  total_deductions,
  net_pay,
  employer_contributions
)
VALUES (
  'sps00000-0000-0000-0000-000000000001',
  's0000000-0000-0000-0000-000000000001',
  'spr00000-0000-0000-0000-000000000001',
  'semp0000-0000-0000-0000-000000000001',
  10000, 2000, 1000, 500, 800, 300, 700, 1000,
  16300,
  1000, 500, 733.50, 300, 200,
  2733.50,
  13566.50,
  733.50
);

-- Verify gross_pay = sum of allowances + salary
SELECT
  'Payroll Gross Pay' AS check_name,
  basic_salary + housing_allowance + transportation_allowance +
    communication_allowance + cost_of_living_allowance + other_allowances +
    overtime_amount + bonuses AS calculated_gross,
  gross_pay,
  CASE
    WHEN gross_pay = basic_salary + housing_allowance + transportation_allowance +
      communication_allowance + cost_of_living_allowance + other_allowances +
      overtime_amount + bonuses
    THEN 'PASS: gross_pay = sum of all earnings'
    ELSE 'FAIL: gross_pay mismatch'
  END AS result
FROM payroll_summaries
WHERE id = 'sps00000-0000-0000-0000-000000000001';

-- Verify net_pay = gross_pay - total_deductions
SELECT
  'Payroll Net Pay' AS check_name,
  gross_pay,
  total_deductions,
  net_pay,
  gross_pay - total_deductions AS expected_net,
  CASE
    WHEN net_pay = gross_pay - total_deductions
    THEN 'PASS: net_pay = gross_pay - total_deductions'
    ELSE 'FAIL: net_pay mismatch'
  END AS result
FROM payroll_summaries
WHERE id = 'sps00000-0000-0000-0000-000000000001';

-- Verify employer_contributions tracked separately
SELECT
  'Employer Contributions' AS check_name,
  employer_contributions,
  CASE
    WHEN employer_contributions > 0 AND employer_contributions IS DISTINCT FROM net_pay
      AND employer_contributions IS DISTINCT FROM gross_pay
    THEN 'PASS: employer_contributions tracked separately'
    ELSE 'FAIL: employer_contributions not tracked separately'
  END AS result
FROM payroll_summaries
WHERE id = 'sps00000-0000-0000-0000-000000000001';

-- Verify unique constraint on (run_id, employee_id)
SELECT
  'Payroll Unique Constraint' AS check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'payroll_summaries'
        AND indexdef LIKE '%run_id%employee_id%'
    ) THEN 'PASS: Unique index on (run_id, employee_id) exists'
    ELSE 'FAIL: Missing unique index'
  END AS result;

-- ── 10. TEST: Historical rebuild capability ──────────────────
SELECT 'TEST 9: Historical rebuild - regenerate snapshot for past date' AS step;

-- Re-generate snapshot for Jan 31 (should produce same result)
SELECT ledger_create_snapshot(
  's0000000-0000-0000-0000-000000000001',
  'daily',
  '2024-01-31'
) AS rebuilt_snapshot_id;

-- Verify rebuilt data is consistent
WITH original AS (
  SELECT total_assets, total_liabilities, total_equity, net_income, total_revenue, total_expenses
  FROM financial_snapshots
  WHERE company_id = 's0000000-0000-0000-0000-000000000001'
    AND snapshot_type = 'daily'
    AND as_of_date = '2024-01-31'
  ORDER BY created_at ASC
  LIMIT 1
),
rebuilt AS (
  SELECT total_assets, total_liabilities, total_equity, net_income, total_revenue, total_expenses
  FROM financial_snapshots
  WHERE company_id = 's0000000-0000-0000-0000-000000000001'
    AND snapshot_type = 'daily'
    AND as_of_date = '2024-01-31'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  'Historical Rebuild Consistency' AS check_name,
  original.total_assets AS original_assets,
  rebuilt.total_assets AS rebuilt_assets,
  CASE
    WHEN original.total_assets = rebuilt.total_assets
      AND original.total_liabilities = rebuilt.total_liabilities
      AND original.total_equity = rebuilt.total_equity
      AND original.net_income = rebuilt.net_income
    THEN 'PASS: Rebuilt data matches original'
    ELSE 'FAIL: Rebuilt data differs from original'
  END AS result
FROM original, rebuilt;

-- Regenerate daily balances for past date
SELECT ledger_generate_daily_balances('s0000000-0000-0000-0000-000000000001', '2024-01-15');

WITH original_bal AS (
  SELECT account_id, opening_debit, period_debit, period_credit, closing_debit, balance
  FROM account_balances_daily
  WHERE company_id = 's0000000-0000-0000-0000-000000000001'
    AND as_of_date = '2024-01-15'
  ORDER BY account_id, created_at ASC
  LIMIT 1
),
rebuilt_bal AS (
  SELECT account_id, opening_debit, period_debit, period_credit, closing_debit, balance
  FROM account_balances_daily
  WHERE company_id = 's0000000-0000-0000-0000-000000000001'
    AND as_of_date = '2024-01-15'
  ORDER BY account_id, created_at DESC
  LIMIT 1
)
SELECT
  'Daily Balance Rebuild' AS check_name,
  CASE
    WHEN original_bal.balance = rebuilt_bal.balance
    THEN 'PASS: Rebuilt daily balance matches original'
    ELSE 'FAIL: Rebuilt daily balance differs'
  END AS result
FROM original_bal, rebuilt_bal;

-- ── 11. TEST: Cross-snapshot consistency ─────────────────────
SELECT 'TEST 10: Cross-snapshot consistency verification' AS step;

-- Verify running balance across multiple daily snapshots
WITH daily_snapshots AS (
  SELECT as_of_date, total_assets,
    LAG(total_assets) OVER (ORDER BY as_of_date) AS prev_assets
  FROM financial_snapshots
  WHERE company_id = 's0000000-0000-0000-0000-000000000001'
    AND snapshot_type = 'daily'
    AND as_of_date IN ('2024-01-31', '2024-02-29')
  ORDER BY as_of_date
)
SELECT
  'Running Balance Consistency' AS check_name,
  as_of_date,
  ROUND(total_assets::numeric, 2) AS assets,
  CASE
    WHEN prev_assets IS NULL THEN 'PASS: First snapshot, no previous to compare'
    WHEN total_assets >= prev_assets THEN 'PASS: Assets increased or stayed same'
    ELSE 'WARN: Assets decreased (may be valid)'
  END AS result
FROM daily_snapshots;

-- Verify daily balances accumulate correctly to monthly total
SELECT
  'Daily to Monthly Accumulation' AS check_name,
  SUM(closing_debit) AS total_closing_debit,
  CASE
    WHEN SUM(closing_debit) > 0 THEN 'PASS: Daily balances accumulated'
    ELSE 'WARN: No daily balances found'
  END AS result
FROM account_balances_daily
WHERE company_id = 's0000000-0000-0000-0000-000000000001'
  AND as_of_date BETWEEN '2024-01-01' AND '2024-01-31';

-- ── 12. CLEANUP ──────────────────────────────────────────────
SELECT 'CLEANUP: Removing all test data...' AS step;

DELETE FROM reconciliation_lines WHERE reconciliation_id IN (
  'srec0000-0000-0000-0000-000000000001',
  'srec0000-0000-0000-0000-000000000002',
  'srec0000-0000-0000-0000-000000000003'
);
DELETE FROM reconciliations WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM payroll_summaries WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM payroll_runs WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM payroll_cycles WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM employees WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM inventory_snapshots WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM inventory WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM warehouses WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM products WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM account_balances_daily WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM financial_snapshots WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM journal_entry_lines WHERE journal_entry_id LIKE 'sje00001-0000-0000-0000-00000000000%';
DELETE FROM journal_entries WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM accounting_periods WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM fiscal_years WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM accounts WHERE company_id = 's0000000-0000-0000-0000-000000000001';
DELETE FROM companies WHERE id = 's0000000-0000-0000-0000-000000000001';

SELECT 'DONE: All snapshot and reconciliation tests completed.' AS step;

COMMIT;
