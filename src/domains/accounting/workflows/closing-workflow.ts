import type { SupabaseClient } from '@supabase/supabase-js'
import { PeriodService } from '../services/period.service'
import { IntegrityService } from '../services/integrity.service'
import { JournalService } from '../services/journal.service'
import { AccountingEventBus } from '../events/event-bus'

export interface ClosingWorkflowResult {
  success: boolean
  steps: Array<{ name: string; status: string; message?: string }>
}

export class ClosingWorkflow {
  private readonly periodService: PeriodService
  private readonly integrityService: IntegrityService
  private readonly journalService: JournalService
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
    private readonly performedBy?: string,
  ) {
    this.periodService = new PeriodService(db, companyId)
    this.integrityService = new IntegrityService(db, companyId)
    this.journalService = new JournalService(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async executeFullClosing(periodId: string): Promise<ClosingWorkflowResult> {
    const steps: ClosingWorkflowResult['steps'] = []

    steps.push({ name: 'check_integrity', status: 'running' })
    const integrityResult = await this.integrityService.runAllChecks()
    if (integrityResult.ok) {
      const failed = integrityResult.data.filter(c => c.status === 'failed')
      if (failed.length > 0) {
        steps[0].status = 'failed'
        steps[0].message = `توجد ${failed.length} فحوصات فاشلة`
        return { success: false, steps }
      }
      steps[0].status = 'passed'
    } else {
      steps[0].status = 'failed'
      steps[0].message = integrityResult.error
      return { success: false, steps }
    }

    steps.push({ name: 'verify_drafts', status: 'running' })
    const draftCount = await this.journalService.countByStatus('draft')
    const pendingCount = await this.journalService.countByStatus('pending')
    if (draftCount > 0 || pendingCount > 0) {
      steps[1].status = 'warning'
      steps[1].message = `${draftCount} مسودة و ${pendingCount} قيد معلق`
    } else {
      steps[1].status = 'passed'
    }

    steps.push({ name: 'close_period', status: 'running' })
    const closeResult = await this.periodService.closePeriod(periodId, this.performedBy)
    if (closeResult.ok) {
      steps[2].status = 'passed'
      steps[2].message = `تم إغلاق الفترة بنجاح`
    } else {
      steps[2].status = 'failed'
      steps[2].message = closeResult.error
      return { success: false, steps }
    }

    const allPassed = steps.every(s => s.status === 'passed' || s.status === 'warning')
    return { success: allPassed, steps }
  }
}
