import { z } from 'zod'

export const CreateEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200),
  full_name_ar: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  gender: z.enum(['male', 'female']),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  id_number: z.string().max(50).optional().nullable(),
  passport_number: z.string().max(50).optional().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  department_id: z.string().uuid().optional().nullable(),
  position_id: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  cost_center_id: z.string().uuid().optional().nullable(),
  reports_to: z.string().uuid().optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  level: z.number().int().min(1).max(99).optional().nullable(),
})

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  status: z.enum(['active', 'suspended', 'terminated', 'resigned', 'retired', 'on_leave']).optional(),
})

export const CreateContractSchema = z.object({
  employee_id: z.string().uuid(),
  contract_type: z.enum(['permanent', 'fixed_term', 'probation', 'trainee', 'outsourced']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  probation_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  basic_salary: z.number().min(0),
  housing_allowance: z.number().min(0).optional().default(0),
  transportation_allowance: z.number().min(0).optional().default(0),
  communication_allowance: z.number().min(0).optional().default(0),
  cost_of_living_allowance: z.number().min(0).optional().default(0),
  other_allowances: z.number().min(0).optional().default(0),
  bank_name: z.string().max(200).optional().nullable(),
  bank_account: z.string().max(50).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
}).refine(d => !d.end_date || d.end_date > d.start_date, {
  message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية',
})

export const CreateShiftSchema = z.object({
  name: z.string().min(1).max(100),
  name_ar: z.string().min(1).max(100),
  shift_type: z.enum(['fixed', 'rotating', 'flexible', 'split']),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  late_grace_minutes: z.number().int().min(0).optional().default(15),
  early_leave_grace_minutes: z.number().int().min(0).optional().default(15),
  break_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  break_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  break_duration_minutes: z.number().int().min(0).optional().default(0),
  is_night_shift: z.boolean().optional().default(false),
}).refine(d => d.end_time > d.start_time || d.is_night_shift, {
  message: 'وقت النهاية يجب أن يكون بعد وقت البداية',
})

export const CheckInSchema = z.object({
  employee_id: z.string().uuid(),
  shift_id: z.string().uuid().optional().nullable(),
  check_in_method: z.string().max(50).optional().nullable(),
  device_id: z.string().max(100).optional().nullable(),
  location: z.record(z.unknown()).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const CreateLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100),
  name_ar: z.string().min(1).max(100),
  leave_type: z.enum(['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'hajj', 'emergency', 'compassionate', 'study', 'sabbatical']),
  days_per_year: z.number().int().min(0),
  is_paid: z.boolean().optional().default(true),
  is_carry_forward: z.boolean().optional().default(false),
  carry_forward_limit: z.number().int().min(0).optional().default(0),
  requires_approval: z.boolean().optional().default(true),
  min_days: z.number().int().min(0).optional().default(1),
  max_days_per_request: z.number().int().min(1).optional().default(30),
  allow_half_day: z.boolean().optional().default(false),
  requires_document: z.boolean().optional().default(false),
})

export const CreateLeaveRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_half_day: z.boolean().optional().default(false),
  reason: z.string().max(500).optional().nullable(),
  attachment_url: z.string().max(500).optional().nullable(),
}).refine(d => d.end_date >= d.start_date, {
  message: 'تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية',
})

export const CreatePayrollRunSchema = z.object({
  cycle_id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  employee_ids: z.array(z.string().uuid()).optional(),
  notes: z.string().max(500).optional().nullable(),
})

export const CreateLoanSchema = z.object({
  employee_id: z.string().uuid(),
  total_amount: z.number().min(1),
  installment_amount: z.number().min(1),
  total_installments: z.number().int().min(1),
  purpose: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

export const CreateOvertimeSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overtime_type: z.enum(['weekday', 'weekend', 'holiday', 'night']),
  start_time: z.string(),
  end_time: z.string(),
  rate_multiplier: z.number().positive().optional().default(1.5),
  notes: z.string().max(500).optional().nullable(),
})

export const CreatePayrollAdjustmentSchema = z.object({
  employee_id: z.string().uuid(),
  adjustment_type: z.enum(['earning', 'deduction']),
  category: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  amount: z.number(),
  is_recurring: z.boolean().optional().default(false),
  recurring_months: z.number().int().min(1).max(60).optional().nullable(),
  is_taxable: z.boolean().optional().default(true),
  gl_account_code: z.string().max(20).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})
