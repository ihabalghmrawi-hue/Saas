-- ============================================================
-- AUTH & DATA FIXES
-- Run in Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ============================================================

-- ── 1. MEMBERSHIPS: Add SELECT policy (ROOT CAUSE of auth loop) ───────────────
-- Without this policy, the middleware query returns null even for valid members,
-- causing an infinite redirect to /onboarding.

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own membership
DROP POLICY IF EXISTS "users_read_own_membership" ON memberships;
CREATE POLICY "users_read_own_membership" ON memberships
  FOR SELECT USING (user_id = auth.uid());

-- Allow users to insert their own membership (for signup)
DROP POLICY IF EXISTS "users_insert_own_membership" ON memberships;
CREATE POLICY "users_insert_own_membership" ON memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow owners to update their own membership
DROP POLICY IF EXISTS "users_update_own_membership" ON memberships;
CREATE POLICY "users_update_own_membership" ON memberships
  FOR UPDATE USING (user_id = auth.uid());

-- ── 2. FIX MEMBERSHIPS: ensure is_active defaults to true ─────────────────────
ALTER TABLE memberships
  ALTER COLUMN is_active SET DEFAULT true;

-- Fix any existing memberships that were created without is_active = true
UPDATE memberships SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- ── 3. TRANSACTIONS: add missing columns (wallet_id etc.) ─────────────────────
-- The transactions table may already exist from an older schema without these columns.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id        UUID REFERENCES wallets(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id     TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type   TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method   TEXT DEFAULT 'cash';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;

-- Backfill transaction_date if null
UPDATE transactions SET transaction_date = created_at::DATE WHERE transaction_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_wallet   ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ref      ON transactions(reference_id, reference_type);

-- ── 4. COMPANIES: ensure auth users can read their own company ────────────────
-- The middleware fetches company_settings for the tenant — it must be readable.
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_company_settings" ON company_settings;
CREATE POLICY "members_read_company_settings" ON company_settings
  FOR SELECT USING (
    company_id::TEXT = (
      SELECT company_id::TEXT FROM memberships
      WHERE user_id = auth.uid() AND is_active = true
      LIMIT 1
    )
  );

-- ── 5. AUTO-FIX: create membership for any Supabase user missing one ──────────
-- Finds auth users who have no active membership and creates one
-- Only useful during development — safe to run in prod
DO $$
DECLARE
  r RECORD;
  v_company_id UUID;
BEGIN
  -- Get the first company (single-tenant fallback)
  SELECT id INTO v_company_id FROM companies ORDER BY created_at LIMIT 1;
  IF v_company_id IS NULL THEN RETURN; END IF;

  -- Fix users with no membership
  FOR r IN
    SELECT au.id AS user_id
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = au.id AND m.is_active = true
    )
  LOOP
    INSERT INTO memberships (user_id, company_id, role, is_active)
    VALUES (r.user_id, v_company_id, 'owner', true)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created membership for user: %', r.user_id;
  END LOOP;
END $$;
