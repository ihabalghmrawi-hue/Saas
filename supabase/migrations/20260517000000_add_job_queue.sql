-- Job queue for async accounting operations
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_job_queue_company ON job_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled ON job_queue(scheduled_for) WHERE scheduled_for IS NOT NULL;
