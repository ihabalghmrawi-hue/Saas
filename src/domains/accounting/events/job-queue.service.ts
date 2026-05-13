import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountingDomainEvent, AccountingEventPayload } from './accounting-event'
import type { ServiceResult } from '../types'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type JobTask =
  | 'process_recurring'
  | 'run_integrity_checks'
  | 'generate_daily_snapshots'
  | 'suggest_reconciliations'
  | 'auto_post'
  | 'send_notification'
  | 'close_period'
  | 'fiscal_year_close'

export interface JobQueueItem {
  id: string
  company_id: string
  task: JobTask
  payload: Record<string, unknown>
  status: JobStatus
  priority: number
  scheduled_for: string | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  retry_count: number
  max_retries: number
  created_at: string
}

export class JobQueueService {
  constructor(private readonly db: SupabaseClient) {}

  async enqueue(
    companyId: string,
    task: JobTask,
    payload: Record<string, unknown>,
    opts?: { priority?: number; scheduledFor?: string; maxRetries?: number },
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await this.db
        .from('job_queue')
        .insert({
          company_id: companyId,
          task,
          payload,
          status: 'pending',
          priority: opts?.priority ?? 0,
          scheduled_for: opts?.scheduledFor || null,
          max_retries: opts?.maxRetries ?? 3,
          retry_count: 0,
        })
        .select('id')
        .single()

      if (error) throw error
      return { ok: true, data: { id: data.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ENQUEUE_FAILED' }
    }
  }

  async enqueueFromEvent(
    event: AccountingDomainEvent,
    payload: AccountingEventPayload,
    companyId: string,
  ): Promise<ServiceResult<{ id: string }>> {
    const task = this.eventToTask(event)
    if (!task) return { ok: false, error: 'لا توجد مهمة لهذا الحدث', code: 'NO_TASK_MAPPING' }

    return this.enqueue(companyId, task, {
      eventId: payload.id,
      eventType: event,
      journalEntryId: payload.journalEntryId,
      entryNumber: payload.entryNumber,
      amount: payload.amount,
      description: payload.description,
      reference: payload.reference,
      sourceId: payload.sourceId,
      metadata: payload.metadata,
      performedBy: payload.performedBy,
    })
  }

  async dequeue(companyId?: string): Promise<ServiceResult<JobQueueItem | null>> {
    try {
      let query = this.db
        .from('job_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') return { ok: true, data: null }
        throw error
      }

      await this.db
        .from('job_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', data.id)

      return { ok: true, data: data as JobQueueItem }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DEQUEUE_FAILED' }
    }
  }

  async complete(jobId: string, result?: Record<string, unknown>): Promise<ServiceResult<void>> {
    try {
      const { error } = await this.db
        .from('job_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          payload: result ? JSON.stringify(result) : undefined,
        })
        .eq('id', jobId)

      if (error) throw error
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'COMPLETE_JOB_FAILED' }
    }
  }

  async fail(jobId: string, errorMessage: string): Promise<ServiceResult<{ retry: boolean }>> {
    try {
      const { data: job, error: fetchError } = await this.db
        .from('job_queue')
        .select('retry_count, max_retries')
        .eq('id', jobId)
        .single()

      if (fetchError) throw fetchError

      const newRetryCount = (job.retry_count || 0) + 1
      const shouldRetry = newRetryCount < (job.max_retries || 3)

      const { error } = await this.db
        .from('job_queue')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          error_message: errorMessage,
          retry_count: newRetryCount,
          completed_at: shouldRetry ? null : new Date().toISOString(),
        })
        .eq('id', jobId)

      if (error) throw error
      return { ok: true, data: { retry: shouldRetry } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FAIL_JOB_FAILED' }
    }
  }

  async cancel(jobId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await this.db
        .from('job_queue')
        .update({ status: 'cancelled' })
        .eq('id', jobId)

      if (error) throw error
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CANCEL_JOB_FAILED' }
    }
  }

  async listPending(companyId?: string, limit = 50): Promise<ServiceResult<JobQueueItem[]>> {
    try {
      let query = this.db
        .from('job_queue')
        .select('*')
        .in('status', ['pending', 'failed'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit)

      if (companyId) query = query.eq('company_id', companyId)

      const { data, error } = await query
      if (error) throw error
      return { ok: true, data: (data || []) as JobQueueItem[] }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LIST_JOBS_FAILED' }
    }
  }

  private eventToTask(event: AccountingDomainEvent): JobTask | null {
    const map: Partial<Record<AccountingDomainEvent, JobTask>> = {
      'accounting.journal.posted': 'send_notification',
      'accounting.journal.reversed': 'send_notification',
      'accounting.journal.voided': 'send_notification',
      'accounting.period.closed': 'close_period',
      'accounting.reconciliation.completed': 'send_notification',
      'accounting.integrity.failed': 'run_integrity_checks',
      'accounting.integrity.passed': 'send_notification',
      'accounting.recurring.executed': 'process_recurring',
      'accounting.fiscal.year.closed': 'fiscal_year_close',
      'accounting.snapshot.created': 'generate_daily_snapshots',
    }
    return map[event] || null
  }
}
