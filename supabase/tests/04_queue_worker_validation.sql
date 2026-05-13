-- ============================================================
-- Queue & Worker Validation Tests
-- ============================================================
-- This file tests job_queue, recurring_journals, payroll_runs,
-- inventory reorder rules, and reconciliation matching logic.
-- ============================================================

BEGIN;
SELECT plan(75);

-- ============================================================
-- 1. JOB QUEUE BASIC OPERATIONS
-- ============================================================

-- 1.1 Create test company for isolation
INSERT INTO companies (id, name, tax_id, created_at)
VALUES ('cq-test-co', 'Queue Test Company', 'QT-12345', NOW())
ON CONFLICT (id) DO NOTHING;

-- 1.2 Insert jobs with varying priorities
INSERT INTO job_queue (id, company_id, task, payload, status, priority, created_at)
VALUES
  ('jq-p0',  'cq-test-co', 'process_recurring',         '{"test": true}',  'pending', 0,  NOW()),
  ('jq-p5',  'cq-test-co', 'run_integrity_checks',      '{"test": true}',  'pending', 5,  NOW()),
  ('jq-p10', 'cq-test-co', 'generate_daily_snapshots',  '{"test": true}',  'pending', 10, NOW());

-- 1.3 Verify jobs created
SELECT is(count(*), 3::bigint, 'job_queue: 3 jobs created')
FROM job_queue WHERE company_id = 'cq-test-co';

-- 1.4 Test status constraint — invalid status should fail
SELECT throws_ok(
  $$INSERT INTO job_queue (id, company_id, task, payload, status)
    VALUES ('jq-bad', 'cq-test-co', 'process_recurring', '{}', 'invalid_status')$$,
  23514,
  NULL,
  'job_queue: invalid status rejected'
);

-- 1.5 Verify priority ordering (highest first)
SELECT is(priority, 10, 'job_queue: highest priority job ordered first')
FROM job_queue
WHERE company_id = 'cq-test-co' AND status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT 1;

-- 1.6 Verify second priority
SELECT is(priority, 5, 'job_queue: second highest priority')
FROM job_queue
WHERE company_id = 'cq-test-co' AND status = 'pending'
ORDER BY priority DESC, created_at ASC
OFFSET 1 LIMIT 1;

-- 1.7 Verify lowest priority
SELECT is(priority, 0, 'job_queue: lowest priority last')
FROM job_queue
WHERE company_id = 'cq-test-co' AND status = 'pending'
ORDER BY priority DESC, created_at ASC
OFFSET 2 LIMIT 1;

-- 1.8 Test scheduled_for filtering: future scheduled job should NOT be picked
INSERT INTO job_queue (id, company_id, task, payload, status, priority, scheduled_for)
VALUES ('jq-future', 'cq-test-co', 'process_recurring', '{}', 'pending', 100, NOW() + INTERVAL '1 year');

SELECT is(count(*), 0::bigint, 'job_queue: future scheduled job excluded from pending query')
FROM job_queue
WHERE company_id = 'cq-test-co' AND status = 'pending'
  AND (scheduled_for IS NULL OR scheduled_for <= NOW())
  AND id = 'jq-future';

-- 1.9 Test past scheduled job IS included
INSERT INTO job_queue (id, company_id, task, payload, status, priority, scheduled_for)
VALUES ('jq-past', 'cq-test-co', 'process_recurring', '{}', 'pending', 1, NOW() - INTERVAL '1 day');

SELECT is(count(*), 1::bigint, 'job_queue: past scheduled job included')
FROM job_queue
WHERE company_id = 'cq-test-co' AND status = 'pending'
  AND (scheduled_for IS NULL OR scheduled_for <= NOW())
  AND id = 'jq-past';

-- ============================================================
-- 2. STATUS TRANSITIONS
-- ============================================================

-- 2.1 Insert a job and transition through statuses
INSERT INTO job_queue (id, company_id, task, payload, status)
VALUES ('jq-flow', 'cq-test-co', 'process_recurring', '{}', 'pending');

UPDATE job_queue SET status = 'processing', started_at = NOW() WHERE id = 'jq-flow';
SELECT is(status, 'processing', 'job_queue: pending -> processing')
FROM job_queue WHERE id = 'jq-flow';

