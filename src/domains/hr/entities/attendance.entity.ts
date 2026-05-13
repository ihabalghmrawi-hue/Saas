import type { ShiftType, AttendanceStatus, OvertimeType } from '../types'

export interface ShiftEntity {
  id: string
  company_id: string
  name: string
  name_ar: string
  shift_type: ShiftType
  start_time: string
  end_time: string
  late_grace_minutes: number
  early_leave_grace_minutes: number
  break_start: string | null
  break_end: string | null
  break_duration_minutes: number
  working_hours: number
  is_night_shift: boolean
  applies_on_friday: boolean
  applies_on_saturday: boolean
  applies_on_sunday: boolean
  applies_on_monday: boolean
  applies_on_tuesday: boolean
  applies_on_wednesday: boolean
  applies_on_thursday: boolean
  is_active: boolean
  created_at: string
}

export interface ShiftAssignmentEntity {
  id: string
  company_id: string
  employee_id: string
  shift_id: string
  effective_from: string
  effective_to: string | null
  is_active: boolean
  created_at: string
  shift?: ShiftEntity
}

export interface HolidayCalendarEntity {
  id: string
  company_id: string
  name: string
  name_ar: string
  year: number
  entries: HolidayEntry[]
  created_at: string
}

export interface HolidayEntry {
  date: string
  name: string
  name_ar: string
  is_paid: boolean
}

export interface AttendanceLogEntity {
  id: string
  company_id: string
  employee_id: string
  date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  shift_id: string | null
  shift_start: string | null
  shift_end: string | null
  late_minutes: number
  early_leave_minutes: number
  working_minutes: number
  overtime_minutes: number
  break_minutes: number
  source: string | null
  verified_by: string | null
  created_at: string
}

export interface AttendanceSessionEntity {
  id: string
  company_id: string
  employee_id: string
  attendance_log_id: string
  check_in: string
  check_out: string | null
  check_in_method: string | null
  check_out_method: string | null
  duration_minutes: number | null
  device_id: string | null
  location: Record<string, unknown> | null
  created_at: string
}

export interface OvertimeEntryEntity {
  id: string
  company_id: string
  employee_id: string
  date: string
  overtime_type: OvertimeType
  start_time: string
  end_time: string
  total_minutes: number
  rate_multiplier: number
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
}

export interface CreateShiftInput {
  name: string
  name_ar: string
  shift_type: ShiftType
  start_time: string
  end_time: string
  late_grace_minutes?: number
  early_leave_grace_minutes?: number
  break_start?: string
  break_end?: string
  break_duration_minutes?: number
  is_night_shift?: boolean
  applies_on_friday?: boolean
  applies_on_saturday?: boolean
  applies_on_sunday?: boolean
  applies_on_monday?: boolean
  applies_on_tuesday?: boolean
  applies_on_wednesday?: boolean
  applies_on_thursday?: boolean
}

export interface CreateOvertimeInput {
  employee_id: string
  date: string
  overtime_type: OvertimeType
  start_time: string
  end_time: string
  rate_multiplier?: number
  notes?: string
}

export interface CheckInInput {
  employee_id: string
  shift_id?: string
  check_in_method?: string
  device_id?: string
  location?: Record<string, unknown>
  date?: string
}

export interface CheckOutInput {
  session_id: string
  check_out_method?: string
  location?: Record<string, unknown>
}
