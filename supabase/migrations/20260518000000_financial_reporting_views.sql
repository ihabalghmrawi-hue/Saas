-- Materialized views for financial reporting performance

-- Trial balance materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trial_balance AS
SELECT
  je.company_id,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.name_ar AS account_name_ar,
  a.type AS account_type,
  a.normal_balance,
  a.opening_balance,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  COUNT(*) AS line_count
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
GROUP BY je.company_id, a.id, a.code, a.name, a.name_ar, a.type, a.normal_balance, a.opening_balance;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trial_balance_pk ON mv_trial_balance (company_id, account_id);

-- Income statement materialized view (aggregated by account type)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_income_statement AS
SELECT
  je.company_id,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.name_ar AS account_name_ar,
  a.type AS account_type,
  EXTRACT(YEAR FROM je.date::date)::int AS fiscal_year,
  EXTRACT(MONTH FROM je.date::date)::int AS fiscal_month,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  COALESCE(SUM(jel.debit - jel.credit), 0) AS net_amount
FROM accounts a
JOIN journal_entry_lines jel ON jel.account_id = a.id
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.type IN ('revenue', 'cogs', 'expense')
GROUP BY je.company_id, a.id, a.code, a.name, a.name_ar, a.type, fiscal_year, fiscal_month;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_income_statement_pk ON mv_income_statement (company_id, account_id, fiscal_year, fiscal_month);

-- Balance sheet materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_balance_sheet AS
SELECT
  je.company_id,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.name_ar AS account_name_ar,
  a.type AS account_type,
  a.normal_balance,
  a.opening_balance,
  COALESCE(SUM(jel.debit), 0) AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  (a.opening_balance + COALESCE(SUM(jel.debit - jel.credit), 0)) AS calculated_balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.type IN ('asset', 'liability', 'equity')
GROUP BY je.company_id, a.id, a.code, a.name, a.name_ar, a.type, a.normal_balance, a.opening_balance;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_balance_sheet_pk ON mv_balance_sheet (company_id, account_id);

-- Function to refresh all reporting materialized views
CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_income_statement;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_balance_sheet;
END;
$$;

