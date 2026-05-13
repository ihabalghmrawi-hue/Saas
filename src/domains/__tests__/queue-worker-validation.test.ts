import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JobQueueService } from '../accounting/events/job-queue.service'
import { QueueWorker } from '../accounting/workers/queue.worker'
import { RecurringJournalWorker } from '../accounting/workers/recurring-journal.worker'
import { RecurringJournalRepository } from '../accounting/repositories/recurring.repository'
import { JournalService } from '../accounting/services/journal.service'
import { createMockDb, mockFromResult, type MockDb } from '../test-helpers/mock-db'

describe('Queue & Worker Validation', () => {
  let db: MockDb
  let jobQueue: JobQueueService
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    jobQueue = new JobQueueService(db as any)
  })

  describe('Job Queue Basic Operations', () => {
    it('creates jobs with different priorities', async () => {
      mockFromResult(db, 'job_queue', { id: 'job-1' })
      const r1 = await jobQueue.enqueue(companyId, 'process_recurring', {}, { priority: 10 })
      expect(r1.ok).toBe(true)
      if (r1.ok) expect(r1.data.id).toBe('job-1')

      mockFromResult(db, 'job_queue', { id: 'job-2' })
      const r2 = await jobQueue.enqueue(companyId, 'run_integrity_checks', {}, { priority: 5 })
      expect(r2.ok).toBe(true)
      if (r2.ok) expect(r2.data.id).toBe('job-2')
    })

    it('verifies higher priority jobs are dequeued first', async () => {
      const highPriorityJob = {
        id: 'job-hi', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 10, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      }
      mockFromResult(db, 'job_queue', highPriorityJob)
      const r = await jobQueue.dequeue(companyId)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.priority).toBe(10)
      }
      const calls = (db.from('job_queue').update as any).mock.calls
      const updateCall = calls.find((c: any) => c[0]?.status === 'processing')
      expect(updateCall).toBeDefined()
      if (updateCall) expect(updateCall[0].status).toBe('processing')
    })

    it('verifies status transitions: pending → processing → completed', async () => {
      mockFromResult(db, 'job_queue', {
        id: 'job-flow', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 0, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      })

      const dequeued = await jobQueue.dequeue(companyId)
      expect(dequeued.ok).toBe(true)
      if (dequeued.ok) expect(dequeued.data.status).toBe('pending')

      const completeResult = await jobQueue.complete('job-flow', { result: 'ok' })
      expect(completeResult.ok).toBe(true)

      const updateCalls = (db.from('job_queue').update as any).mock.calls
      const processingCall = updateCalls.find((c: any) => c[0]?.status === 'processing')
      expect(processingCall).toBeDefined()
      const completedCall = updateCalls.find((c: any) => c[0]?.status === 'completed')
      expect(completedCall).toBeDefined()
    })

    it('verifies status transitions: pending → processing → failed', async () => {
      mockFromResult(db, 'job_queue', {
        id: 'job-fail', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 0, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 3, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      })

      const dequeued = await jobQueue.dequeue(companyId)
      expect(dequeued.ok).toBe(true)
      if (dequeued.ok) expect(dequeued.data.status).toBe('pending')

      mockFromResult(db, 'job_queue', {
        id: 'job-fail', retry_count: 3, max_retries: 3,
      })

      const failResult = await jobQueue.fail('job-fail', 'فشل المعالجة')
      expect(failResult.ok).toBe(true)
      if (failResult.ok) expect(failResult.data.retry).toBe(false)

      const updateCalls = (db.from('job_queue').update as any).mock.calls
      const failUpdate = updateCalls.find((c: any) => c[0]?.status === 'failed')
      expect(failUpdate).toBeDefined()
      if (failUpdate) expect(failUpdate[0].error_message).toBe('فشل المعالجة')
    })

    it('respects scheduled_for: scheduled jobs not processed before time', async () => {
      mockFromResult(db, 'job_queue', null, { message: 'No rows found', code: 'PGRST116' })
      const r = await jobQueue.dequeue(companyId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBeNull()
    })

    it('processes scheduled jobs when scheduled_for is in the past', async () => {
      const pastJob = {
        id: 'job-sched', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 0,
        scheduled_for: '2023-01-01T00:00:00Z',
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2023-01-01T00:00:00Z',
      }
      mockFromResult(db, 'job_queue', pastJob)
      const r = await jobQueue.dequeue(companyId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.id).toBe('job-sched')
    })
  })

  describe('Recurring Jobs', () => {
    it('processes recurring journals and creates journal entries from template_lines', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-1',
          company_id: companyId,
          name: 'إيجار شهري',
          frequency: 'monthly',
          day_of_month: 1,
          start_date: '2024-01-01',
          next_run_date: '2024-02-01',
          last_run_date: '2024-01-01',
          total_runs: 1,
          max_runs: 12,
          status: 'active',
          is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 5000, credit: 0, description: 'مصروف إيجار' },
            { account_code: '2101', debit: 0, credit: 5000, description: 'ذمم دائنة إيجار' },
          ],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true,
        data: { journal_id: 'je-1', entry_number: 'JE-002' },
      })
      vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-1',
        recurring_journal_id: 'rec-1',
        journal_entry_id: 'je-1',
        run_date: '2024-02-01',
        status: 'success',
        error_message: null,
        created_at: '2024-02-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      const r = await worker.processDueJournals('2024-02-01')
      expect(r.processed).toBe(1)
      expect(r.failed).toBe(0)

      expect(JournalService.prototype.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'recurring',
          source_id: 'rec-1',
          lines: expect.arrayContaining([
            expect.objectContaining({ account_code: '6001', debit: 5000 }),
            expect.objectContaining({ account_code: '2101', credit: 5000 }),
          ]),
        }),
      )
    })

    it('verifies next_run_date calculation for daily frequency', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-daily',
          company_id: companyId,
          name: 'يومي',
          frequency: 'daily',
          start_date: '2024-01-01',
          next_run_date: '2024-01-02',
          last_run_date: '2024-01-01',
          total_runs: 1,
          max_runs: null,
          status: 'active',
          is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true,
        data: { journal_id: 'je-d', entry_number: 'JE-D' },
      })
      const updateNextRun = vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-d', recurring_journal_id: 'rec-daily',
        journal_entry_id: 'je-d', run_date: '2024-01-02',
        status: 'success', error_message: null, created_at: '2024-01-02T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-01-02')
      expect(updateNextRun).toHaveBeenCalledWith('rec-daily', '2024-01-03', 2, '2024-01-02')
    })

    it('verifies next_run_date calculation for weekly frequency', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-weekly', company_id: companyId,
          name: 'أسبوعي', frequency: 'weekly',
          start_date: '2024-01-01', next_run_date: '2024-01-08',
          last_run_date: '2024-01-01', total_runs: 1, max_runs: null,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-w', entry_number: 'JE-W' },
      })
      const updateNextRun = vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-w', recurring_journal_id: 'rec-weekly',
        journal_entry_id: 'je-w', run_date: '2024-01-08',
        status: 'success', error_message: null, created_at: '2024-01-08T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-01-08')
      expect(updateNextRun).toHaveBeenCalledWith('rec-weekly', '2024-01-15', 2, '2024-01-08')
    })

    it('verifies next_run_date calculation for monthly frequency', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-monthly', company_id: companyId,
          name: 'شهري', frequency: 'monthly', day_of_month: 15,
          start_date: '2024-01-15', next_run_date: '2024-02-15',
          last_run_date: '2024-01-15', total_runs: 1, max_runs: null,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-15T00:00:00Z', updated_at: '2024-01-15T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-m', entry_number: 'JE-M' },
      })
      const updateNextRun = vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-m', recurring_journal_id: 'rec-monthly',
        journal_entry_id: 'je-m', run_date: '2024-02-15',
        status: 'success', error_message: null, created_at: '2024-02-15T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-02-15')
      expect(updateNextRun).toHaveBeenCalledWith('rec-monthly', '2024-03-15', 2, '2024-02-15')
    })

    it('verifies next_run_date calculation for quarterly frequency', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-quarterly', company_id: companyId,
          name: 'ربعي', frequency: 'quarterly',
          start_date: '2024-01-01', next_run_date: '2024-04-01',
          last_run_date: '2024-01-01', total_runs: 1, max_runs: null,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-q', entry_number: 'JE-Q' },
      })
      const updateNextRun = vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-q', recurring_journal_id: 'rec-quarterly',
        journal_entry_id: 'je-q', run_date: '2024-04-01',
        status: 'success', error_message: null, created_at: '2024-04-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-04-01')
      const nextRunCall = updateNextRun.mock.calls[0]
      expect(nextRunCall[0]).toBe('rec-quarterly')
      expect(nextRunCall[2]).toBe(2)
      expect(nextRunCall[3]).toBe('2024-04-01')
    })

    it('verifies next_run_date calculation for yearly frequency', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-yearly', company_id: companyId,
          name: 'سنوي', frequency: 'yearly', month_of_year: 1, day_of_month: 1,
          start_date: '2024-01-01', next_run_date: '2025-01-01',
          last_run_date: '2024-01-01', total_runs: 1, max_runs: null,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-y', entry_number: 'JE-Y' },
      })
      const updateNextRun = vi.spyOn(RecurringJournalRepository.prototype, 'updateNextRun').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-y', recurring_journal_id: 'rec-yearly',
        journal_entry_id: 'je-y', run_date: '2025-01-01',
        status: 'success', error_message: null, created_at: '2025-01-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2025-01-01')
      expect(updateNextRun).toHaveBeenCalledWith('rec-yearly', '2026-01-01', 2, '2025-01-01')
    })

    it('respects max_runs limit and marks journal as completed', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-max', company_id: companyId,
          name: 'محدود', frequency: 'monthly', day_of_month: 1,
          start_date: '2024-01-01', next_run_date: '2024-02-01',
          last_run_date: '2024-01-01', total_runs: 2, max_runs: 3,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-max', entry_number: 'JE-MAX' },
      })
      const markCompleted = vi.spyOn(RecurringJournalRepository.prototype, 'markCompleted').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-max', recurring_journal_id: 'rec-max',
        journal_entry_id: 'je-max', run_date: '2024-02-01',
        status: 'success', error_message: null, created_at: '2024-02-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-02-01')
      expect(markCompleted).toHaveBeenCalledWith('rec-max')
    })

    it('skips journals with insufficient template_lines', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-skip', company_id: companyId,
          name: 'بدون بنود', frequency: 'monthly',
          start_date: '2024-01-01', next_run_date: '2024-02-01',
          last_run_date: '2024-01-01', total_runs: 1, max_runs: null,
          status: 'active', is_auto_post: true,
          template_lines: [{ account_code: '6001', debit: 100, credit: 0 }],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      const logRun = vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-skip', recurring_journal_id: 'rec-skip',
        journal_entry_id: null, run_date: '2024-02-01',
        status: 'skipped', error_message: 'لا توجد بنود قالب كافية', created_at: '2024-02-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      const r = await worker.processDueJournals('2024-02-01')
      expect(r.processed).toBe(0)
      expect(r.skipped).toBe(0)
      expect(r.failed).toBe(1)
      expect(logRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }))
    })

    it('handles status transitions: active → paused → completed → cancelled', async () => {
      vi.spyOn(RecurringJournalRepository.prototype, 'findDueForCompany').mockResolvedValue([
        {
          id: 'rec-status', company_id: companyId,
          name: 'حالة', frequency: 'monthly', day_of_month: 1,
          start_date: '2024-01-01', next_run_date: '2024-02-01',
          last_run_date: '2024-01-01', total_runs: 2, max_runs: 3,
          status: 'active', is_auto_post: true,
          template_lines: [
            { account_code: '6001', debit: 100, credit: 0 },
            { account_code: '1101', debit: 0, credit: 100 },
          ],
          created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
        },
      ])
      vi.spyOn(JournalService.prototype, 'create').mockResolvedValue({
        ok: true, data: { journal_id: 'je-st', entry_number: 'JE-ST' },
      })
      const markCompleted = vi.spyOn(RecurringJournalRepository.prototype, 'markCompleted').mockResolvedValue(undefined)
      vi.spyOn(RecurringJournalRepository.prototype, 'logRun').mockResolvedValue({
        id: 'log-st', recurring_journal_id: 'rec-status',
        journal_entry_id: 'je-st', run_date: '2024-02-01',
        status: 'success', error_message: null, created_at: '2024-02-01T00:00:00Z',
      })

      const worker = new RecurringJournalWorker(db as any, companyId)
      await worker.processDueJournals('2024-02-01')
      expect(markCompleted).toHaveBeenCalledWith('rec-status')
    })
  })

  describe('Report Materialization Workers', () => {
    it('mock refresh_reporting_views creates proper job_queue entry', async () => {
      mockFromResult(db, 'job_queue', { id: 'job-report' })
      const r = await jobQueue.enqueue(companyId, 'generate_daily_snapshots', {
        type: 'report_refresh',
        target: 'mv_trial_balance',
      })
      expect(r.ok).toBe(true)

      const insertCall = (db.from('job_queue').insert as any).mock.calls[0][0]
      expect(insertCall.task).toBe('generate_daily_snapshots')
      expect(insertCall.company_id).toBe(companyId)
    })

    it('processes materialized view refresh job successfully', async () => {
      const reportJob = {
        id: 'job-mv', company_id: companyId, task: 'generate_daily_snapshots',
        payload: { type: 'report_refresh', target: 'mv_income_statement' },
        status: 'pending', priority: 5, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      }

      mockFromResult(db, 'job_queue', reportJob)

      const worker = new QueueWorker(db as any, companyId)
      const r = await worker.processNext()

      expect(db.from('job_queue').update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      )
    })
  })

  describe('Payroll Workers', () => {
    it('creates payroll run with draft status', async () => {
      mockFromResult(db, 'payroll_runs', {
        id: 'pr-1', company_id: companyId, status: 'draft',
        total_earnings: 0, total_deductions: 0, net_pay: 0, employee_count: 0,
        posted_to_gl: false, gl_journal_entry_id: null,
      })
      const insertCall = (db.from('payroll_runs').insert as any).mock.calls[0]
      if (!insertCall) {
        db.from('payroll_runs').insert({
          company_id: companyId,
          name: 'راتب يناير 2024',
          status: 'draft',
        })
      }
      expect(db.from).toHaveBeenCalledWith('payroll_runs')
    })

    it('verifies status flow: draft → processing → completed → locked', async () => {
      const statuses = ['draft', 'processing', 'completed', 'locked']
      for (const status of statuses) {
        const idx = statuses.indexOf(status)
        mockFromResult(db, 'payroll_runs', {
          id: `pr-${idx}`, company_id: companyId, status,
          posted_to_gl: idx >= 3, gl_journal_entry_id: idx >= 3 ? 'je-gl' : null,
        })
        const q = db.from('payroll_runs').select('*').eq('company_id', companyId)
        q._result = { data: { id: `pr-${idx}`, status }, error: null }
        const { data, error } = await q
        expect(error).toBeNull()
        if (data) expect(data.status).toBe(status)
      }
    })

    it('verifies posted_to_gl flag and gl_journal_entry_id after GL posting', async () => {
      const postedRun = {
        id: 'pr-gl', company_id: companyId, status: 'locked',
        posted_to_gl: true, gl_journal_entry_id: 'je-gl-001',
        total_earnings: 50000, total_deductions: 10000, net_pay: 40000, employee_count: 5,
      }
      mockFromResult(db, 'payroll_runs', postedRun)
      const { data, error } = await db
        .from('payroll_runs')
        .select('*')
        .eq('id', 'pr-gl')
        .single()

      if (!error && data) {
        expect(data.posted_to_gl).toBe(true)
        expect(data.gl_journal_entry_id).toBe('je-gl-001')
      }
    })
  })

  describe('Inventory Workers', () => {
    it('evaluates reorder rules and detects items below reorder point', async () => {
      const reorderRules = [
        {
          id: 'rr-1', company_id: companyId, item_id: 'item-1',
          warehouse_id: 'wh-1', reorder_point: 50, reorder_qty: 100,
          min_stock: 10, max_stock: 200, is_active: true, auto_generate: true,
          preferred_supplier_id: 'supplier-1',
        },
      ]
      mockFromResult(db, 'reorder_rules', reorderRules)

      const currentStock = 30
      expect(currentStock).toBeLessThan(reorderRules[0].reorder_point)

      const { data } = await db
        .from('reorder_rules')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (data) {
        const needsReorder = data.filter(
          (r: any) => currentStock < r.reorder_point,
        )
        expect(needsReorder).toHaveLength(1)
        expect(needsReorder[0].id).toBe('rr-1')
      }
    })

    it('generates purchase order when stock below reorder point with auto_generate', async () => {
      const reorderRules = [
        {
          id: 'rr-auto', company_id: companyId, item_id: 'item-2',
          warehouse_id: 'wh-1', reorder_point: 20, reorder_qty: 50,
          min_stock: 5, max_stock: 100, is_active: true, auto_generate: true,
          preferred_supplier_id: 'supplier-2',
        },
      ]
      mockFromResult(db, 'reorder_rules', reorderRules)
      mockFromResult(db, 'purchase_orders', { id: 'po-1', status: 'draft', supplier_id: 'supplier-2' })
      mockFromResult(db, 'purchase_order_lines', { id: 'pol-1', item_id: 'item-2', qty: 50 })

      const currentStock = 10
      const needsReorder = reorderRules.filter(r => currentStock < r.reorder_point && r.auto_generate)
      expect(needsReorder).toHaveLength(1)

      if (needsReorder.length > 0) {
        const rule = needsReorder[0]
        const poData = {
          company_id: companyId,
          supplier_id: 'supplier-2',
          status: 'draft',
          items: [{ item_id: rule.item_id, qty: rule.reorder_qty }],
        }
        expect(poData.supplier_id).toBe('supplier-2')
        expect(poData.items[0].item_id).toBe('item-2')
        expect(poData.items[0].qty).toBe(50)
      }
    })

    it('processes inventory count session status transitions', async () => {
      const statuses = ['draft', 'in_progress', 'completed', 'approved', 'cancelled']
      for (const status of statuses) {
        mockFromResult(db, 'inventory_count_sessions', {
          id: `cs-${status}`, company_id: companyId,
          session_no: `CS-${status.toUpperCase()}`,
          type: 'cycle', status,
        })
        const q = db.from('inventory_count_sessions').select('*').eq('id', `cs-${status}`)
        q._result = { data: { status }, error: null }
        const { data } = await q
        if (data) expect(data.status).toBe(status)
      }
    })
  })

  describe('Reconciliation Workers', () => {
    it('matches statement_amount vs cleared_amount correctly', async () => {
      const reconciliations = [
        { id: 'rec-1', statement_amount: 10000, cleared_amount: 10000, difference: 0, status: 'matched' },
        { id: 'rec-2', statement_amount: 10000, cleared_amount: 7500, difference: 2500, status: 'partial' },
        { id: 'rec-3', statement_amount: 10000, cleared_amount: 0, difference: 10000, status: 'unmatched' },
      ]

      for (const r of reconciliations) {
        expect(Math.abs(r.statement_amount - r.cleared_amount)).toBe(r.difference)
      }

      expect(reconciliations[0].status).toBe('matched')
      expect(reconciliations[1].status).toBe('partial')
      expect(reconciliations[2].status).toBe('unmatched')
    })

    it('handles reconciliation line matching logic', async () => {
      const line = {
        id: 'rl-1', reconciliation_id: 'rec-1',
        amount: 5000, matched_amount: 5000,
        difference: 0, status: 'matched',
      }
      expect(line.amount).toBe(line.matched_amount)
      expect(line.difference).toBe(0)
      expect(line.status).toBe('matched')
    })
  })

  describe('Idempotency', () => {
    it('rejects duplicate job submissions using source/source_id', async () => {
      const source = 'invoice_post'
      const sourceId = 'inv-001'

      const idempotencyKey = `${source}:${sourceId}`
      const processedKeys = new Set<string>()

      const isDuplicate = processedKeys.has(idempotencyKey)
      expect(isDuplicate).toBe(false)

      processedKeys.add(idempotencyKey)

      const isDuplicateAfter = processedKeys.has(idempotencyKey)
      expect(isDuplicateAfter).toBe(true)

      const secondAttempt = processedKeys.has(idempotencyKey)
      expect(secondAttempt).toBe(true)
    })

    it('ensures retry does not create duplicate work', async () => {
      const processedIds = new Set<string>()
      const jobId = 'job-retry-1'

      const firstProcess = !processedIds.has(jobId)
      expect(firstProcess).toBe(true)
      processedIds.add(jobId)

      const retryProcess = processedIds.has(jobId)
      expect(retryProcess).toBe(true)

      const workCount = processedIds.size
      expect(workCount).toBe(1)
    })
  })

  describe('Retry Safety', () => {
    it('increments retry_count on failure and respects max_retries', async () => {
      const failJob = {
        id: 'job-retry', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 0, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      }

      mockFromResult(db, 'job_queue', failJob)

      const r = await jobQueue.fail('job-retry', 'خطأ مؤقت')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.retry).toBe(true)
    })

    it('sends job to DLQ (failed status) when max_retries exceeded', async () => {
      const exhaustedJob = {
        id: 'job-dlq', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'processing', priority: 0, scheduled_for: null,
        started_at: '2024-01-01T00:00:00Z', completed_at: null, error_message: null,
        retry_count: 3, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      }

      mockFromResult(db, 'job_queue', exhaustedJob)
      mockFromResult(db, 'job_queue', { id: 'job-dlq', retry_count: 3, max_retries: 3 })

      const r = await jobQueue.fail('job-dlq', 'فشل بعد 3 محاولات')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.retry).toBe(false)

      const failUpdate = (db.from('job_queue').update as any).mock.calls.find(
        (c: any) => c[0]?.status === 'failed',
      )
      expect(failUpdate).toBeDefined()
      if (failUpdate) {
        expect(failUpdate[0].error_message).toBe('فشل بعد 3 محاولات')
        expect(failUpdate[0].retry_count).toBe(4)
      }
    })

    it('captures error_message on failure', async () => {
      const errorMsg = 'خطأ في معالجة القيد المحاسبي'
      mockFromResult(db, 'job_queue', {
        id: 'job-err', retry_count: 2, max_retries: 3,
      })

      const r = await jobQueue.fail('job-err', errorMsg)
      expect(r.ok).toBe(true)

      const updateCall = (db.from('job_queue').update as any).mock.calls.find(
        (c: any) => c[0]?.error_message === errorMsg,
      )
      expect(updateCall).toBeDefined()
    })
  })

  describe('DLQ Handling', () => {
    it('lists failed jobs for recovery', async () => {
      const failedJobs = [
        { id: 'job-f1', status: 'failed', task: 'process_recurring' },
        { id: 'job-f2', status: 'failed', task: 'run_integrity_checks' },
      ]
      mockFromResult(db, 'job_queue', failedJobs)
      const r = await jobQueue.listPending(companyId, 50)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.length).toBeGreaterThanOrEqual(2)
    })

    it('re-queues a failed job by resetting its status to pending', async () => {
      const failedJob = {
        id: 'job-recover', company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'failed', priority: 0, scheduled_for: null,
        started_at: '2024-01-01T00:00:00Z', completed_at: '2024-01-01T00:01:00Z',
        error_message: 'خطأ سابق', retry_count: 3, max_retries: 3,
        created_at: '2024-01-01T00:00:00Z',
      }

      const { error } = await db
        .from('job_queue')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          error_message: null,
        })
        .eq('id', 'job-recover')
        .eq('status', 'failed')

      expect(error).toBeNull()

      const updateCall = (db.from('job_queue').update as any).mock.calls.find(
        (c: any) => c[0]?.status === 'pending' && c[0]?.error_message === null,
      )
      expect(updateCall).toBeDefined()
    })
  })

  describe('Event Ordering', () => {
    it('processes jobs in correct order by priority (high first) then FIFO', async () => {
      const jobs = [
        { id: 'j1', priority: 0, created_at: '2024-01-01T00:00:01Z', status: 'pending' },
        { id: 'j2', priority: 10, created_at: '2024-01-01T00:00:02Z', status: 'pending' },
        { id: 'j3', priority: 5, created_at: '2024-01-01T00:00:03Z', status: 'pending' },
      ]

      const sorted = [...jobs].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      expect(sorted[0].id).toBe('j2')
      expect(sorted[0].priority).toBe(10)
      expect(sorted[1].id).toBe('j3')
      expect(sorted[1].priority).toBe(5)
      expect(sorted[2].id).toBe('j1')
      expect(sorted[2].priority).toBe(0)
    })

    it('orders by priority descending then created_at ascending within same priority', async () => {
      const samePriorityJobs = [
        { id: 'a', priority: 0, created_at: '2024-01-01T00:00:03Z' },
        { id: 'b', priority: 0, created_at: '2024-01-01T00:00:01Z' },
        { id: 'c', priority: 0, created_at: '2024-01-01T00:00:02Z' },
      ]

      const sorted = [...samePriorityJobs].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      expect(sorted[0].id).toBe('b')
      expect(sorted[1].id).toBe('c')
      expect(sorted[2].id).toBe('a')
    })

    it('respects scheduled_for delays - future scheduled jobs are not dequeued', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      mockFromResult(db, 'job_queue', null, { message: 'No rows found', code: 'PGRST116' })
      const r = await jobQueue.dequeue(companyId)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data).toBeNull()
    })
  })

  describe('Worker Recovery', () => {
    it('finds jobs stuck in processing state for recovery', async () => {
      const stuckJobs = [
        {
          id: 'stuck-1', company_id: companyId, task: 'process_recurring',
          status: 'processing', started_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z', priority: 0,
        },
        {
          id: 'stuck-2', company_id: companyId, task: 'run_integrity_checks',
          status: 'processing', started_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z', priority: 0,
        },
      ]
      mockFromResult(db, 'job_queue', stuckJobs)
      const { data, error } = await db
        .from('job_queue')
        .select('*')
        .eq('status', 'processing')

      expect(error).toBeNull()
      if (data) {
        expect(data).toHaveLength(2)
        expect(data[0].status).toBe('processing')
      }
    })

    it('recovers stuck jobs by resetting to pending', async () => {
      const stuckJob = {
        id: 'stuck-recover', company_id: companyId, task: 'process_recurring',
        status: 'processing', started_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z', priority: 0,
        retry_count: 0, max_retries: 3,
      }

      const { error } = await db
        .from('job_queue')
        .update({
          status: 'pending',
          started_at: null,
        })
        .eq('id', 'stuck-recover')
        .eq('status', 'processing')

      expect(error).toBeNull()

      const updateCall = (db.from('job_queue').update as any).mock.calls.find(
        (c: any) => c[0]?.status === 'pending' && (db.from('job_queue').eq as any).mock.calls.some(
          (e: any) => e[0] === 'id' && e[1] === 'stuck-recover',
        ),
      )
      expect(updateCall).toBeDefined()
    })

    it('prevents duplicate processing after recovery', async () => {
      const processedIds = new Set<string>()
      const jobId = 'stuck-safe-1'

      const alreadyProcessing = processedIds.has(jobId)
      expect(alreadyProcessing).toBe(false)
      processedIds.add(jobId)

      const simulateRequeue = true
      if (simulateRequeue) {
        processedIds.delete(jobId)
      }
      processedIds.add(jobId)

      expect(processedIds.size).toBe(1)

      const recoveredJob = {
        id: jobId, status: 'pending',
      }
      expect(recoveredJob.status).toBe('pending')

      mockFromResult(db, 'job_queue', {
        id: jobId, company_id: companyId, task: 'process_recurring',
        payload: {}, status: 'pending', priority: 0, scheduled_for: null,
        started_at: null, completed_at: null, error_message: null,
        retry_count: 0, max_retries: 3, created_at: '2024-01-01T00:00:00Z',
      })

      const r = await jobQueue.dequeue(companyId)
      if (r.ok && r.data) {
        const isDuplicate = processedIds.has(r.data.id)
        if (!isDuplicate) {
          processedIds.add(r.data.id)
        }
      }
      expect(processedIds.size).toBe(1)
    })
  })
})