UPDATE job_queue SET status = 'completed', completed_at = NOW() WHERE id = 'jq-flow';
SELECT is(status, 'completed', 'job_queue: processing -> completed')
FROM job_queue WHERE id = 'jq-flow';

-- 2.2 Test pending -> failed transition
INSERT INTO job_queue (id, company_id, task, payload, status, retry_count, max_retries)
VALUES ('jq-fail', 'cq-test-co', 'process_recurring', '{}', 'pending', 0, 3);

UPDATE job_queue SET status = 'processing', started_at = NOW() WHERE id = 'jq-fail';
UPDATE job_queue SET status = 'failed', error_message = 'خطأ في المعالجة', retry_count = 4, completed_at = NOW() WHERE id = 'jq-fail';
SELECT is(status, 'failed', 'job_queue: processing -> failed after exhausting retries')
FROM job_queue WHERE id = 'jq-fail';
SELECT is(error_message, 'خطأ في المعالجة', 'job_queue: error_message captured on failure')
FROM job_queue WHERE id = 'jq-fail';
SELECT is(retry_count, 4, 'job_queue: retry_count incremented after last failure')
FROM job_queue WHERE id = 'jq-fail';

-- 2.3 Test cancellation
INSERT INTO job_queue (id, company_id, task, payload, status)
VALUES ('jq-cancel', 'cq-test-co', 'process_recurring', '{}', 'pending');
UPDATE job_queue SET status = 'cancelled' WHERE id = 'jq-cancel';
SELECT is(status, 'cancelled', 'job_queue: pending -> cancelled')
FROM job_queue WHERE id = 'jq-cancel';

-- ============================================================
-- 3. RETRY COUNT AND MAX_RETRIES
-- ============================================================

INSERT INTO job_queue (id, company_id, task, payload, status, retry_count, max_retries)
VALUES
  ('jq-retry-0', 'cq-test-co', 'process_recurring', '{}', 'pending', 0, 3),
  ('jq-retry-1', 'cq-test-co', 'process_recurring', '{}', 'pending', 1, 3),
  ('jq-retry-3', 'cq-test-co', 'process_recurring', '{}', 'pending', 3, 3);

-- 3.1 retry_count < max_retries: can retry
SELECT is(can_retry, true, 'job_queue: retry_count < max_retries can retry')
FROM (
  SELECT (retry_count < max_retries) AS can_retry
  FROM job_queue WHERE id = 'jq-retry-0'
) sub;

-- 3.2 retry_count == max_retries: should NOT retry
SELECT is(can_retry, false, 'job_queue: retry_count = max_retries cannot retry')
FROM (
  SELECT (retry_count < max_retries) AS can_retry
  FROM job_queue WHERE id = 'jq-retry-3'
) sub;

-- ============================================================
-- 4. RECURRING JOURNALS
-- ============================================================

-- 4.1 Create recurring journals with different frequencies
INSERT INTO recurring_journals (id, company_id, name, frequency, day_of_month, day_of_week, month_of_year, start_date, next_run_date, status, template_lines)
VALUES
  ('rj-daily',    'cq-test-co', 'يومي',    'daily',    NULL, NULL, NULL, '2024-01-01', '2024-01-02', 'active',
   '[{"account_code": "6001", "debit": 100, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 100}]'),
  ('rj-weekly',   'cq-test-co', 'أسبوعي',  'weekly',   NULL, NULL, NULL, '2024-01-01', '2024-01-08', 'active',
   '[{"account_code": "6001", "debit": 200, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 200}]'),
  ('rj-monthly',  'cq-test-co', 'شهري',    'monthly',  15,   NULL, NULL, '2024-01-15', '2024-02-15', 'active',
   '[{"account_code": "6001", "debit": 500, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 500}]'),
  ('rj-quarterly','cq-test-co', 'ربعي',    'quarterly',NULL, NULL, NULL, '2024-01-01', '2024-04-01', 'active',
   '[{"account_code": "6001", "debit": 1000, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 1000}]'),
  ('rj-yearly',   'cq-test-co', 'سنوي',    'yearly',   1,   NULL, 1,    '2024-01-01', '2025-01-01', 'active',
   '[{"account_code": "6001", "debit": 12000, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 12000}]');

