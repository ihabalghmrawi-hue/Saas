import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type { ServiceResult } from '../types'

export class HrIntegrityService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async check(): Promise<ServiceResult<{ issues: any[]; severity: string }>> {
    const issues: any[] = []
    let maxSeverity = 'info'

    try {
      const { data: unclosedRuns } = await this.db.from('payroll_runs').select('id, name, status').eq('company_id', this.companyId).eq('status', 'processing')
      if (unclosedRuns?.length) {
        issues.push({ entity: 'payroll_run', severity: 'warning', issue: `${unclosedRuns.length} شغيلة رواتب في حالة معالجة` })
        maxSeverity = 'warning'
      }

      const { data: negativeBalances } = await this.db.from('leave_balances').select('*').eq('company_id', this.companyId).lt('remaining_days', 0)
      if (negativeBalances?.length) {
        issues.push({ entity: 'leave_balance', severity: 'warning', issue: `${negativeBalances.length} رصيد إجازة سالب` })
        maxSeverity = 'warning'
      }

      const { data: orphanedLoans } = await this.db.from('employee_loans').select('*, employees!inner(company_id)').eq('company_id', this.companyId).eq('status', 'active').gte('remaining_amount', 0)
      if (orphanedLoans?.length) {
        issues.push({ entity: 'employee_loan', severity: 'info', issue: `${orphanedLoans.length} قرض نشط` })
      }

      await this.logIssues(issues)

      return { ok: true, data: { issues, severity: maxSeverity } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'INTEGRITY_CHECK_FAILED' }
    }
  }

  private async logIssues(issues: any[]): Promise<void> {
    for (const issue of issues) {
      await this.db.from('hr_integrity_logs').insert({
        company_id: this.companyId, entity_type: issue.entity, entity_id: issue.entity_id || null,
        severity: issue.severity, issue: issue.issue, details: issue.details || null,
      }).maybeSingle()
    }
  }
}
