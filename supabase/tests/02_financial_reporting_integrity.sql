-- ============================================================
-- Financial Reporting Integrity — SQL Test Harness
-- WARNING: This test creates data and cleans up. It uses
-- fixed UUIDs for reproducibility. Run in a test/CI database.
-- ============================================================

BEGIN;

-- ── 1. SETUP ─────────────────────────────────────────────────
SELECT 'SETUP: Creating test companies, chart of accounts, periods...' AS step;

-- Create test companies
INSERT INTO companies (id, name, name_ar, slug, currency, language)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Test Company A', 'شركة الاختبار أ', 'test-co-a', 'SAR', 'ar'),
  ('a0000000-0000-0000-0000-000000000002', 'Test Company B', 'شركة الاختبار ب', 'test-co-b', 'SAR', 'ar')
ON CONFLICT (slug) DO NOTHING;

-- Create test branch
INSERT INTO branches (id, company_id, code, name, name_ar, is_active)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'BR-MAIN', 'Main Branch', 'الفرع الرئيسي', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'BR-SECONDARY', 'Secondary Branch', 'الفرع الثانوي', true)
ON CONFLICT (company_id, code) DO NOTHING;

-- Create chart of accounts for Company A (with extended columns needed for reporting)
INSERT INTO accounts (id, company_id, code, name, name_ar, type, normal_balance, is_active, is_postable, is_header, opening_balance, is_receivable, is_payable)
VALUES
  -- Assets
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '1101', 'Cash', 'النقدية', 'asset', 'debit', true, true, false, 0, false, false),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '1110', 'Accounts Receivable', 'ذمم مدينة', 'asset', 'debit', true, true, false, 0, true, false),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '1201', 'Equipment', 'معدات', 'asset', 'debit', true, true, false, 0, false, false),
  -- Liabilities
  ('a1000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', '2101', 'Accounts Payable', 'ذمم دائنة', 'liability', 'credit', true, true, false, 0, false, true),
  ('a1000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', '2120', 'Taxes Payable', 'ضرائب مستحقة', 'liability', 'credit', true, true, false, 0, false, false),
  -- Equity
  ('a1000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000001', '3001', 'Owner Capital', 'رأس المال', 'equity', 'credit', true, true, false, 0, false, false),
  ('a1000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', '3002', 'Retained Earnings', 'أرباح محتجزة', 'equity', 'credit', true, true, false, 0, false, false),
  ('a1000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', '3003', 'Net Income', 'صافي الدخل', 'equity', 'credit', true, true, false, 0, false, false),
  -- Revenue
  ('a1000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', '4001', 'Sales Revenue', 'إيرادات مبيعات', 'revenue', 'credit', true, true, false, 0, false, false),
  -- Expenses
  ('a1000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000001', '5001', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', 'cogs', 'debit', true, true, false, 0, false, false),
  ('a1000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', '6501', 'Rent Expense', 'مصروف إيجار', 'expense', 'debit', true, true, false, 0, false, false)
ON CONFLICT (company_id, code) DO NOTHING;

-- Chart of accounts for Company B (minimal)
INSERT INTO accounts (id, company_id, code, name, name_ar, type, normal_balance, is_active, is_postable, is_header, opening_balance, is_receivable, is_payable)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '1101', 'Cash B', 'نقدية ب', 'asset', 'debit', true, true, false, 0, false, false),
  ('b1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '4001', 'Sales Revenue B', 'إيرادات مبيعات ب', 'revenue', 'credit', true, true, false, 0, false, false)
ON CONFLICT (company_id, code) DO NOTHING;

-- Create fiscal year 2024 for Company A
INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, status, is_current)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FY 2024', '2024-01-01', '2024-12-31', 'active', true)
ON CONFLICT DO NOTHING;

