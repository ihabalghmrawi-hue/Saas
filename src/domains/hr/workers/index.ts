import type { SupabaseClient } from '@supabase/supabase-js'
import { PayrollEngine } from '../payroll/payroll-engine'
import { LeaveEngine } from '../leaves/leave-engine'
import { AttendanceEngine } from '../attendance/attendance-engine'
import { HrIntegrityService } from '../services/integrity.service'

export class PayrollWorker {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async processPendingRun(runId: string, processedBy?: string) {
    const engine = new PayrollEngine(this.db, this.companyId)
    return engine.processRun(runId, processedBy)
  }

  async lockCompletedRun(runId: string, lockedBy: string) {
    const engine = new PayrollEngine(this.db, this.companyId)
    return engine.lockRun(runId, lockedBy)
  }
}

export class LeaveWorker {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async accrueAnnualLeave(employeeId: string, year: number, days: number) {
    const engine = new LeaveEngine(this.db, this.companyId)
    return engine.accrueAnnualLeave(employeeId, year, days)
  }

  async bulkAccrueAnnualLeave(year: number, entitledDays: number) {
    const { default: repo } = await import('../repositories/employee.repository')
    const empRepo = new repo.EmployeeRepository(this.db, this.companyId)
    const engine = new LeaveEngine(this.db, this.companyId)
    const result = await empRepo.findPaged({ status: 'active', limit: 5000 })
    for (const emp of result.data) {
      await engine.accrueAnnualLeave(emp.id, year, entitledDays)
    }
    return { ok: true, data: { processed: result.data.length } }
  }
}

export class AttendanceWorker {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async reconcileAttendance(date: string) {
    const engine = new AttendanceEngine(this.db, this.companyId)
    return engine.getAttendanceRange(date, date)
  }
}

export class IntegrityWorker {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async runIntegrityCheck() {
    const service = new HrIntegrityService(this.db, this.companyId)
    return service.check()
  }
}

export class WorkforceAnalyticsWorker {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async computeTurnover(fromDate: string, toDate: string): Promise<any> {
    const { data, error } = await this.db.from('employees')
      .select('status, hire_date')
      .eq('company_id', this.companyId)
      .or(`status.in.(terminated,resigned),hire_date.gte.${fromDate}`)
    if (error) return { ok: false, error: error.message }
    const terminated = (data || []).filter((e: any) => e.status === 'terminated' || e.status === 'resigned').length
    const total = (data || []).length
    const turnoverRate = total > 0 ? (terminated / total) * 100 : 0
    return { ok: true, data: { total, terminated, turnoverRate } }
  }
}
