import type { SupabaseClient } from '@supabase/supabase-js'
import { LeaveTypeRepository, LeaveRequestRepository, LeaveBalanceRepository } from '../repositories/leave.repository'
import { HrEventBus } from '../events/event-bus'
import { CreateLeaveRequestSchema } from '../validators'
import type { LeaveRequestEntity, CreateLeaveRequestInput } from '../entities/leave.entity'
import type { ServiceResult } from '../types'

export class LeaveEngine {
  private readonly typeRepo: LeaveTypeRepository
  private readonly requestRepo: LeaveRequestRepository
  private readonly balanceRepo: LeaveBalanceRepository
  private readonly eventBus: HrEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.typeRepo = new LeaveTypeRepository(db, companyId)
    this.requestRepo = new LeaveRequestRepository(db, companyId)
    this.balanceRepo = new LeaveBalanceRepository(db, companyId)
    this.eventBus = HrEventBus.getInstance()
  }

  async request(input: CreateLeaveRequestInput): Promise<ServiceResult<LeaveRequestEntity>> {
    const parsed = CreateLeaveRequestSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }

    const leaveType = await this.typeRepo.findById(input.leave_type_id)
    if (!leaveType) return { ok: false, error: 'نوع الإجازة غير موجود', code: 'LEAVE_TYPE_NOT_FOUND' }

    const days = this.calculateWorkingDays(input.start_date, input.end_date)
    if (days < leaveType.min_days) return { ok: false, error: `الحد الأدنى ${leaveType.min_days} أيام`, code: 'MIN_DAYS' }
    if (days > leaveType.max_days_per_request) return { ok: false, error: `الحد الأقصى ${leaveType.max_days_per_request} أيام لكل طلب`, code: 'MAX_DAYS' }

    if (!leaveType.is_paid) {
      const year = new Date(input.start_date).getFullYear()
      const balance = await this.balanceRepo.findByEmployee(input.employee_id, input.leave_type_id, year)
      const remaining = balance ? balance.remaining_days - balance.pending_days : 0
      if (remaining < days) return { ok: false, error: 'الرصيد غير كافٍ لهذه الإجازة', code: 'INSUFFICIENT_BALANCE' }
    }

    try {
      const leave = await this.requestRepo.create({
        employee_id: input.employee_id, leave_type_id: input.leave_type_id,
        start_date: input.start_date, end_date: input.end_date,
        total_days: days, is_half_day: input.is_half_day || false,
        reason: input.reason || null, attachment_url: input.attachment_url || null,
        status: leaveType.requires_approval ? 'pending' : 'approved',
      })

      if (leave.status === 'approved') {
        await this.balanceRepo.reduceBalance(input.employee_id, input.leave_type_id, new Date(input.start_date).getFullYear(), days)
      } else {
        this.eventBus.emit('hr.leave.requested', {
          id: leave.id, type: 'hr.leave.requested', companyId: this.companyId,
          employeeId: input.employee_id, timestamp: new Date().toISOString(),
          metadata: { leaveType: leaveType.leave_type, days, startDate: input.start_date },
        })
      }

      return { ok: true, data: leave }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LEAVE_REQUEST_FAILED' }
    }
  }

  async approve(leaveId: string, approvedBy: string): Promise<ServiceResult<LeaveRequestEntity>> {
    const leave = await this.requestRepo.findById(leaveId)
    if (!leave) return { ok: false, error: 'طلب الإجازة غير موجود', code: 'NOT_FOUND' }
    if (leave.status !== 'pending') return { ok: false, error: 'يمكن الموافقة على الطلبات المعلقة فقط', code: 'INVALID_STATUS' }

    try {
      const updated = await this.requestRepo.approve(leaveId, approvedBy)
      const year = new Date(leave.start_date).getFullYear()
      await this.balanceRepo.reduceBalance(leave.employee_id, leave.leave_type_id, year, leave.total_days)

      this.eventBus.emit('hr.leave.approved', {
        id: leaveId, type: 'hr.leave.approved', companyId: this.companyId,
        employeeId: leave.employee_id, timestamp: new Date().toISOString(), performedBy: approvedBy,
        metadata: { days: leave.total_days, startDate: leave.start_date },
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'APPROVE_FAILED' }
    }
  }

  async reject(leaveId: string, reason: string): Promise<ServiceResult<LeaveRequestEntity>> {
    const leave = await this.requestRepo.findById(leaveId)
    if (!leave) return { ok: false, error: 'طلب الإجازة غير موجود', code: 'NOT_FOUND' }
    if (leave.status !== 'pending') return { ok: false, error: 'يمكن رفض الطلبات المعلقة فقط', code: 'INVALID_STATUS' }

    try {
      const updated = await this.requestRepo.reject(leaveId, reason)
      this.eventBus.emit('hr.leave.rejected', {
        id: leaveId, type: 'hr.leave.rejected', companyId: this.companyId,
        employeeId: leave.employee_id, timestamp: new Date().toISOString(),
        metadata: { reason },
      })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REJECT_FAILED' }
    }
  }

  async cancel(leaveId: string): Promise<ServiceResult<LeaveRequestEntity>> {
    const leave = await this.requestRepo.findById(leaveId)
    if (!leave) return { ok: false, error: 'طلب الإجازة غير موجود', code: 'NOT_FOUND' }
    if (leave.status === 'cancelled') return { ok: false, error: 'الطلب ملغي بالفعل', code: 'ALREADY_CANCELLED' }

    try {
      const updated = await this.requestRepo.cancel(leaveId)
      if (leave.status === 'approved') {
        const year = new Date(leave.start_date).getFullYear()
        await this.balanceRepo.reduceBalance(leave.employee_id, leave.leave_type_id, year, -leave.total_days)
      }
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CANCEL_FAILED' }
    }
  }

  async getBalances(employeeId: string): Promise<ServiceResult<any[]>> {
    try {
      const year = new Date().getFullYear()
      const balances = await this.balanceRepo.findBalancesByEmployee(employeeId, year)
      return { ok: true, data: balances }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async accrueAnnualLeave(employeeId: string, year: number, days: number): Promise<ServiceResult<void>> {
    try {
      const types = await this.typeRepo.findAll()
      const annualType = types.find(t => t.leave_type === 'annual')
      if (!annualType) return { ok: false, error: 'نوع الإجازة السنوية غير موجود', code: 'NO_ANNUAL_LEAVE' }

      await this.balanceRepo.upsert({
        employee_id: employeeId, leave_type_id: annualType.id, year,
        entitled_days: days, remaining_days: days, taken_days: 0, pending_days: 0, carried_over: 0, encashed_days: 0,
      })
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ACCRUE_FAILED' }
    }
  }

  private calculateWorkingDays(start: string, end: string): number {
    const startDate = new Date(start); const endDate = new Date(end)
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
  }
}