-- RPC: Get income statement via materialized view
CREATE OR REPLACE FUNCTION get_income_statement(
  p_company_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'revenue', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar,
        'amount', net_amount
      ))
      FROM mv_income_statement
      WHERE company_id = p_company_id AND account_type = 'revenue'
        AND (fiscal_year > EXTRACT(YEAR FROM p_from_date) OR (fiscal_year = EXTRACT(YEAR FROM p_from_date) AND fiscal_month >= EXTRACT(MONTH FROM p_from_date)))
        AND (fiscal_year < EXTRACT(YEAR FROM p_to_date) OR (fiscal_year = EXTRACT(YEAR FROM p_to_date) AND fiscal_month <= EXTRACT(MONTH FROM p_to_date)))
      HAVING SUM(net_amount) != 0
    ), '[]'::jsonb),
    'cogs', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar,
        'amount', ABS(net_amount)
      ))
      FROM mv_income_statement
      WHERE company_id = p_company_id AND account_type = 'cogs'
        AND (fiscal_year > EXTRACT(YEAR FROM p_from_date) OR (fiscal_year = EXTRACT(YEAR FROM p_from_date) AND fiscal_month >= EXTRACT(MONTH FROM p_from_date)))
        AND (fiscal_year < EXTRACT(YEAR FROM p_to_date) OR (fiscal_year = EXTRACT(YEAR FROM p_to_date) AND fiscal_month <= EXTRACT(MONTH FROM p_to_date)))
      HAVING SUM(net_amount) != 0
    ), '[]'::jsonb),
    'expenses', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar,
        'amount', ABS(net_amount)
      ))
      FROM mv_income_statement
      WHERE company_id = p_company_id AND account_type = 'expense'
        AND (fiscal_year > EXTRACT(YEAR FROM p_from_date) OR (fiscal_year = EXTRACT(YEAR FROM p_from_date) AND fiscal_month >= EXTRACT(MONTH FROM p_from_date)))
        AND (fiscal_year < EXTRACT(YEAR FROM p_to_date) OR (fiscal_year = EXTRACT(YEAR FROM p_to_date) AND fiscal_month <= EXTRACT(MONTH FROM p_to_date)))
      HAVING SUM(net_amount) != 0
    ), '[]'::jsonb),
    'period_from', p_from_date,
    'period_to', p_to_date
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: Get balance sheet via materialized view
CREATE OR REPLACE FUNCTION get_balance_sheet(
  p_company_id UUID,
  p_as_of_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_net_income NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN normal_balance = 'debit' THEN calculated_balance ELSE -calculated_balance END
  ), 0)
  INTO v_net_income
  FROM mv_balance_sheet
  WHERE company_id = p_company_id AND account_type = 'equity' AND account_code = '3003';

  SELECT jsonb_build_object(
    'assets', jsonb_build_object(
      'current', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar, 'amount', calculated_balance
        ))
        FROM mv_balance_sheet
        WHERE company_id = p_company_id AND account_type = 'asset' AND account_code LIKE '11%'
        HAVING SUM(calculated_balance) != 0
      ), '[]'::jsonb),
      'fixed', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar, 'amount', calculated_balance
        ))
        FROM mv_balance_sheet
        WHERE company_id = p_company_id AND account_type = 'asset' AND account_code NOT LIKE '11%'
        HAVING SUM(calculated_balance) != 0
      ), '[]'::jsonb)
    ),
    'liabilities', jsonb_build_object(
      'current', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar, 'amount', calculated_balance
        ))
        FROM mv_balance_sheet
        WHERE company_id = p_company_id AND account_type = 'liability' AND account_code LIKE '21%'
        HAVING SUM(calculated_balance) != 0
      ), '[]'::jsonb),
      'long_term', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'account_id', account_id, 'code', account_code, 'name', account_name, 'name_ar', account_name_ar, 'amount', calculated_balance
        ))
        FROM mv_balance_sheet
        WHERE company_id = p_company_id AND account_type = 'liability' AND account_code NOT LIKE '21%'
        HAVING SUM(calculated_balance) != 0
      ), '[]'::jsonb)
    ),
    'equity', jsonb_build_object(
      'capital', COALESCE((SELECT calculated_balance FROM mv_balance_sheet WHERE company_id = p_company_id AND account_code = '3001' LIMIT 1), 0),
      'retained_earnings', COALESCE((SELECT calculated_balance FROM mv_balance_sheet WHERE company_id = p_company_id AND account_code = '3002' LIMIT 1), 0),
      'net_income', v_net_income
    ),
    'period_date', p_as_of_date
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: Get cash flow statement
CREATE OR REPLACE FUNCTION get_cash_flow(
  p_company_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revenue_net NUMERIC;
  v_expense_net NUMERIC;
  v_ar_change NUMERIC;
  v_ap_change NUMERIC;
  v_fixed_asset_purchases NUMERIC;
BEGIN
  SELECT COALESCE(SUM(credit - debit), 0) INTO v_revenue_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = p_company_id AND je.status = 'posted'
    AND jel.account_id IN (SELECT id FROM accounts WHERE code = '4001')
    AND je.date::date BETWEEN p_from_date AND p_to_date;

  SELECT COALESCE(SUM(debit - credit), 0) INTO v_expense_net
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = p_company_id AND je.status = 'posted'
    AND jel.account_id IN (SELECT id FROM accounts WHERE company_id = p_company_id AND code IN ('5001', '6501'))
    AND je.date::date BETWEEN p_from_date AND p_to_date;

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_ar_change
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = p_company_id AND je.status = 'posted'
    AND jel.account_id IN (SELECT id FROM accounts WHERE code = '1110')
    AND je.date::date BETWEEN p_from_date AND p_to_date;

  SELECT COALESCE(SUM(jel.credit - jel.debit), 0) INTO v_ap_change
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = p_company_id AND je.status = 'posted'
    AND jel.account_id IN (SELECT id FROM accounts WHERE code = '2101')
    AND je.date::date BETWEEN p_from_date AND p_to_date;

  SELECT COALESCE(SUM(jel.debit), 0) INTO v_fixed_asset_purchases
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = p_company_id AND je.status = 'posted'
    AND jel.account_id IN (SELECT id FROM accounts WHERE code = '1201')
    AND je.date::date BETWEEN p_from_date AND p_to_date;

  RETURN jsonb_build_object(
    'operating', jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('code', '4001', 'name', 'صافي الإيرادات', 'name_ar', 'صافي الإيرادات', 'amount', v_revenue_net),
        jsonb_build_object('code', '5001', 'name', 'صافي المصروفات', 'name_ar', 'صافي المصروفات', 'amount', -v_expense_net),
        jsonb_build_object('code', '1110', 'name', 'تغير في الذمم المدينة', 'name_ar', 'تغير في الذمم المدينة', 'amount', -v_ar_change),
        jsonb_build_object('code', '2101', 'name', 'تغير في الذمم الدائنة', 'name_ar', 'تغير في الذمم الدائنة', 'amount', v_ap_change)
      ),
      'total', v_revenue_net - v_expense_net - v_ar_change + v_ap_change
    ),
    'investing', jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('code', '1201', 'name', 'أصول ثابتة', 'name_ar', 'أصول ثابتة', 'amount', -v_fixed_asset_purchases)
      ),
      'total', -v_fixed_asset_purchases
    ),
    'financing', jsonb_build_object('items', '[]'::jsonb, 'total', 0),
    'net_change', v_revenue_net - v_expense_net - v_ar_change + v_ap_change - v_fixed_asset_purchases,
    'period_from', p_from_date,
    'period_to', p_to_date
  );
END;
$$;