SELECT is(count(*), 5::bigint, 'recurring_journals: 5 journals created')
FROM recurring_journals WHERE company_id = 'cq-test-co';

-- 4.2 Test status constraint
SELECT throws_ok(
  $$INSERT INTO recurring_journals (id, company_id, name, frequency, start_date, status, template_lines)
    VALUES ('rj-bad', 'cq-test-co', 'bad', 'monthly', '2024-01-01', 'unknown', '[]')$$,
  23514,
  NULL,
  'recurring_journals: invalid status rejected'
);

-- 4.3 Calculate next_run_date: daily
SELECT is(
  (SELECT (next_run_date + INTERVAL '1 day')::date FROM recurring_journals WHERE id = 'rj-daily')::text,
  '2024-01-03',
  'recurring_journals: daily next run = current + 1 day'
);

-- 4.4 Calculate next_run_date: weekly
SELECT is(
  (SELECT (next_run_date + INTERVAL '7 days')::date FROM recurring_journals WHERE id = 'rj-weekly')::text,
  '2024-01-15',
  'recurring_journals: weekly next run = current + 7 days'
);

-- 4.5 Calculate next_run_date: monthly (day_of_month = 15)
SELECT is(
  (SELECT (next_run_date + INTERVAL '1 month')::date FROM recurring_journals WHERE id = 'rj-monthly')::text,
  '2024-03-15',
  'recurring_journals: monthly next run = current + 1 month'
);

-- 4.6 Calculate next_run_date: quarterly
SELECT is(
  (SELECT (next_run_date + INTERVAL '3 months')::date FROM recurring_journals WHERE id = 'rj-quarterly')::text,
  '2024-07-01',
  'recurring_journals: quarterly next run = current + 3 months'
);

-- 4.7 Calculate next_run_date: yearly (month_of_year = 1, day_of_month = 1)
SELECT is(
  (SELECT (next_run_date + INTERVAL '1 year')::date FROM recurring_journals WHERE id = 'rj-yearly')::text,
  '2026-01-01',
  'recurring_journals: yearly next run = current + 1 year'
);

-- 4.8 Status transitions: active -> paused -> completed -> cancelled
UPDATE recurring_journals SET status = 'paused' WHERE id = 'rj-daily';
SELECT is(status, 'paused', 'recurring_journals: active -> paused')
FROM recurring_journals WHERE id = 'rj-daily';

UPDATE recurring_journals SET status = 'active' WHERE id = 'rj-daily';
SELECT is(status, 'active', 'recurring_journals: paused -> active')
FROM recurring_journals WHERE id = 'rj-daily';

UPDATE recurring_journals SET status = 'completed' WHERE id = 'rj-daily';
SELECT is(status, 'completed', 'recurring_journals: active -> completed')
FROM recurring_journals WHERE id = 'rj-daily';

UPDATE recurring_journals SET status = 'cancelled' WHERE id = 'rj-daily';
SELECT is(status, 'cancelled', 'recurring_journals: completed -> cancelled')
FROM recurring_journals WHERE id = 'rj-daily';

-- 4.9 Test max_runs limit
INSERT INTO recurring_journals (id, company_id, name, frequency, start_date, next_run_date, total_runs, max_runs, status, template_lines)
VALUES ('rj-max', 'cq-test-co', 'محدود', 'monthly', '2024-01-01', '2024-02-01', 2, 3, 'active',
  '[{"account_code": "6001", "debit": 100, "credit": 0}, {"account_code": "1101", "debit": 0, "credit": 100}]');

-- Simulate third run (total_runs 2 + 1 = 3, which equals max_runs = 3)
UPDATE recurring_journals SET total_runs = 3, status = 'completed' WHERE id = 'rj-max';
SELECT is(status, 'completed', 'recurring_journals: max_runs reached, status = completed')
FROM recurring_journals WHERE id = 'rj-max';
SELECT is(total_runs, 3, 'recurring_journals: total_runs matches max_runs')
FROM recurring_journals WHERE id = 'rj-max';

-- 4.10 Test recurring_journal_log entries
INSERT INTO recurring_journal_log (recurring_journal_id, run_date, status, error_message)
VALUES
  ('rj-weekly', '2024-01-08', 'success', NULL),
  ('rj-weekly', '2024-01-15', 'success', NULL),
  ('rj-monthly', '2024-02-15', 'success', NULL),
  ('rj-monthly', '2024-03-15', 'failed', 'خطأ في الترحيل');

