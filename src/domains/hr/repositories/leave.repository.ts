import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type { LeaveTypeEntity, LeaveRequestEntity, LeaveBalanceEntity } from '../entities/leave.entity'

export class LeaveTypeRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findAll(): Promise<LeaveTypeEntity[]> {
    const { data, error } = await this.db.from('leave_types').select('*').eq('company_id', this.companyId).eq('is_active', true).order('name')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async findById(id: string): Promise<LeaveTypeEntity | null> {
    const { data, error } = await this.db.from('leave_types').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class LeaveRequestRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findById(id: string): Promise<LeaveRequestEntity | null> {
    const { data, error } = await this.db.from('leave_requests').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<LeaveRequestEntity>): Promise<LeaveRequestEntity> {
    const { data, error } = await this.db.from('leave_requests').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async approve(id: string, approvedBy: string): Promise<LeaveRequestEntity> {
    const { data, error } = await this.db.from('leave_requests').update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() }).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async reject(id: string, reason: string): Promise<LeaveRequestEntity> {
    const { data, error } = await this.db.from('leave_requests').update({ status: 'rejected', rejected_reason: reason }).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async cancel(id: string): Promise<LeaveRequestEntity> {
    const { data, error } = await this.db.from('leave_requests').update({ status: 'cancelled' }).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findPending(companyId: string): Promise<LeaveRequestEntity[]> {
    const { data, error } = await this.db.from('leave_requests').select('*').eq('company_id', companyId).eq('status', 'pending').order('created_at')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async findByEmployee(employeeId: string, year?: number): Promise<LeaveRequestEntity[]> {
    let query = this.db.from('leave_requests').select('*').eq('employee_id', employeeId).eq('company_id', this.companyId)
    if (year) {
      const start = `${year}-01-01`; const end = `${year}-12-31`
      query = query.gte('start_date', start).lte('end_date', end)
    }
    const { data, error } = await query.order('start_date', { ascending: false })
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class LeaveBalanceRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByEmployee(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalanceEntity | null> {
    const { data, error } = await this.db.from('leave_balances').select('*').eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async upsert(input: Partial<LeaveBalanceEntity> & { employee_id: string; leave_type_id: string; year: number }): Promise<LeaveBalanceEntity> {
    const existing = await this.findByEmployee(input.employee_id, input.leave_type_id, input.year)
    if (existing) {
      const { data, error } = await this.db.from('leave_balances').update(input).eq('id', existing.id).select().single()
      if (error) throw new RepositoryError(error.message, error.code)
      return data
    }
    const { data, error } = await this.db.from('leave_balances').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async reduceBalance(employeeId: string, leaveTypeId: string, year: number, days: number): Promise<void> {
    const { error } = await this.db.rpc('reduce_leave_balance', {
      p_employee_id: employeeId, p_leave_type_id: leaveTypeId, p_year: year, p_days: days,
    })
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async findBalancesByEmployee(employeeId: string, year: number): Promise<LeaveBalanceEntity[]> {
    const { data, error } = await this.db.from('leave_balances').select('*, leave_type:leave_types(*)').eq('employee_id', employeeId).eq('year', year).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}
