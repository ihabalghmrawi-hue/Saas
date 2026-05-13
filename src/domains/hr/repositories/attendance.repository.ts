import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type { ShiftEntity, ShiftAssignmentEntity, AttendanceLogEntity, AttendanceSessionEntity, HolidayCalendarEntity, OvertimeEntryEntity } from '../entities/attendance.entity'

export class ShiftRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findAll(): Promise<ShiftEntity[]> {
    const { data, error } = await this.db.from('shifts').select('*').eq('company_id', this.companyId).eq('is_active', true).order('name')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async findById(id: string): Promise<ShiftEntity | null> {
    const { data, error } = await this.db.from('shifts').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<ShiftEntity>): Promise<ShiftEntity> {
    const { data, error } = await this.db.from('shifts').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class ShiftAssignmentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findActiveByEmployee(employeeId: string): Promise<ShiftAssignmentEntity | null> {
    const { data, error } = await this.db.from('shift_assignments').select('*, shift:shifts(*)').eq('employee_id', employeeId).eq('is_active', true).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async assign(input: Partial<ShiftAssignmentEntity>): Promise<ShiftAssignmentEntity> {
    const { data, error } = await this.db.from('shift_assignments').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async deactivateAll(employeeId: string): Promise<void> {
    const { error } = await this.db.from('shift_assignments').update({ is_active: false, effective_to: new Date().toISOString().slice(0, 10) }).eq('employee_id', employeeId).eq('company_id', this.companyId).eq('is_active', true)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}

export class HolidayCalendarRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByYear(year: number): Promise<HolidayCalendarEntity | null> {
    const { data, error } = await this.db.from('holiday_calendars').select('*').eq('company_id', this.companyId).eq('year', year).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class AttendanceLogRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByEmployeeDate(employeeId: string, date: string): Promise<AttendanceLogEntity | null> {
    const { data, error } = await this.db.from('attendance_logs').select('*').eq('employee_id', employeeId).eq('date', date).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<AttendanceLogEntity>): Promise<AttendanceLogEntity> {
    const { data, error } = await this.db.from('attendance_logs').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async update(id: string, input: Partial<AttendanceLogEntity>): Promise<AttendanceLogEntity> {
    const { data, error } = await this.db.from('attendance_logs').update(input).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findRange(companyId: string, fromDate: string, toDate: string, employeeId?: string): Promise<AttendanceLogEntity[]> {
    let query = this.db.from('attendance_logs').select('*').eq('company_id', companyId).gte('date', fromDate).lte('date', toDate)
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query.order('date')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class AttendanceSessionRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async create(input: Partial<AttendanceSessionEntity>): Promise<AttendanceSessionEntity> {
    const { data, error } = await this.db.from('attendance_sessions').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async updateCheckOut(id: string, checkOut: string, method?: string, location?: Record<string, unknown>): Promise<AttendanceSessionEntity> {
    const update: any = { check_out: checkOut }
    if (method) update.check_out_method = method
    if (location) update.location = location
    const { data, error } = await this.db.from('attendance_sessions').update(update).eq('id', id).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class OvertimeRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByEmployeeDate(employeeId: string, date: string): Promise<OvertimeEntryEntity[]> {
    const { data, error } = await this.db.from('overtime_entries').select('*').eq('employee_id', employeeId).eq('date', date).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async create(input: Partial<OvertimeEntryEntity>): Promise<OvertimeEntryEntity> {
    const { data, error } = await this.db.from('overtime_entries').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async approve(id: string, approvedBy: string): Promise<OvertimeEntryEntity> {
    const { data, error } = await this.db.from('overtime_entries').update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() }).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findPending(companyId: string): Promise<OvertimeEntryEntity[]> {
    const { data, error } = await this.db.from('overtime_entries').select('*').eq('company_id', companyId).eq('status', 'pending')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}