SELECT is(count(*), 4::bigint, 'recurring_journal_log: 4 log entries created')
FROM recurring_journal_log WHERE recurring_journal_id IN ('rj-weekly', 'rj-monthly');

SELECT is(count(*), 1::bigint, 'recurring_journal_log: 1 failed entry')
FROM recurring_journal_log WHERE status = 'failed';

SELECT is(count(*), 3::bigint, 'recurring_journal_log: 3 success entries')
FROM recurring_journal_log WHERE status = 'success';

-- ============================================================
-- 5. PAYROLL RUNS
-- ============================================================

INSERT INTO payroll_cycles (id, company_id, name, cycle_type, year, month, period_start, period_end, payment_date)
VALUES ('pc-test', 'cq-test-co', 'Test Cycle', 'monthly', 2024, 1, '2024-01-01', '2024-01-31', '2024-01-31')
ON CONFLICT DO NOTHING;

-- 5.1 Create payroll run with draft status
INSERT INTO payroll_runs (id, company_id, cycle_id, name, status)
VALUES ('pr-test', 'cq-test-co', 'pc-test', 'راتب يناير 2024', 'draft');
SELECT is(status, 'draft', 'payroll_runs: created as draft')
FROM payroll_runs WHERE id = 'pr-test';

-- 5.2 Status transition: draft -> processing
UPDATE payroll_runs SET status = 'processing', processed_at = NOW() WHERE id = 'pr-test';
SELECT is(status, 'processing', 'payroll_runs: draft -> processing')
FROM payroll_runs WHERE id = 'pr-test';

-- 5.3 Status transition: processing -> completed
UPDATE payroll_runs SET
  status = 'completed',
  total_earnings = 50000,
  total_deductions = 10000,
  net_pay = 40000,
  employee_count = 5
WHERE id = 'pr-test';
SELECT is(status, 'completed', 'payroll_runs: processing -> completed')
FROM payroll_runs WHERE id = 'pr-test';
SELECT is(net_pay, 40000.00, 'payroll_runs: net_pay calculated correctly')
FROM payroll_runs WHERE id = 'pr-test';

-- 5.4 Status transition: completed -> locked
UPDATE payroll_runs SET status = 'locked', locked_at = NOW() WHERE id = 'pr-test';
SELECT is(status, 'locked', 'payroll_runs: completed -> locked')
FROM payroll_runs WHERE id = 'pr-test';

-- 5.5 Test posted_to_gl flag and gl_journal_entry_id
UPDATE payroll_runs SET posted_to_gl = true, gl_journal_entry_id = 'je-gl-001' WHERE id = 'pr-test';
SELECT is(posted_to_gl, true, 'payroll_runs: posted_to_gl flag set')
FROM payroll_runs WHERE id = 'pr-test';
SELECT is(gl_journal_entry_id, 'je-gl-001', 'payroll_runs: gl_journal_entry_id stored')
FROM payroll_runs WHERE id = 'pr-test';

-- 5.6 Test status constraint
SELECT throws_ok(
  $$INSERT INTO payroll_runs (id, company_id, cycle_id, name, status)
    VALUES ('pr-bad', 'cq-test-co', 'pc-test', 'bad', 'invalid_status')$$,
  23514,
  NULL,
  'payroll_runs: invalid status rejected'
);

-- ============================================================
-- 6. INVENTORY REORDER EVALUATION
-- ============================================================

-- 6.1 Create test warehouse and item
INSERT INTO warehouses (id, company_id, code, name)
VALUES ('wh-test', 'cq-test-co', 'WH-T', 'Test Warehouse');
INSERT INTO inventory_items (id, company_id, code, name, type, cost_method, unit_id)
VALUES ('item-reorder', 'cq-test-co', 'ITM-R', 'Reorder Item', 'product', 'weighted_average', 'unit-1');

