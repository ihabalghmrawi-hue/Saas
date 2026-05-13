export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export type EmploymentStatus = 'active' | 'suspended' | 'terminated' | 'resigned' | 'retired' | 'on_leave'
export type ContractType = 'permanent' | 'fixed_term' | 'probation' | 'trainee' | 'outsourced'
export type Gender = 'male' | 'female'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
export type ShiftType = 'fixed' | 'rotating' | 'flexible' | 'split'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_leave' | 'half_day' | 'holiday' | 'weekend'
export type OvertimeType = 'weekday' | 'weekend' | 'holiday' | 'night'
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'hajj' | 'emergency' | 'compassionate' | 'study' | 'sabbatical'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type PayrollCycleType = 'monthly' | 'semi_monthly' | 'weekly' | 'bi_weekly'
export type PayrollRunStatus = 'draft' | 'processing' | 'completed' | 'locked' | 'reversed'
export type PayrollLineType = 'earning' | 'deduction' | 'employer_contribution'
export type LoanStatus = 'active' | 'settled' | 'defaulted' | 'cancelled'
export type PayrollEventType =
  | 'hr.employee.hired' | 'hr.employee.transferred' | 'hr.employee.promoted'
  | 'hr.employee.suspended' | 'hr.employee.terminated' | 'hr.employee.rehired'
  | 'hr.attendance.checked_in' | 'hr.attendance.checked_out'
  | 'hr.leave.requested' | 'hr.leave.approved' | 'hr.leave.rejected' | 'hr.leave.cancelled'
  | 'hr.payroll.processing' | 'hr.payroll.completed' | 'hr.payroll.posted' | 'hr.payroll.reversed'
  | 'hr.loan.granted' | 'hr.loan.settled'

export interface HrDomainEvent {
  id: string
  type: PayrollEventType | string
  companyId: string
  employeeId?: string
  branchId?: string
  costCenterId?: string
  timestamp: string
  metadata?: Record<string, unknown>
  performedBy?: string
}
