-- ============================================================
-- SAMPLE SEED DATA
-- Run AFTER schema.sql and AFTER creating your first user account
-- Replace 'your-user-id' with actual UUID from auth.users
-- ============================================================

-- Step 1: Create a sample company
INSERT INTO companies (id, name, name_ar, slug, currency, language) VALUES
  ('11111111-1111-1111-1111-111111111111', 'My Store', 'متجري', 'my-store', 'USD', 'ar');

-- Step 2: Add membership (replace with your actual user ID)
-- INSERT INTO memberships (user_id, company_id, role) VALUES
--   ('YOUR-USER-ID-HERE', '11111111-1111-1111-1111-111111111111', 'owner');

-- Step 3: Sample transactions (after linking user)
-- These will auto-trigger default categories and accounts creation

-- Sample Income Transactions
INSERT INTO transactions (company_id, type, amount, description, description_ar, transaction_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'income', 5000.00, 'January Sales', 'مبيعات يناير', '2024-01-15', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 3500.00, 'Service Revenue', 'إيرادات خدمات', '2024-01-20', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 7200.00, 'February Sales', 'مبيعات فبراير', '2024-02-10', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 4100.00, 'March Sales', 'مبيعات مارس', '2024-03-05', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 6800.00, 'April Sales', 'مبيعات أبريل', '2024-04-12', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 9200.00, 'May Sales', 'مبيعات مايو', '2024-05-18', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'income', 8100.00, 'June Sales', 'مبيعات يونيو', '2024-06-22', 'completed');

-- Sample Expense Transactions
INSERT INTO transactions (company_id, type, amount, description, description_ar, transaction_date, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'expense', 1200.00, 'Office Rent', 'إيجار المكتب', '2024-01-01', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 800.00, 'Salaries', 'رواتب', '2024-01-31', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 350.00, 'Marketing', 'تسويق', '2024-02-05', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 1200.00, 'Office Rent', 'إيجار المكتب', '2024-02-01', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 900.00, 'Salaries', 'رواتب', '2024-02-28', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 250.00, 'Utilities', 'كهرباء ومياه', '2024-03-10', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 1200.00, 'Office Rent', 'إيجار المكتب', '2024-03-01', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 1500.00, 'Purchases', 'مشتريات', '2024-04-05', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 600.00, 'Administrative', 'مصروفات إدارية', '2024-05-15', 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'expense', 400.00, 'Transportation', 'مواصلات', '2024-06-10', 'completed');
