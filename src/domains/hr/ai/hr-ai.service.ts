import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult } from '../types'

/**
 * Rule-based HR AI insights (no external API calls).
 * Detects anomalies in attendance, overtime, turnover, and payroll.
 */
export class HrAIService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async detectAttendanceAnomalies(month: number, year: number): Promise<ServiceResult<any[]>> {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

      const { data: logs } = await this.db
        .from('attendance_logs')
        .select('employee_id, date, status, late_minutes, early_leave_minutes')
        .eq('company_id', this.companyId)
        .gte('date', startDate).lte('date', endDate)

      if (!logs) return { ok: true, data: [] }

      const employeeStats = new Map<string, { late: number; early: number; absent: number; total: number }>()
      for (const log of logs) {
        const stats = employeeStats.get(log.employee_id) || { late: 0, early: 0, absent: 0, total: 0 }
        stats.total++
        if (log.status === 'late') stats.late++
        if (log.status === 'early_leave') stats.early++
        if (log.status === 'absent') stats.absent++
        employeeStats.set(log.employee_id, stats)
      }

      const anomalies: any[] = []
      for (const [empId, stats] of employeeStats) {
        if (stats.absent > 5) anomalies.push({ employee_id: empId, type: 'excessive_absence', severity: 'high', details: `${stats.absent} absent days in month`, stats })
        if (stats.late > 8) anomalies.push({ employee_id: empId, type: 'excessive_lateness', severity: 'medium', details: `${stats.late} late arrivals in month`, stats })
        if (stats.early > 8) anomalies.push({ employee_id: empId, type: 'excessive_early_leave', severity: 'medium', details: `${stats.early} early leaves in month`, stats })
      }

      return { ok: true, data: anomalies }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ANOMALY_DETECTION_FAILED' }
    }
  }

  async detectOvertimeAbuse(month: number, year: number): Promise<ServiceResult<any[]>> {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

      const { data: overtimes } = await this.db
        .from('overtime_entries')
        .select('employee_id, total_minutes, overtime_type, date')
        .eq('company_id', this.companyId)
        .eq('status', 'approved')
        .gte('date', startDate).lte('date', endDate)

      if (!overtimes) return { ok: true, data: [] }

      const empTotals = new Map<string, number>()
      for (const ot of overtimes) {
        empTotals.set(ot.employee_id, (empTotals.get(ot.employee_id) || 0) + ot.total_minutes)
      }

      const threshold = 60 * 60
      const abuse: any[] = []
      for (const [empId, total] of empTotals) {
        if (total > threshold) {
          abuse.push({ employee_id: empId, type: 'excessive_overtime', severity: 'medium', details: `${Math.round(total / 60)} hours overtime in month`, totalMinutes: total })
        }
      }

      return { ok: true, data: abuse }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'OVERTIME_ANALYSIS_FAILED' }
    }
  }

  async predictTurnoverRisk(): Promise<ServiceResult<any[]>> {
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const { data: employees } = await this.db
        .from('employees')
        .select('id, full_name, status, hire_date, department_id')
        .eq('company_id', this.companyId)
        .eq('status', 'active')

      if (!employees) return { ok: true, data: [] }

      const risks: any[] = []
      for (const emp of employees) {
        let riskScore = 0
        const hireDate = new Date(emp.hire_date)
        const tenureMonths = (Date.now() - hireDate.getTime()) / (30 * 86400000)

        if (tenureMonths < 3) riskScore += 30
        else if (tenureMonths < 6) riskScore += 15
        if (tenureMonths > 60) riskScore += 10

        const { data: attendance } = await this.db
          .from('attendance_logs')
          .select('status')
          .eq('employee_id', emp.id)
          .eq('company_id', this.companyId)
          .gte('date', sixMonthsAgo.toISOString().slice(0, 10))

        if (attendance) {
          const absentCount = attendance.filter((a: any) => a.status === 'absent').length
          if (absentCount > 10) riskScore += 25
          else if (absentCount > 5) riskScore += 10
        }

        if (riskScore > 30) {
          risks.push({ employee_id: emp.id, full_name: emp.full_name, risk_score: riskScore, risk_level: riskScore > 50 ? 'high' : 'medium', tenure_months: Math.round(tenureMonths) })
        }
      }

      return { ok: true, data: risks.sort((a, b) => b.risk_score - a.risk_score) }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TURNOVER_PREDICTION_FAILED' }
    }
  }

  async detectPayrollAnomalies(runId: string): Promise<ServiceResult<any[]>> {
    try {
      const { data: summaries } = await this.db
        .from('payroll_summaries')
        .select('employee_id, gross_pay, net_pay, total_deductions')
        .eq('run_id', runId)

      if (!summaries || summaries.length < 2) return { ok: true, data: [] }

      const avgGross = summaries.reduce((s: number, r: any) => s + Number(r.gross_pay), 0) / summaries.length
      const anomalies: any[] = []

      for (const s of summaries) {
        const gross = Number(s.gross_pay)
        if (gross > avgGross * 3) anomalies.push({ employee_id: s.employee_id, type: 'abnormal_salary', severity: 'high', details: `Gross ${gross} vs avg ${avgGross.toFixed(2)}` })
        if (Number(s.total_deductions) > gross * 0.7) anomalies.push({ employee_id: s.employee_id, type: 'excessive_deductions', severity: 'medium', details: 'Deductions exceed 70% of gross' })
      }

      return { ok: true, data: anomalies }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PAYROLL_ANOMALY_FAILED' }
    }
  }

  async workforceForecast(): Promise<ServiceResult<any>> {
    try {
      const { data: employees } = await this.db.from('employees').select('department_id, status, hire_date').eq('company_id', this.companyId)

      if (!employees) return { ok: true, data: { total: 0, departments: {} } }

      const deptCount = new Map<string, number>()
      const deptTurnover = new Map<string, number>()

      for (const emp of employees) {
        const dept = emp.department_id || 'unknown'
        deptCount.set(dept, (deptCount.get(dept) || 0) + 1)
        if (emp.status === 'terminated' || emp.status === 'resigned') {
          deptTurnover.set(dept, (deptTurnover.get(dept) || 0) + 1)
        }
      }

      const departments: Record<string, any> = {}
      for (const [dept, count] of deptCount) {
        const turnover = deptTurnover.get(dept) || 0
        departments[dept] = { current: count, turnover, turnoverRate: count > 0 ? (turnover / count) * 100 : 0 }
      }

      return { ok: true, data: { total: employees.length, departments, forecast: { hiringNeeded: Object.values(departments).filter((d: any) => d.turnoverRate > 20).length } } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FORECAST_FAILED' }
    }
  }
}
