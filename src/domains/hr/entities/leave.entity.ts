import type { LeaveType, LeaveStatus } from '../types'

export interface LeaveTypeEntity {
  id: string
  company_id: string
  name: string
  name_ar: string
  leave_type: LeaveType
  days_per_year: number
  is_paid: boolean
  is_carry_forward: boolean
  carry_forward_limit: number
  requires_approval: boolean
  min_days: number
  max_days_per_request: number
  allow_half_day: boolean
  requires_document: boolean
  is_active: boolean
  created_at: string
}

export interface LeaveRequestEntity {
  id: string
  company_id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  total_days: number
  is_half_day: boolean
  status: LeaveStatus
  reason: string | null
  attachment_url: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  encashed: boolean
  encashment_amount: number | null
  created_at: string
}

export interface LeaveBalanceEntity {
  id: string
  company_id: string
  employee_id: string
  leave_type_id: string
  year: number
  entitled_days: number
  taken_days: number
  pending_days: number
  remaining_days: number
  carried_over: number
  encashed_days: number
  created_at: string
  updated_at: string
}

export interface CreateLeaveTypeInput {
  name: string
  name_ar: string
  leave_type: LeaveType
  days_per_year: number
  is_paid?: boolean
  is_carry_forward?: boolean
  carry_forward_limit?: number
  requires_approval?: boolean
  min_days?: number
  max_days_per_request?: number
  allow_half_day?: boolean
  requires_document?: boolean
}

export interface CreateLeaveRequestInput {
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  is_half_day?: boolean
  reason?: string
  attachment_url?: string
}

export interface AccrueLeaveInput {
  employee_id: string
  leave_type_id: string
  year: number
  days: number
}
