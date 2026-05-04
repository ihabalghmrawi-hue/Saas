-- ════════════════════════════════════════════════
-- AI Insights Engine Schema
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  category TEXT NOT NULL,       -- sales | inventory | customers | profit | general
  severity TEXT NOT NULL DEFAULT 'info', -- info | success | warning | danger
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric JSONB,                 -- raw numbers behind the insight
  is_read BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_insights_company ON ai_insights(company_id);
CREATE INDEX IF NOT EXISTS idx_insights_generated ON ai_insights(company_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_unread ON ai_insights(company_id, is_read) WHERE is_read = false;

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_insights" ON ai_insights;
CREATE POLICY "allow_all_insights" ON ai_insights FOR ALL USING (true) WITH CHECK (true);
