import type { SupabaseClient } from '@supabase/supabase-js'
import { PeriodService } from '../services/period.service'
import { IntegrityService } from '../services/integrity.service'
import { AccountingEventBus } from '../events/event-bus'

export class FiscalClosingWorker {
  private readonly periodService: PeriodService
  private readonly integrityService: IntegrityService
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
    private readonly performedBy?: string,
  ) {
    this.periodService = new PeriodService(db, companyId)
    this.integrityService = new IntegrityService(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async closePeriod(periodId: string): Promise<{
    success: boolean
    warnings: string[]
    error?: string
  }> {
    const integrityResult = await this.integrityService.runAllChecks()
    if (integrityResult.ok) {
      const failed = integrityResult.data.filter(c => c.status === 'failed')
      if (failed.length > 0) {
        return {
          success: false,
          warnings: [],
          error: `توجد ${failed.length} فحوصات نزاهة فاشلة. يجب إصلاحها قبل إغلاق الفترة.`,
        }
      }
    }

    const result = await this.periodService.closePeriod(periodId, this.performedBy)

    if (!result.ok) {
      return { success: false, warnings: [], error: result.error }
    }

    await this.eventBus.emit('accounting.period.closed', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      amount: 0,
      description: `إغلاق الفترة: ${result.data.period_id}`,
      timestamp: new Date().toISOString(),
      metadata: result.data as unknown as Record<string, unknown>,
      performedBy: this.performedBy,
    })

    return {
      success: true,
      warnings: result.data.warnings || [],
    }
  }

  async yearEndClosing(fiscalYearId: string): Promise<{
    success: boolean
    closedPeriods: number
    warnings: string[]
    error?: string
  }> {
    const yearResult = await this.periodService.getYearWithPeriods(fiscalYearId)
    if (!yearResult.ok || !yearResult.data) {
      return { success: false, closedPeriods: 0, warnings: [], error: 'السنة المالية غير موجودة' }
    }

    const periods = yearResult.data.periods || []
    const openPeriods = periods.filter(p => p.status === 'open')

    let closedPeriods = 0
    const warnings: string[] = []

    for (const period of openPeriods) {
      const result = await this.closePeriod(period.id)
      if (result.success) {
        closedPeriods++
      }
      warnings.push(...result.warnings)
      if (result.error) {
        warnings.push(`فشل إغلاق ${period.name}: ${result.error}`)
      }
    }

    await this.eventBus.emit('accounting.fiscal.year.closed', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      amount: 0,
      description: `إغلاق السنة المالية: ${yearResult.data.name}`,
      timestamp: new Date().toISOString(),
      metadata: { fiscalYearId, closedPeriods, totalPeriods: openPeriods.length },
      performedBy: this.performedBy,
    })

    return { success: true, closedPeriods, warnings }
  }
}
