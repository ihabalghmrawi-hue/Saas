import type { SupabaseClient } from '@supabase/supabase-js'
import { AttendanceLogRepository, AttendanceSessionRepository, ShiftRepository, ShiftAssignmentRepository, HolidayCalendarRepository, OvertimeRepository } from '../repositories/attendance.repository'
import { HrEventBus } from '../events/event-bus'
import { CheckInSchema } from '../validators'
import type { AttendanceLogEntity, CheckInInput, CheckOutInput, CreateOvertimeInput } from '../entities/attendance.entity'
import type { ServiceResult, AttendanceStatus } from '../types'

export class AttendanceEngine {
  private readonly logRepo: AttendanceLogRepository
  private readonly sessionRepo: AttendanceSessionRepository
  private readonly shiftRepo: ShiftRepository
  private readonly assignRepo: ShiftAssignmentRepository
  private readonly holidayRepo: HolidayCalendarRepository
  private readonly overtimeRepo: OvertimeRepository
  private readonly eventBus: HrEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.logRepo = new AttendanceLogRepository(db, companyId)
    this.sessionRepo = new AttendanceSessionRepository(db, companyId)
    this.shiftRepo = new ShiftRepository(db, companyId)
    this.assignRepo = new ShiftAssignmentRepository(db, companyId)
    this.holidayRepo = new HolidayCalendarRepository(db, companyId)
    this.overtimeRepo = new OvertimeRepository(db, companyId)
    this.eventBus = HrEventBus.getInstance()
  }

  async checkIn(input: CheckInInput): Promise<ServiceResult<{ attendanceLogId: string; sessionId: string }>> {
    const parsed = CheckInSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }

    const today = input.date || new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()

    try {
      const existingLog = await this.logRepo.findByEmployeeDate(input.employee_id, today)
      let log: AttendanceLogEntity

      if (existingLog) {
        log = existingLog
      } else {
        const assignment = await this.assignRepo.findActiveByEmployee(input.employee_id)
        const shift = assignment?.shift || (input.shift_id ? await this.shiftRepo.findById(input.shift_id) : null)

        log = await this.logRepo.create({
          employee_id: input.employee_id, date: today, check_in: now, status: 'present',
          shift_id: shift?.id || null, shift_start: shift?.start_time || null, shift_end: shift?.end_time || null,
        })
      }

      const session = await this.sessionRepo.create({
        employee_id: input.employee_id, attendance_log_id: log.id,
        check_in: now, check_in_method: input.check_in_method || null,
        device_id: input.device_id || null, location: input.location || null,
      })

      this.eventBus.emit('hr.attendance.checked_in', {
        id: session.id, type: 'hr.attendance.checked_in', companyId: this.companyId,
        employeeId: input.employee_id, timestamp: now,
        metadata: { date: today, method: input.check_in_method, deviceId: input.device_id },
      })

      return { ok: true, data: { attendanceLogId: log.id, sessionId: session.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CHECK_IN_FAILED' }
    }
  }

  async checkOut(input: CheckOutInput): Promise<ServiceResult<{ attendanceLogId: string }>> {
    try {
      const session = await this.sessionRepo.updateCheckOut(
        input.session_id, new Date().toISOString(), input.check_out_method, input.location,
      )

      const log = await this.logRepo.findByEmployeeDate(session.employee_id, new Date().toISOString().slice(0, 10))
      if (!log) return { ok: false, error: 'سجل الحضور غير موجود', code: 'NOT_FOUND' }

      const checkIn = new Date(session.check_in)
      const checkOut = new Date(session.check_out!)
      const workingMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)

      await this.logRepo.update(log.id, {
        check_out: session.check_out,
        working_minutes: (log.working_minutes || 0) + workingMinutes,
      })

      this.eventBus.emit('hr.attendance.checked_out', {
        id: session.id, type: 'hr.attendance.checked_out', companyId: this.companyId,
        employeeId: session.employee_id, timestamp: new Date().toISOString(),
        metadata: { durationMinutes: workingMinutes },
      })

      return { ok: true, data: { attendanceLogId: log.id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CHECK_OUT_FAILED' }
    }
  }

  async recordOvertime(input: CreateOvertimeInput): Promise<ServiceResult<any>> {
    try {
      const startTime = new Date(input.start_time)
      const endTime = new Date(input.end_time)
      const totalMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      if (totalMinutes <= 0) return { ok: false, error: 'وقت الانتهاء يجب أن يكون بعد وقت البداية', code: 'INVALID_DURATION' }

      const rateMultiplier = input.rate_multiplier ?? (() => {
        switch (input.overtime_type) {
          case 'weekday': return 1.5
          case 'night': return 1.75
          case 'weekend': return 2.0
          case 'holiday': return 2.5
          default: return 1.5
        }
      })()

      const ot = await this.overtimeRepo.create({
        employee_id: input.employee_id, date: input.date, overtime_type: input.overtime_type,
        start_time: input.start_time, end_time: input.end_time,
        total_minutes: totalMinutes, rate_multiplier: rateMultiplier, amount: 0, notes: input.notes,
      })

      return { ok: true, data: ot }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'OVERTIME_FAILED' }
    }
  }

  async getAttendanceRange(fromDate: string, toDate: string, employeeId?: string): Promise<ServiceResult<AttendanceLogEntity[]>> {
    try {
      const data = await this.logRepo.findRange(this.companyId, fromDate, toDate, employeeId)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async isHoliday(date: string): Promise<{ isHoliday: boolean; isWeekend: boolean; name?: string }> {
    const dayOfWeek = new Date(date).getDay()
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6

    const year = new Date(date).getFullYear()
    const calendar = await this.holidayRepo.findByYear(year)
    const holiday = calendar?.entries?.find((e: any) => e.date === date)

    return { isHoliday: !!holiday || isWeekend, isWeekend, name: holiday?.name }
  }
}
