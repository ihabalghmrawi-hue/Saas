import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult } from '../types'

export class HrReportGenerator {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async payrollSummary(runId: string): Promise<ServiceResult<any>> {
    try {
      const { data: run } = await this.db.from('payroll_runs').select('*').eq('id', runId).eq('company_id', this.companyId).single()
      const { data: summaries } = await this.db.from('payroll_summaries').select('*, employees(full_name, full_name_ar, employee_no)').eq('run_id', runId)
      const { data: lines } = await this.db.from('payroll_lines').select('line_type, category, sum(amount)').eq('run_id', runId).eq('company_id', this.companyId)

      return {
        ok: true,
        data: {
          run: run || null,
          summaries: summaries || [],
          totals: {
            byType: (lines || []).reduce((acc: any, l: any) => {
              acc[l.line_type] = (acc[l.line_type] || 0) + Number(l.sum)
              return acc
            }, {}),
          },
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REPORT_FAILED' }
    }
  }

  async attendanceAnalysis(fromDate: string, toDate: string): Promise<ServiceResult<any>> {
    try {
      const { data: logs } = await this.db
        .from('attendance_logs')
        .select('employee_id, status, date, late_minutes, overtime_minutes')
        .eq('company_id', this.companyId)
        .gte('date', fromDate).lte('date', toDate)

      const stats = {
        total: logs?.length || 0,
        present: 0, absent: 0, late: 0, earlyLeave: 0,
        totalLateMinutes: 0, totalOvertimeMinutes: 0,
      }

      for (const log of logs || []) {
        if (log.status === 'present') stats.present++
        else if (log.status === 'absent') stats.absent++
        else if (log.status === 'late') { stats.late++; stats.totalLateMinutes += (log.late_minutes || 0) }
        else if (log.status === 'early_leave') stats.earlyLeave++
        stats.totalOvertimeMinutes += (log.overtime_minutes || 0)
      }

      const presentPct = stats.total > 0 ? (stats.present / stats.total) * 100 : 0
      const absentPct = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0

      return { ok: true, data: { ...stats, presentPct: presentPct.toFixed(1), absentPct: absentPct.toFixed(1) } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ATTENDANCE_REPORT_FAILED' }
    }
  }

  async overtimeAnalysis(fromDate: string, toDate: string): Promise<ServiceResult<any>> {
    try {
      const { data } = await this.db
        .from('overtime_entries')
        .select('overtime_type, total_minutes, amount, status')
        .eq('company_id', this.companyId)
        .gte('date', fromDate).lte('date', toDate)

      const byType = (data || []).reduce((acc: any, o: any) => {
        const t = o.overtime_type
        if (!acc[t]) acc[t] = { count: 0, totalMinutes: 0, totalAmount: 0 }
        acc[t].count++; acc[t].totalMinutes += (o.total_minutes || 0); acc[t].totalAmount += (Number(o.amount) || 0)
        return acc
      }, {})

      const totalMinutes = (data || []).reduce((s: number, o: any) => s + (o.total_minutes || 0), 0)
      return { ok: true, data: { totalEntries: data?.length || 0, totalMinutes, byType } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'OVERTIME_REPORT_FAILED' }
    }
  }

  async leaveBalancesReport(): Promise<ServiceResult<any>> {
    try {
      const year = new Date().getFullYear()
      const { data } = await this.db
        .from('leave_balances')
        .select('*, employees!inner(full_name, full_name_ar, employee_no, department_id), leave_types!inner(name, name_ar)')
        .eq('company_id', this.companyId)
        .eq('year', year)
        .order('remaining_days')

      return { ok: true, data: data || [] }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LEAVE_REPORT_FAILED' }
    }
  }

  async departmentCosts(fromDate: string, toDate: string): Promise<ServiceResult<any>> {
    try {
      const { data } = await this.db
        .from('payroll_summaries')
        .select('employee_id, gross_pay, net_pay, employer_contributions, run_id')
        .eq('company_id', this.companyId)

      if (!data) return { ok: true, data: [] }

      const { data: employees } = await this.db.from('employees').select('id, department_id').eq('company_id', this.companyId)
      const empDept = new Map((employees || []).map((e: any) => [e.id, e.department_id]))
      const { data: departments } = await this.db.from('departments').select('id, name, name_ar').eq('company_id', this.companyId)
      const deptMap = new Map((departments || []).map((d: any) => [d.id, d]))

      const deptCosts = new Map<string, { gross: number; net: number; employer: number; count: number }>()
      for (const s of data) {
        const deptId = empDept.get(s.employee_id) || 'unknown'
        const cost = deptCosts.get(deptId) || { gross: 0, net: 0, employer: 0, count: 0 }
        cost.gross += Number(s.gross_pay); cost.net += Number(s.net_pay); cost.employer += Number(s.employer_contributions); cost.count++
        deptCosts.set(deptId, cost)
      }

      const result = Array.from(deptCosts.entries()).map(([deptId, cost]) => {
        const dept = deptMap.get(deptId)
        return { department_id: deptId, department_name: dept?.name || deptId, department_name_ar: dept?.name_ar || '', ...cost }
      })

      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DEPT_COST_FAILED' }
    }
  }

  async employeeTurnover(fromDate: string, toDate: string): Promise<ServiceResult<any>> {
    try {
      const { data: hired } = await this.db.from('employees').select('id').eq('company_id', this.companyId).gte('hire_date', fromDate).lte('hire_date', toDate)
      const { data: left } = await this.db.from('employees').select('id, status').eq('company_id', this.companyId).or('status.eq.terminated,status.eq.resigned')

      const { count: total } = await this.db.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', this.companyId).eq('status', 'active')

      const turnoverRate = total && total > 0 ? ((left?.length || 0) / (total + (left?.length || 0))) * 100 : 0

      return {
        ok: true,
        data: {
          hired: hired?.length || 0,
          left: left?.length || 0,
          currentActive: total || 0,
          turnoverRate: turnoverRate.toFixed(2),
          period: { from: fromDate, to: toDate },
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TURNOVER_REPORT_FAILED' }
    }
  }

  async workforceAnalytics(): Promise<ServiceResult<any>> {
    try {
      const { data: employees } = await this.db.from('employees').select('department_id, status, gender, nationality').eq('company_id', this.companyId)

      if (!employees) return { ok: true, data: { total: 0 } }

      const byStatus = new Map<string, number>()
      const byGender = new Map<string, number>()
      const byNationality = new Map<string, number>()

      for (const e of employees) {
        byStatus.set(e.status, (byStatus.get(e.status) || 0) + 1)
        if (e.gender) byGender.set(e.gender, (byGender.get(e.gender) || 0) + 1)
        if (e.nationality) byNationality.set(e.nationality, (byNationality.get(e.nationality) || 0) + 1)
      }

      return {
        ok: true,
        data: {
          total: employees.length,
          byStatus: Object.fromEntries(byStatus),
          byGender: Object.fromEntries(byGender),
          byNationality: Object.fromEntries(byNationality),
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ANALYTICS_FAILED' }
    }
  }
}
