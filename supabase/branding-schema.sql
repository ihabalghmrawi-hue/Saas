-- ════════════════════════════════════════════════
-- White-Label Branding Schema
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS branding (
  company_id TEXT PRIMARY KEY,
  name       TEXT,
  name_ar    TEXT,
  phone      TEXT,
  address    TEXT,
  tax_number TEXT,
  logo_url   TEXT,
  favicon_url TEXT,
  primary_color   TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  receipt_footer  TEXT,
  receipt_header  TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_branding" ON branding;
CREATE POLICY "allow_all_branding" ON branding FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for logos (run this separately in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