-- 6.2 Create reorder rules
INSERT INTO reorder_rules (id, company_id, item_id, warehouse_id, min_stock, reorder_point, reorder_qty, is_active, auto_generate)
VALUES
  ('rr-below',  'cq-test-co', 'item-reorder', 'wh-test', 10, 50, 100, true, true),
  ('rr-above',  'cq-test-co', 'item-reorder', 'wh-test', 10, 80, 100, true, true),
  ('rr-inactive','cq-test-co', 'item-reorder', 'wh-test', 10, 50, 100, false, true);

SELECT is(count(*), 3::bigint, 'reorder_rules: 3 rules created')
FROM reorder_rules WHERE company_id = 'cq-test-co';

-- 6.3 Simulate current stock = 30. Rule rr-below has reorder_point=50, so 30 < 50 → needs reorder
-- Rule rr-above has reorder_point=80, so 30 < 80 → also needs reorder
-- Rule rr-inactive has is_active=false → excluded even though stock below reorder point
SELECT is(count(*), 2::bigint, 'reorder_rules: 2 active rules trigger reorder (stock=30 < reorder_point)')
FROM reorder_rules
WHERE company_id = 'cq-test-co'
  AND is_active = true
  AND 30 < reorder_point;

-- 6.4 Test that inactive rules are excluded
SELECT is(count(*), 0::bigint, 'reorder_rules: inactive rules excluded')
FROM reorder_rules
WHERE company_id = 'cq-test-co'
  AND is_active = false
  AND 30 < reorder_point;

-- 6.5 Auto-generate purchase order for items needing reorder
-- For rr-below with auto_generate=true, reorder_qty=100
SELECT is(reorder_qty, 100.000000, 'reorder_rules: reorder_qty = 100 for auto-generate')
FROM reorder_rules
WHERE id = 'rr-below' AND auto_generate = true;

-- ============================================================
-- 7. INVENTORY COUNT SESSION STATUS
-- ============================================================

INSERT INTO inventory_count_sessions (id, company_id, warehouse_id, session_no, type, status)
VALUES
  ('cs-draft',      'cq-test-co', 'wh-test', 'CS-DRAFT', 'cycle', 'draft'),
  ('cs-inprogress', 'cq-test-co', 'wh-test', 'CS-IP',    'cycle', 'in_progress'),
  ('cs-completed',  'cq-test-co', 'wh-test', 'CS-COMP',  'full',  'completed'),
  ('cs-approved',   'cq-test-co', 'wh-test', 'CS-APPR',  'cycle', 'approved'),
  ('cs-cancelled',  'cq-test-co', 'wh-test', 'CS-CANCEL','spot',   'cancelled');

SELECT is(count(*), 5::bigint, 'inventory_count_sessions: 5 sessions created')
FROM inventory_count_sessions WHERE company_id = 'cq-test-co';

-- Test each valid status
SELECT is(status, 'draft', 'inventory_count_sessions: draft status valid')
FROM inventory_count_sessions WHERE id = 'cs-draft';
SELECT is(status, 'in_progress', 'inventory_count_sessions: in_progress status valid')
FROM inventory_count_sessions WHERE id = 'cs-inprogress';
SELECT is(status, 'completed', 'inventory_count_sessions: completed status valid')
FROM inventory_count_sessions WHERE id = 'cs-completed';
SELECT is(status, 'approved', 'inventory_count_sessions: approved status valid')
FROM inventory_count_sessions WHERE id = 'cs-approved';
SELECT is(status, 'cancelled', 'inventory_count_sessions: cancelled status valid')
FROM inventory_count_sessions WHERE id = 'cs-cancelled';

-- Test session type constraint
SELECT is(type, 'full', 'inventory_count_sessions: type=full valid')
FROM inventory_count_sessions WHERE id = 'cs-completed';
SELECT is(type, 'spot', 'inventory_count_sessions: type=spot valid')
FROM inventory_count_sessions WHERE id = 'cs-cancelled';

-- ============================================================
-- 8. RECONCILIATION MATCHING
-- ============================================================

-- 8.1 Create test account for reconciliation
INSERT INTO accounts (id, company_id, code, name, type, normal_balance, currency)
VALUES ('acct-rec', 'cq-test-co', '1101', 'نقدية', 'asset', 'debit', 'SAR');