-- Create accounting periods for Company A (Jan, Feb, Mar 2024)
INSERT INTO accounting_periods (id, company_id, fiscal_year_id, period_number, name, start_date, end_date, status)
VALUES
  ('p0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'January 2024', '2024-01-01', '2024-01-31', 'open'),
  ('p0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 2, 'February 2024', '2024-02-01', '2024-02-29', 'open'),
  ('p0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 3, 'March 2024', '2024-03-01', '2024-03-31', 'open')
ON CONFLICT DO NOTHING;

-- Create customer for aging tests
INSERT INTO parties (id, company_id, name, name_ar, type, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Customer Alpha', 'العميل ألف', 'customer', true),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Customer Beta', 'العميل باء', 'customer', true)
ON CONFLICT DO NOTHING;

-- ── 2. CREATE BALANCED JOURNAL ENTRIES ───────────────────────
SELECT 'JOURNALS: Creating balanced journal entries across multiple periods...' AS step;

-- Entry 1: Jan 15 - Sales revenue (Cash Dr 10000, Sales Cr 10000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-001', '2024-01-15', 'January Sales', 'posted', 10000, 10000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 10000, 0, 'Cash receipt from sales', 1),
  ('je000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000030', 0, 10000, 'Sales revenue', 2);

-- Entry 2: Jan 20 - Rent expense (Rent Dr 2000, Cash Cr 2000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-002', '2024-01-20', 'Office Rent January', 'posted', 2000, 2000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000041', 2000, 0, 'Rent expense', 1),
  ('je000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 0, 2000, 'Cash payment', 2);

-- Entry 3: Feb 10 - February Sales (Cash Dr 15000, Sales Cr 15000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-003', '2024-02-10', 'February Sales', 'posted', 15000, 15000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 15000, 0, 'Cash receipt from sales', 1),
  ('je000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000030', 0, 15000, 'Sales revenue', 2);

-- Entry 4: Feb 15 - COGS (COGS Dr 8000, Cash Cr 8000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-004', '2024-02-15', 'Cost of Goods Sold Feb', 'posted', 8000, 8000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000040', 8000, 0, 'COGS entry', 1),
  ('je000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 0, 8000, 'Cash payment for inventory', 2);

-- Entry 5: Mar 5 - March Sales (AR Dr 20000, Sales Cr 20000) - credit sale
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-005', '2024-03-05', 'March Credit Sales', 'posted', 20000, 20000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 20000, 0, 'Accounts receivable', 1),
  ('je000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000030', 0, 20000, 'Sales revenue (credit)', 2);

-- Entry 6: Mar 20 - Equipment purchase (Equipment Dr 5000, Cash Cr 5000) via secondary branch
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id, branch_id)
VALUES ('je000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-006', '2024-03-20', 'Equipment Purchase - Secondary Branch', 'posted', 5000, 5000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000000',
        'b0000000-0000-0000-0000-000000000002');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number, branch_id)
VALUES
  ('je000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', 5000, 0, 'Equipment purchase', 1, 'b0000000-0000-0000-0000-000000000002'),
  ('je000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 0, 5000, 'Cash payment', 2, 'b0000000-0000-0000-0000-000000000002');

-- Entry 7: Owner capital contribution (Cash Dr 50000, Capital Cr 50000)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'JE-2024-007', '2024-01-01', 'Owner Capital Contribution', 'posted', 50000, 50000,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 50000, 0, 'Capital contribution', 1),
  ('je000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000020', 0, 50000, 'Owner capital', 2);

-- ── 3. TEST: ledger_get_trial_balance ────────────────────────
SELECT 'TEST 1: ledger_get_trial_balance - verify debits = credits' AS step;

WITH tb AS (
  SELECT * FROM ledger_get_trial_balance(
    'a0000000-0000-0000-0000-000000000001',
    '2024-01-01',
    '2024-03-31'
  )
)
SELECT
  'Trial Balance' AS report,
  ROUND(SUM(period_debit)::numeric, 2) AS total_period_debit,
  ROUND(SUM(period_credit)::numeric, 2) AS total_period_credit,
  CASE
    WHEN ROUND(SUM(period_debit)::numeric, 2) = ROUND(SUM(period_credit)::numeric, 2)
    THEN 'PASS: Debits = Credits'
    ELSE 'FAIL: Debits != Credits'
  END AS result
FROM tb;

-- ── 4. TEST: ledger_get_account_balance ──────────────────────
SELECT 'TEST 2: ledger_get_account_balance - spot check individual accounts' AS step;

SELECT
  'Cash (1101) balance as of 2024-03-31' AS description,
  ledger_get_account_balance('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') AS balance,
  CASE
    WHEN ledger_get_account_balance('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') = 60000
    THEN 'PASS: Cash = 60000 (50000 capital + 10000 jan sales - 2000 rent + 15000 feb sales - 8000 cogs - 5000 equipment)'
    ELSE 'FAIL: unexpected balance'
  END AS result;

SELECT
  'Sales Revenue (4001) balance as of 2024-03-31' AS description,
  ledger_get_account_balance('a1000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') AS balance,
  CASE
    WHEN ledger_get_account_balance('a1000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') = 45000
    THEN 'PASS: Sales = 45000 (10000 + 15000 + 20000)'
    ELSE 'FAIL: unexpected balance'
  END AS result;

SELECT
  'Rent Expense (6501) balance as of 2024-03-31' AS description,
  ledger_get_account_balance('a1000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') AS balance,
  CASE
    WHEN ledger_get_account_balance('a1000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000001', '2024-03-31') = 2000
    THEN 'PASS: Rent = 2000'
    ELSE 'FAIL: unexpected balance'
  END AS result;

-- Spot check as of end of January only
SELECT
  'Cash balance as of 2024-01-31 only' AS description,
  ledger_get_account_balance('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-01-31') AS balance,
  CASE
    WHEN ledger_get_account_balance('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2024-01-31') = 58000
    THEN 'PASS: Cash at Jan end = 58000 (50000 capital + 10000 sales - 2000 rent)'
    ELSE 'FAIL: unexpected balance'
  END AS result;

-- ── 5. TEST: ledger_get_all_balances ─────────────────────────
SELECT 'TEST 3: ledger_get_all_balances - verify totals' AS step;

WITH all_bal AS (
  SELECT * FROM ledger_get_all_balances(
    'a0000000-0000-0000-0000-000000000001',
    '2024-03-31'
  )
)
SELECT
  'All Balances' AS report,
  COUNT(*) AS account_count,
  ROUND(SUM(total_debit)::numeric, 2) AS total_debit,
  ROUND(SUM(total_credit)::numeric, 2) AS total_credit,
  CASE
    WHEN ROUND(SUM(total_debit)::numeric, 2) = ROUND(SUM(total_credit)::numeric, 2)
    THEN 'PASS: Total Debits = Total Credits'
    ELSE 'FAIL: Mismatch'
  END AS result
FROM all_bal;

-- ── 6. TEST: ledger_get_period_balances ──────────────────────
SELECT 'TEST 4: ledger_get_period_balances - verify opening + period = closing' AS step;

WITH pb AS (
  SELECT * FROM ledger_get_period_balances(
    'a0000000-0000-0000-0000-000000000001',
    'p0000000-0000-0000-0000-000000000001'
  )
)
SELECT
  account_code,
  ROUND(opening_balance::numeric, 2) AS opening,
  ROUND(period_debit::numeric, 2) AS period_dr,
  ROUND(period_credit::numeric, 2) AS period_cr,
  ROUND(closing_balance::numeric, 2) AS closing,
  ROUND((opening_balance + period_debit - period_credit)::numeric, 2) AS expected_closing,
  CASE
    WHEN ROUND(closing_balance::numeric, 2) = ROUND((opening_balance + period_debit - period_credit)::numeric, 2)
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM pb
ORDER BY account_code;

-- ── 7. TEST: get_income_statement ────────────────────────────
SELECT 'TEST 5: get_income_statement - verify net income = revenue - expenses' AS step;

WITH is_stmt AS (
  SELECT * FROM get_income_statement(
    'a0000000-0000-0000-0000-000000000001',
    '2024-01-01',
    '2024-03-31'
  )
)
SELECT
  'Income Statement' AS report,
  (is_stmt.data->>'revenue'::text)::jsonb AS revenue_data,
  (is_stmt.data->>'cogs'::text)::jsonb AS cogs_data,
  (is_stmt.data->>'expenses'::text)::jsonb AS expenses_data,
  CASE
    WHEN jsonb_array_length((is_stmt.data->>'revenue'::text)::jsonb) > 0
    THEN 'PASS: Revenue accounts present'
    ELSE 'FAIL: No revenue data'
  END AS result
FROM is_stmt;

-- Extract totals manually
WITH revenue AS (
  SELECT COALESCE(SUM((item->>'amount')::numeric), 0) AS total
  FROM get_income_statement('a0000000-0000-0000-0000-000000000001', '2024-01-01', '2024-03-31') is_stmt,
  jsonb_array_elements((is_stmt.data->>'revenue'::text)::jsonb) AS item
),
cogs AS (
  SELECT COALESCE(SUM((item->>'amount')::numeric), 0) AS total
  FROM get_income_statement('a0000000-0000-0000-0000-000000000001', '2024-01-01', '2024-03-31') is_stmt,
  jsonb_array_elements((is_stmt.data->>'cogs'::text)::jsonb) AS item
),
expenses AS (
  SELECT COALESCE(SUM((item->>'amount')::numeric), 0) AS total
  FROM get_income_statement('a0000000-0000-0000-0000-000000000001', '2024-01-01', '2024-03-31') is_stmt,
  jsonb_array_elements((is_stmt.data->>'expenses'::text)::jsonb) AS item
)
SELECT
  'Net Income Check' AS report,
  ROUND(revenue.total::numeric, 2) AS total_revenue,
  ROUND(cogs.total::numeric, 2) AS total_cogs,
  ROUND(expenses.total::numeric, 2) AS total_expenses,
  ROUND((revenue.total - cogs.total - expenses.total)::numeric, 2) AS net_income,
  CASE
    WHEN ROUND((revenue.total - cogs.total - expenses.total)::numeric, 2) = 35000
    THEN 'PASS: Net Income = 35000 (45000 revenue - 8000 cogs - 2000 expenses)'
    ELSE 'FAIL: unexpected net income'
  END AS result
FROM revenue, cogs, expenses;

-- ── 8. TEST: get_balance_sheet ───────────────────────────────
SELECT 'TEST 6: get_balance_sheet - verify assets = liabilities + equity' AS step;

WITH bs AS (
  SELECT * FROM get_balance_sheet(
    'a0000000-0000-0000-0000-000000000001',
    '2024-03-31'
  )
)
SELECT
  'Balance Sheet' AS report,
  (bs.data->'assets'->>'current'::text)::jsonb AS current_assets,
  (bs.data->'assets'->>'fixed'::text)::jsonb AS fixed_assets,
  (bs.data->'liabilities'::text)::jsonb AS liabilities,
  (bs.data->'equity'::text)::jsonb AS equity,
  CASE
    WHEN (bs.data->'equity'->>'capital'::text)::numeric = 50000
    THEN 'PASS: Capital = 50000'
    ELSE 'FAIL: unexpected capital'
  END AS capital_check
FROM bs;

-- Assets vs Liabilities+Equity check
WITH bs_values AS (
  SELECT
    COALESCE(SUM((item->>'amount')::numeric), 0) AS total_assets
  FROM get_balance_sheet('a0000000-0000-0000-0000-000000000001', '2024-03-31') bs,
  jsonb_each((bs.data->'assets'::text)::jsonb) AS asset_cat,
  jsonb_array_elements(CASE
    WHEN jsonb_typeof(asset_cat.value) = 'array' THEN asset_cat.value
    ELSE '[]'::jsonb
  END) AS item
  WHERE asset_cat.key IN ('current', 'fixed')
),
liability_values AS (
  SELECT
    COALESCE(SUM((item->>'amount')::numeric), 0) AS total_liabilities
  FROM get_balance_sheet('a0000000-0000-0000-0000-000000000001', '2024-03-31') bs,
  jsonb_each((bs.data->'liabilities'::text)::jsonb) AS liab_cat,
  jsonb_array_elements(CASE
    WHEN jsonb_typeof(liab_cat.value) = 'array' THEN liab_cat.value
    ELSE '[]'::jsonb
  END) AS item
  WHERE liab_cat.key IN ('current', 'long_term')
),
equity_values AS (
  SELECT
    COALESCE((bs.data->'equity'->>'capital'::text)::numeric, 0) +
    COALESCE((bs.data->'equity'->>'retained_earnings'::text)::numeric, 0) +
    COALESCE((bs.data->'equity'->>'net_income'::text)::numeric, 0) AS total_equity
  FROM get_balance_sheet('a0000000-0000-0000-0000-000000000001', '2024-03-31') bs
)
SELECT
  'Balance Sheet Equation' AS report,
  ROUND(bs_values.total_assets::numeric, 2) AS total_assets,
  ROUND(liability_values.total_liabilities::numeric, 2) AS total_liabilities,
  ROUND(equity_values.total_equity::numeric, 2) AS total_equity,
  ROUND((liability_values.total_liabilities + equity_values.total_equity)::numeric, 2) AS liab_plus_equity,
  CASE
    WHEN ROUND(bs_values.total_assets::numeric, 2) = ROUND((liability_values.total_liabilities + equity_values.total_equity)::numeric, 2)
    THEN 'PASS: Assets = Liabilities + Equity'
    ELSE 'FAIL: Equation does not balance'
  END AS result
FROM bs_values, liability_values, equity_values;

-- ── 9. TEST: check_unbalanced_entries ────────────────────────
SELECT 'TEST 7: check_unbalanced_entries - insert unbalanced entry, verify detection' AS step;

-- All entries are balanced so far, should return 0
SELECT
  'Unbalanced Entries Check (before)' AS description,
  COALESCE((SELECT COUNT(*) FROM check_unbalanced_entries('a0000000-0000-0000-0000-000000000001')), 0) AS count,
  CASE
    WHEN (SELECT COUNT(*) FROM check_unbalanced_entries('a0000000-0000-0000-0000-000000000001')) = 0
    THEN 'PASS: No unbalanced entries detected'
    ELSE 'FAIL: Unexpected unbalanced entries'
  END AS result;

-- Now insert an unbalanced entry (debits != credits)
INSERT INTO journal_entries (id, company_id, entry_number, date, description, status, total_debit, total_credit, fiscal_year_id, period_id, is_posted, created_by_id)
VALUES ('je000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000001', 'JE-UNBAL-001', '2024-03-31', 'Unbalanced Test Entry', 'posted', 1000, 900,
        'f0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000000');

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_number)
VALUES
  ('je000000-0000-0000-0000-000000000099', 'a1000000-0000-0000-0000-000000000001', 1000, 0, 'Unbalanced debit', 1),
  ('je000000-0000-0000-0000-000000000099', 'a1000000-0000-0000-0000-000000000030', 0, 900, 'Unbalanced credit', 2);

SELECT
  'Unbalanced Entries Check (after inserting bad entry)' AS description,
  COUNT(*) AS unbalanced_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS: Unbalanced entry detected'
    ELSE 'FAIL: Unbalanced entry not detected'
  END AS result
FROM check_unbalanced_entries('a0000000-0000-0000-0000-000000000001');

-- Clean up unbalanced test entry
DELETE FROM journal_entry_lines WHERE journal_entry_id = 'je000000-0000-0000-0000-000000000099';
DELETE FROM journal_entries WHERE id = 'je000000-0000-0000-0000-000000000099';

-- ── 10. TEST: ledger_get_general_ledger ──────────────────────
SELECT 'TEST 8: ledger_get_general_ledger - test various filters' AS step;

-- All entries for Cash account
SELECT
  'General Ledger - Cash account' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS: GL returns data for Cash account'
    ELSE 'FAIL: No data returned'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  '2024-01-01',
  '2024-03-31',
  NULL,
  NULL
);

-- Filter by branch (secondary branch - should get equipment purchase entry)
SELECT
  'General Ledger - Secondary Branch filter' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS: Branch filter returns correct subset (2 lines for equipment purchase)'
    ELSE 'FAIL: Unexpected count'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  '2024-01-01',
  '2024-03-31',
  NULL,
  'b0000000-0000-0000-0000-000000000002'
);

-- Filter by date range (January only)
SELECT
  'General Ledger - January only' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 4 THEN 'PASS: January filter returns 4 lines (capital + sales + rent)'
    ELSE 'FAIL: Unexpected count'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  '2024-01-01',
  '2024-01-31',
  NULL,
  NULL
);

-- Unfiltered (all entries)
SELECT
  'General Ledger - Unfiltered (all branches/all accounts)' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 14 THEN 'PASS: Unfiltered returns all 14 lines (2 per entry x 7 entries)'
    ELSE 'FAIL: Unexpected count'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
);

