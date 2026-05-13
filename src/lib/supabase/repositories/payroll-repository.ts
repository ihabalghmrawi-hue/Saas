import { BaseRepository } from './base-repository'
import type { PayrollRun, PayrollEmployee } from '@/lib/workbench/types'

export class PayrollRunRepository extends BaseRepository<PayrollRun> {
  constructor() {
    super('payroll_runs')
  }

  async getByPeriod(period: string): Promise<{ data: PayrollRun[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('period', period)
        .order('startDate', { ascending: false })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PayrollRun[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getCurrent(): Promise<{ data: PayrollRun | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .not('status', 'in', '("paid","cancelled")')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return { data: null }
        return { data: null, error: error.message }
      }
      return { data: data as PayrollRun }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async processRun(id: string): Promise<{ data: PayrollRun | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({ status: 'processing' } as Partial<PayrollRun>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as PayrollRun }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }

  async approveRun(id: string, approvedBy: string): Promise<{ data: PayrollRun | null; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          status: 'approved',
          approvedBy,
          approvedAt: Date.now(),
        } as Partial<PayrollRun>)
        .eq('id', id)
        .select()
        .single()

      if (error) return { data: null, error: error.message }
      return { data: data as PayrollRun }
    } catch (e) {
      return { data: null, error: (e as Error).message }
    }
  }
}

export class PayrollEmployeeRepository extends BaseRepository<PayrollEmployee> {
  constructor() {
    super('payroll_employees')
  }

  async getByRun(runId: string): Promise<{ data: PayrollEmployee[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('runId', runId)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PayrollEmployee[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getByDepartment(dept: string): Promise<{ data: PayrollEmployee[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('department', dept)
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PayrollEmployee[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }

  async getAnomalies(runId: string): Promise<{ data: PayrollEmployee[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('runId', runId)
        .eq('status', 'anomaly')
        .order('name', { ascending: true })

      if (error) return { data: [], error: error.message }
      return { data: (data ?? []) as PayrollEmployee[] }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  }
}

export const payrollRunsRepo = new PayrollRunRepository()
export const payrollEmployeesRepo = new PayrollEmployeeRepository()
