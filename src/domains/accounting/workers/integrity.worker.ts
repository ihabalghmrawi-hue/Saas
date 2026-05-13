import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrityService } from '../services/integrity.service'
import { AccountingEventBus } from '../events/event-bus'

export class IntegrityWorker {
  private readonly integrityService: IntegrityService
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.integrityService = new IntegrityService(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async runScheduledCheck(): Promise<{
    passed: number
    failed: number
    warnings: number
    details: Array<{ check: string; status: string }>
  }> {
    const result = await this.integrityService.runAllChecks()

    if (!result.ok) {
      return { passed: 0, failed: 1, warnings: 0, details: [{ check: 'all', status: 'failed' }] }
    }

    const checks = result.data
    const passed = checks.filter(c => c.status === 'passed').length
    const failed = checks.filter(c => c.status === 'failed').length
    const warnings = checks.filter(c => c.status === 'warning').length

    for (const check of checks) {
      if (check.status === 'failed') {
        await this.eventBus.emit('accounting.integrity.failed', {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          type: 'manual',
          companyId: this.companyId,
          amount: 0,
          description: `فشل فحص النزاهة: ${check.check_type}`,
          timestamp: new Date().toISOString(),
          metadata: check.details,
        })
      } else if (check.status === 'passed') {
        await this.eventBus.emit('accounting.integrity.passed', {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          type: 'manual',
          companyId: this.companyId,
          amount: 0,
          description: `نجاح فحص النزاهة: ${check.check_type}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    return {
      passed,
      failed,
      warnings,
      details: checks.map(c => ({ check: c.check_type, status: c.status })),
    }
  }

  async runDailySnapshot(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)

    const { error } = await this.db.rpc('generate_daily_balances', {
      p_company_id: this.companyId,
      p_as_of_date: today,
    })

    if (error) {
      await this.eventBus.emit('accounting.integrity.failed', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        amount: 0,
        description: `فشل إنشاء الأرصدة اليومية: ${error.message}`,
        timestamp: new Date().toISOString(),
      })
    }
  }
}