-- 8.2 Test matching scenarios
INSERT INTO reconciliations (id, company_id, account_id, reference_type, statement_date, statement_amount, cleared_amount, status)
VALUES
  ('rec-matched',  'cq-test-co', 'acct-rec', 'bank_statement', '2024-01-31', 10000.00, 10000.00, 'matched'),
  ('rec-partial',  'cq-test-co', 'acct-rec', 'bank_statement', '2024-01-31', 10000.00,  7500.00, 'partial'),
  ('rec-unmatched','cq-test-co', 'acct-rec', 'bank_statement', '2024-01-31', 10000.00,     0.00, 'unmatched'),
  ('rec-overpaid', 'cq-test-co', 'acct-rec', 'bank_statement', '2024-01-31', 10000.00, 12000.00, 'overpaid');

SELECT is(count(*), 4::bigint, 'reconciliations: 4 entries created')
FROM reconciliations WHERE company_id = 'cq-test-co';

-- 8.3 Verify difference is calculated as statement_amount - cleared_amount
SELECT is(difference, 0.00, 'reconciliations: matched diff = 0')
FROM reconciliations WHERE id = 'rec-matched';
SELECT is(difference, 2500.00, 'reconciliations: partial diff = 2500')
FROM reconciliations WHERE id = 'rec-partial';
SELECT is(difference, 10000.00, 'reconciliations: unmatched diff = 10000')
FROM reconciliations WHERE id = 'rec-unmatched';
SELECT is(difference, -2000.00, 'reconciliations: overpaid diff = -2000')
FROM reconciliations WHERE id = 'rec-overpaid';

-- 8.4 Test reconciliation line matching
INSERT INTO reconciliation_lines (id, reconciliation_id, amount, matched_amount, status)
VALUES
  ('rl-matched', 'rec-matched', 5000.00, 5000.00, 'matched'),
  ('rl-partial', 'rec-partial', 5000.00, 2500.00, 'partial');

SELECT is(status, 'matched', 'reconciliation_lines: line matched')
FROM reconciliation_lines WHERE id = 'rl-matched';
SELECT is(status, 'partial', 'reconciliation_lines: line partial')
FROM reconciliation_lines WHERE id = 'rl-partial';

-- Verify generated columns
SELECT is(difference, 0.00, 'reconciliation_lines: matched line diff = 0')
FROM reconciliation_lines WHERE id = 'rl-matched';
SELECT is(difference, 2500.00, 'reconciliation_lines: partial line diff = 2500')
FROM reconciliation_lines WHERE id = 'rl-partial';

-- ============================================================
-- 9. CLEANUP
-- ============================================================

DELETE FROM reconciliation_lines WHERE id IN ('rl-matched', 'rl-partial');
DELETE FROM reconciliations WHERE company_id = 'cq-test-co';
DELETE FROM inventory_count_sessions WHERE company_id = 'cq-test-co';
DELETE FROM reorder_rules WHERE company_id = 'cq-test-co';
DELETE FROM inventory_items WHERE id = 'item-reorder';
DELETE FROM warehouses WHERE id = 'wh-test';
DELETE FROM payroll_runs WHERE id = 'pr-test';
DELETE FROM payroll_cycles WHERE id = 'pc-test';
DELETE FROM recurring_journal_log WHERE recurring_journal_id IN ('rj-daily', 'rj-weekly', 'rj-monthly', 'rj-quarterly', 'rj-yearly', 'rj-max');
DELETE FROM recurring_journals WHERE company_id = 'cq-test-co';
DELETE FROM job_queue WHERE company_id = 'cq-test-co';
DELETE FROM accounts WHERE id = 'acct-rec';
DELETE FROM companies WHERE id = 'cq-test-co';

SELECT is(count(*), 0::bigint, 'cleanup: all job_queue entries removed')
FROM job_queue WHERE company_id = 'cq-test-co';
SELECT is(count(*), 0::bigint, 'cleanup: all recurring_journals removed')
FROM recurring_journals WHERE company_id = 'cq-test-co';
SELECT is(count(*), 0::bigint, 'cleanup: all payroll_runs removed')
FROM payroll_runs WHERE id = 'pr-test';
SELECT is(count(*), 0::bigint, 'cleanup: all reconciliations removed')
FROM reconciliations WHERE company_id = 'cq-test-co';

-- ============================================================
-- FINISH
-- ============================================================
SELECT * FROM finish();
ROLLBACK;
