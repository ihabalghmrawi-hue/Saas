CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
/*
  # Finance SaaS - Complete Database Schema

  ## Summary
  Full multi-tenant financial management system schema.

  ## New Tables
  1. `companies` - Multi-tenant company accounts with settings
  2. `memberships` - User-to-company relationships with roles (owner, admin, accountant, viewer)
  3. `categories` - Income/expense transaction categories per company
  4. `accounts` - Chart of accounts (asset, liability, equity, revenue, expense)
  5. `parties` - Customers, suppliers, employees per company
  6. `transactions` - All financial transactions (income, expense, transfer)
  7. `journal_entries` - Double-entry accounting journal entries
  8. `journal_entry_lines` - Individual debit/credit lines per journal entry
  9. `wallets` - Cash and bank accounts per company
  10. `wallet_transactions` - Movement history per wallet
  11. `reports_cache` - Optional performance cache for reports

  ## Security
  - RLS enabled on all tables
  - Helper function `get_user_company_ids()` for policy reuse
  - Policies restrict access to company members only

  ## Automation
  - `update_updated_at_column()` trigger on all mutable tables
  - `create_default_data()` seeds categories, accounts, and wallets on new company
  - `on_company_created()` trigger fires automatically on INSERT into companies
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  currency VARCHAR(10) DEFAULT 'USD',
  language VARCHAR(10) DEFAULT 'ar',
  timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',
  fiscal_year_start INTEGER DEFAULT 1,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  tax_number VARCHAR(100),
  settings JSONB DEFAULT '{"theme":"light","notifications_enabled":true,"backup_enabled":true,"date_format":"DD/MM/YYYY","number_format":"1,234.56"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'owner',
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon VARCHAR(50),
  color VARCHAR(20) DEFAULT '#3B82F6',
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  type VARCHAR(30) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype VARCHAR(50),
  parent_id UUID REFERENCES accounts(id),
  normal_balance VARCHAR(10) DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  type VARCHAR(20) DEFAULT 'customer' CHECK (type IN ('customer', 'supplier', 'employee', 'other')),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(100),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'USD',
  exchange_rate DECIMAL(10,6) DEFAULT 1,
  category_id UUID REFERENCES categories(id),
  account_id UUID REFERENCES accounts(id),
  party_id UUID REFERENCES parties(id),
  reference_number VARCHAR(100),
  description TEXT,
  description_ar TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) DEFAULT 'cash',
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'draft')),
  attachments JSONB DEFAULT '[]',
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_number VARCHAR(50) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  description_ar TEXT,
  reference VARCHAR(100),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
  total_debit DECIMAL(15,2) DEFAULT 0,
  total_credit DECIMAL(15,2) DEFAULT 0,
  is_balanced BOOLEAN GENERATED ALWAYS AS (total_debit = total_credit) STORED,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  )
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  type VARCHAR(20) DEFAULT 'cash' CHECK (type IN ('cash', 'bank', 'digital')),
  currency VARCHAR(10) DEFAULT 'USD',
  initial_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  account_number VARCHAR(100),
  bank_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  icon VARCHAR(50) DEFAULT 'wallet',
  color VARCHAR(20) DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out', 'transfer')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  transfer_to_wallet_id UUID REFERENCES wallets(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(company_id, report_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company_id ON memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_parties_company_id ON parties(company_id);
CREATE INDEX IF NOT EXISTS idx_wallets_company_id ON wallets(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON categories(company_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_company_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT company_id FROM memberships
    WHERE user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view their companies"
  ON companies FOR SELECT TO authenticated
  USING (id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update their companies"
  ON companies FOR UPDATE TO authenticated
  USING (id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true))
  WITH CHECK (id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true));

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their memberships"
  ON memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert memberships for themselves"
  ON memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view company transactions"
  ON transactions FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert company transactions"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update company transactions"
  ON transactions FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete company transactions"
  ON transactions FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select categories"
  ON categories FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select accounts"
  ON accounts FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert accounts"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update accounts"
  ON accounts FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete accounts"
  ON accounts FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select parties"
  ON parties FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert parties"
  ON parties FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update parties"
  ON parties FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete parties"
  ON parties FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select journal entries"
  ON journal_entries FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert journal entries"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update journal entries"
  ON journal_entries FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete journal entries"
  ON journal_entries FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select journal entry lines"
  ON journal_entry_lines FOR SELECT TO authenticated
  USING (journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(get_user_company_ids())));

CREATE POLICY "Users can insert journal entry lines"
  ON journal_entry_lines FOR INSERT TO authenticated
  WITH CHECK (journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(get_user_company_ids())));

CREATE POLICY "Users can update journal entry lines"
  ON journal_entry_lines FOR UPDATE TO authenticated
  USING (journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(get_user_company_ids())))
  WITH CHECK (journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(get_user_company_ids())));

CREATE POLICY "Users can delete journal entry lines"
  ON journal_entry_lines FOR DELETE TO authenticated
  USING (journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = ANY(get_user_company_ids())));

CREATE POLICY "Users can select wallets"
  ON wallets FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert wallets"
  ON wallets FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update wallets"
  ON wallets FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can delete wallets"
  ON wallets FOR DELETE TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select wallet transactions"
  ON wallet_transactions FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert wallet transactions"
  ON wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can select reports cache"
  ON reports_cache FOR SELECT TO authenticated
  USING (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can insert reports cache"
  ON reports_cache FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE POLICY "Users can update reports cache"
  ON reports_cache FOR UPDATE TO authenticated
  USING (company_id = ANY(get_user_company_ids()))
  WITH CHECK (company_id = ANY(get_user_company_ids()));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE FUNCTION create_default_data(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (company_id, name, name_ar, type, icon, color) VALUES
    (p_company_id, 'Sales', 'المبيعات', 'income', 'shopping-cart', '#10B981'),
    (p_company_id, 'Services', 'الخدمات', 'income', 'briefcase', '#3B82F6'),
    (p_company_id, 'Investment Returns', 'عوائد الاستثمار', 'income', 'trending-up', '#8B5CF6'),
    (p_company_id, 'Other Income', 'إيرادات أخرى', 'income', 'plus-circle', '#6B7280'),
    (p_company_id, 'Purchases', 'المشتريات', 'expense', 'package', '#EF4444'),
    (p_company_id, 'Salaries', 'الرواتب', 'expense', 'users', '#F59E0B'),
    (p_company_id, 'Rent', 'الإيجار', 'expense', 'home', '#EC4899'),
    (p_company_id, 'Utilities', 'الكهرباء والمياه', 'expense', 'zap', '#14B8A6'),
    (p_company_id, 'Marketing', 'التسويق', 'expense', 'megaphone', '#F97316'),
    (p_company_id, 'Transportation', 'المواصلات', 'expense', 'car', '#6366F1'),
    (p_company_id, 'Administrative', 'مصروفات إدارية', 'expense', 'file-text', '#78716C'),
    (p_company_id, 'Other Expenses', 'مصروفات أخرى', 'expense', 'more-horizontal', '#9CA3AF');

  INSERT INTO accounts (company_id, code, name, name_ar, type, normal_balance, is_system) VALUES
    (p_company_id, '1000', 'Assets', 'الأصول', 'asset', 'debit', true),
    (p_company_id, '1100', 'Current Assets', 'الأصول المتداولة', 'asset', 'debit', true),
    (p_company_id, '1110', 'Cash', 'النقدية', 'asset', 'debit', true),
    (p_company_id, '1120', 'Bank', 'البنك', 'asset', 'debit', true),
    (p_company_id, '1130', 'Accounts Receivable', 'العملاء', 'asset', 'debit', true),
    (p_company_id, '1200', 'Fixed Assets', 'الأصول الثابتة', 'asset', 'debit', true),
    (p_company_id, '2000', 'Liabilities', 'الالتزامات', 'liability', 'credit', true),
    (p_company_id, '2100', 'Current Liabilities', 'الالتزامات المتداولة', 'liability', 'credit', true),
    (p_company_id, '2110', 'Accounts Payable', 'الموردون', 'liability', 'credit', true),
    (p_company_id, '2120', 'Taxes Payable', 'الضرائب المستحقة', 'liability', 'credit', true),
    (p_company_id, '3000', 'Equity', 'حقوق الملكية', 'equity', 'credit', true),
    (p_company_id, '3100', 'Owner Capital', 'رأس المال', 'equity', 'credit', true),
    (p_company_id, '3200', 'Retained Earnings', 'الأرباح المحتجزة', 'equity', 'credit', true),
    (p_company_id, '4000', 'Revenue', 'الإيرادات', 'revenue', 'credit', true),
    (p_company_id, '4100', 'Sales Revenue', 'إيرادات المبيعات', 'revenue', 'credit', true),
    (p_company_id, '4200', 'Service Revenue', 'إيرادات الخدمات', 'revenue', 'credit', true),
    (p_company_id, '5000', 'Expenses', 'المصروفات', 'expense', 'debit', true),
    (p_company_id, '5100', 'Cost of Goods Sold', 'تكلفة المبيعات', 'expense', 'debit', true),
    (p_company_id, '5200', 'Operating Expenses', 'المصروفات التشغيلية', 'expense', 'debit', true),
    (p_company_id, '5210', 'Salaries Expense', 'مصروف الرواتب', 'expense', 'debit', true),
    (p_company_id, '5220', 'Rent Expense', 'مصروف الإيجار', 'expense', 'debit', true),
    (p_company_id, '5230', 'Utilities Expense', 'مصروف الكهرباء', 'expense', 'debit', true);

  INSERT INTO wallets (company_id, name, name_ar, type, is_default) VALUES
    (p_company_id, 'Main Cash', 'الصندوق الرئيسي', 'cash', true),
    (p_company_id, 'Bank Account', 'الحساب البنكي', 'bank', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION on_company_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_data(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_created_trigger
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION on_company_created();

CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
  company_id,
  DATE_TRUNC('month', transaction_date) AS month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_profit
FROM transactions
WHERE status = 'completed'
GROUP BY company_id, DATE_TRUNC('month', transaction_date);
