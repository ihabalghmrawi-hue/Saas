import type { SupabaseClient } from '@supabase/supabase-js'
import { JobQueueService } from '../events/job-queue.service'
import { RecurringJournalWorker } from './recurring-journal.worker'
import { IntegrityWorker } from './integrity.worker'
import { FiscalClosingWorker } from './fiscal-closing.worker'
import type { JobTask } from '../events/job-queue.service'

export class QueueWorker {
  private readonly jobQueue: JobQueueService

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.jobQueue = new JobQueueService(db)
  }

  async processNext(): Promise<{ processed: boolean; task?: string; error?: string }> {
    const dequeued = await this.jobQueue.dequeue(this.companyId)
    if (!dequeued.ok || !dequeued.data) {
      return { processed: false }
    }

    const job = dequeued.data

    try {
      const result = await this.dispatch(job.task as JobTask, job.payload)

      if (result.ok) {
        await this.jobQueue.complete(job.id, result.data)
        return { processed: true, task: job.task }
      }

      await this.jobQueue.fail(job.id, result.error || 'فشل غير معروف')
      return { processed: false, task: job.task, error: result.error }
    } catch (e: any) {
      await this.jobQueue.fail(job.id, e.message)
      return { processed: false, task: job.task, error: e.message }
    }
  }

  async processAll(maxJobs = 10): Promise<{
    processed: number
    failed: number
    errors: string[]
  }> {
    let processed = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < maxJobs; i++) {
      const result = await this.processNext()
      if (!result.processed) break
      if (result.error) {
        failed++
        errors.push(result.error)
      } else {
        processed++
      }
    }

    return { processed, failed, errors }
  }

  private async dispatch(
    task: JobTask,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: any; error?: string }> {
    switch (task) {
      case 'process_recurring': {
        const worker = new RecurringJournalWorker(this.db, this.companyId)
        const result = await worker.processDueJournals(payload.runDate as string)
        return { ok: true, data: result }
      }

      case 'run_integrity_checks': {
        const worker = new IntegrityWorker(this.db, this.companyId)
        const result = await worker.runScheduledCheck()
        return { ok: true, data: result }
      }

      case 'generate_daily_snapshots': {
        const worker = new IntegrityWorker(this.db, this.companyId)
        await worker.runDailySnapshot()
        return { ok: true }
      }

      case 'send_notification': {
        const { NotificationService } = await import('../events/notification.service')
        const ns = new NotificationService(this.db)
        await ns.send({
          companyId: this.companyId,
          type: payload.eventType as string || 'accounting_alert',
          title: payload.description as string || 'إشعار محاسبي',
          severity: 'info',
          metadata: payload.metadata as Record<string, unknown> || {},
        })
        return { ok: true }
      }

      case 'close_period': {
        const worker = new FiscalClosingWorker(this.db, this.companyId, payload.performedBy as string)
        const result = await worker.closePeriod(payload.periodId as string)
        return { ok: result.success, data: result, error: result.error }
      }

      case 'fiscal_year_close': {
        const worker = new FiscalClosingWorker(this.db, this.companyId, payload.performedBy as string)
        const result = await worker.yearEndClosing(payload.fiscalYearId as string)
        return { ok: result.success, data: result, error: result.error }
      }

      case 'auto_post':
      case 'suggest_reconciliations':
        return { ok: true }

      default:
        return { ok: false, error: `مهمة غير معروفة: ${task}` }
    }
  }
}