-- ── 11. TEST: get_sales_summary ──────────────────────────────
SELECT 'TEST 9: get_sales_summary - create sample invoices and test' AS step;

-- Create sample invoices
INSERT INTO invoices (id, company_id, invoice_no, customer_id, customer_name, status, invoice_type, invoice_date, due_date, subtotal, discount_amount, tax_amount, total, paid_amount)
VALUES
  ('i0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'INV-2024-001', 'c0000000-0000-0000-0000-000000000001', 'Customer Alpha', 'posted', 'standard', '2024-01-15', '2024-02-14', 5000, 0, 750, 5750, 0),
  ('i0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'INV-2024-002', 'c0000000-0000-0000-0000-000000000001', 'Customer Alpha', 'posted', 'standard', '2024-01-20', '2024-02-19', 3000, 100, 435, 3335, 0),
  ('i0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'INV-2024-003', 'c0000000-0000-0000-0000-000000000002', 'Customer Beta', 'paid', 'standard', '2024-02-10', '2024-03-11', 8000, 0, 1200, 9200, 9200),
  ('i0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'INV-2024-004', 'c0000000-0000-0000-0000-000000000002', 'Customer Beta', 'draft', 'standard', '2024-03-01', '2024-03-31', 2000, 0, 300, 2300, 0) -- draft should be excluded
ON CONFLICT (company_id, invoice_no) DO NOTHING;

-- Sales summary for January
WITH ss_jan AS (
  SELECT * FROM get_sales_summary(
    'a0000000-0000-0000-0000-000000000001',
    '2024-01-01',
    '2024-01-31'
  )
)
SELECT
  'Sales Summary - January' AS report,
  SUM(invoice_count)::BIGINT AS total_invoices,
  ROUND(SUM(total_sales)::numeric, 2) AS total_sales,
  ROUND(SUM(total_tax)::numeric, 2) AS total_tax,
  ROUND(SUM(total_discount)::numeric, 2) AS total_discount,
  ROUND(SUM(net_sales)::numeric, 2) AS net_sales,
  CASE
    WHEN SUM(invoice_count) = 2 AND ROUND(SUM(total_sales)::numeric, 2) = 8000
    THEN 'PASS: Jan summary correct (2 invoices, 8000 sales)'
    ELSE 'FAIL: unexpected summary'
  END AS result
FROM ss_jan;

-- Sales summary for February
WITH ss_feb AS (
  SELECT * FROM get_sales_summary(
    'a0000000-0000-0000-0000-000000000001',
    '2024-02-01',
    '2024-02-29'
  )
)
SELECT
  'Sales Summary - February' AS report,
  SUM(invoice_count)::BIGINT AS total_invoices,
  ROUND(SUM(total_sales)::numeric, 2) AS total_sales,
  CASE
    WHEN SUM(invoice_count) = 1 AND ROUND(SUM(total_sales)::numeric, 2) = 8000
    THEN 'PASS: Feb summary correct (1 invoice, 8000 sales)'
    ELSE 'FAIL: unexpected summary'
  END AS result
FROM ss_feb;

-- Date range with no invoices
SELECT
  'Sales Summary - Empty range' AS description,
  CASE
    WHEN (SELECT COUNT(*) FROM get_sales_summary('a0000000-0000-0000-0000-000000000001', '2025-01-01', '2025-01-31')) = 0
    THEN 'PASS: Empty range returns no rows'
    ELSE 'FAIL: Unexpected rows'
  END AS result;

-- ── 12. TEST: get_customer_aging ─────────────────────────────
SELECT 'TEST 10: get_customer_aging - test with known data' AS step;

-- Aging as of 2024-03-31
-- INV-001: due 2024-02-14 (45 days overdue = 31-60 bucket, 5750 balance_due)
-- INV-002: due 2024-02-19 (40 days overdue = 31-60 bucket, 3335 balance_due)
-- INV-003: paid (excluded)
-- INV-004: draft (excluded)
-- Customer Alpha total: 5750 + 3335 = 9085, all in 31-60 bucket
WITH aging AS (
  SELECT * FROM get_customer_aging(
    'a0000000-0000-0000-0000-000000000001',
    '2024-03-31'
  )
)
SELECT
  'Customer Aging' AS report,
  customer_name,
  ROUND(total_balance::numeric, 2) AS total_balance,
  ROUND(current_amount::numeric, 2) AS current,
  ROUND(days_1_30::numeric, 2) AS "0-30",
  ROUND(days_31_60::numeric, 2) AS "31-60",
  ROUND(days_61_90::numeric, 2) AS "61-90",
  ROUND(days_90_plus::numeric, 2) AS "90+",
  CASE
    WHEN customer_name = 'Customer Alpha' AND ROUND(total_balance::numeric, 2) = 9085 AND ROUND(days_31_60::numeric, 2) = 9085
    THEN 'PASS: Customer Alpha aging correct (9085 total, all 31-60)'
    ELSE 'FAIL: unexpected aging'
  END AS result
FROM aging
ORDER BY total_balance DESC;

-- ── 13. TEST: Tenant Isolation ───────────────────────────────
SELECT 'TEST 11: Tenant Isolation - Company A data does not leak into Company B' AS step;

-- Company B should have zero balance everywhere
SELECT
  'Company B - Account Balance (should be 0)' AS description,
  ledger_get_account_balance('b1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '2024-03-31') AS cash_balance,
  CASE
    WHEN ledger_get_account_balance('b1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '2024-03-31') = 0
    THEN 'PASS: Company B has zero balance (no transactions)'
    ELSE 'FAIL: Company B has unexpected balance'
  END AS result;

-- Company B trial balance should be empty
SELECT
  'Company B - Trial Balance' AS description,
  COUNT(*) AS line_count,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS: Company B trial balance is empty'
    ELSE 'FAIL: Company B trial balance has data (cross-contamination)'
  END AS result
FROM ledger_get_trial_balance('a0000000-0000-0000-0000-000000000002', '2024-01-01', '2024-03-31');

-- Company B general ledger should be empty
SELECT
  'Company B - General Ledger' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 0 THEN 'PASS: Company B general ledger is empty'
    ELSE 'FAIL: Company B GL has entries (cross-contamination)'
  END AS result
FROM ledger_get_general_ledger('a0000000-0000-0000-0000-000000000002', NULL, NULL, NULL, NULL, NULL);

-- ── 14. TEST: Branch Filtering ───────────────────────────────
SELECT 'TEST 12: Branch Filtering - verify branch-specific data' AS step;

-- Secondary branch should only have the equipment purchase entry (2 lines)
SELECT
  'Branch Filter - Secondary Branch GL' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 2 THEN 'PASS: Secondary branch filter returns 2 lines (equipment purchase)'
    ELSE 'FAIL: Unexpected count'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  NULL, NULL, NULL, NULL,
  'b0000000-0000-0000-0000-000000000002'
);

-- Unfiltered should return all entries
SELECT
  'Branch Filter - No filter (all branches)' AS description,
  COUNT(*) AS entry_count,
  CASE
    WHEN COUNT(*) = 14 THEN 'PASS: Unfiltered query returns all 14 lines'
    ELSE 'FAIL: Unexpected count'
  END AS result
FROM ledger_get_general_ledger(
  'a0000000-0000-0000-0000-000000000001',
  NULL, NULL, NULL, NULL, NULL
);

-- ── 15. CLEANUP ──────────────────────────────────────────────
SELECT 'CLEANUP: Removing test data...' AS step;

DELETE FROM journal_entry_lines WHERE journal_entry_id IN (
  'je000000-0000-0000-0000-000000000001',
  'je000000-0000-0000-0000-000000000002',
  'je000000-0000-0000-0000-000000000003',
  'je000000-0000-0000-0000-000000000004',
  'je000000-0000-0000-0000-000000000005',
  'je000000-0000-0000-0000-000000000006',
  'je000000-0000-0000-0000-000000000007'
);
DELETE FROM journal_entries WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND entry_number LIKE 'JE-2024%';
DELETE FROM invoices WHERE company_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM parties WHERE company_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM accounting_periods WHERE company_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM fiscal_years WHERE company_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM accounts WHERE company_id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');
DELETE FROM branches WHERE company_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM companies WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');

SELECT 'DONE: All financial reporting integrity tests completed.' AS step;

COMMIT;
