-- Daily MRR snapshot
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mrr_daily AS
WITH daily AS (
  SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*) FILTER (WHERE plan IN ('basic', 'pro') AND status = 'active') AS active_paid_subscriptions,
    COUNT(*) FILTER (WHERE plan = 'basic' AND status = 'active') AS basic_active,
    COUNT(*) FILTER (WHERE plan = 'pro' AND status = 'active') AS pro_active,
    COUNT(*) FILTER (WHERE status = 'active') AS total_active,
    COUNT(*) FILTER (WHERE status = 'trialing') AS trialing,
    COUNT(*) FILTER (WHERE status = 'expired') AS expired,
    COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
  FROM subscriptions
  GROUP BY date_trunc('day', created_at)
)
SELECT * FROM daily
ORDER BY day DESC;

-- Active tenant count
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_stats AS
SELECT
  COUNT(*) AS total_companies,
  COUNT(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id::text = companies.id::text AND s.status = 'active')
  ) AS with_active_subscription,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_last_30d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_last_7d
FROM companies;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mrr_daily ON mv_mrr_daily(day);
