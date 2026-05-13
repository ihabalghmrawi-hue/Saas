export { HrDomain } from './domain'

export type {
  ServiceResult, EmploymentStatus, ContractType, Gender, MaritalStatus,
  ShiftType, AttendanceStatus, OvertimeType, LeaveType,
  PayrollCycleType, PayrollRunStatus, PayrollLineType, LoanStatus,
  HrDomainEvent,
} from './types'

export type {
  EmployeeEntity, EmployeeContractEntity, EmployeeDocumentEntity,
  DepartmentEntity, PositionEntity, EmployeeListItem,
  CreateEmployeeInput, UpdateEmployeeInput, CreateContractInput,
} from './entities/employee.entity'

export type {
  ShiftEntity, ShiftAssignmentEntity, AttendanceLogEntity,
  AttendanceSessionEntity, HolidayCalendarEntity, OvertimeEntryEntity,
  CreateShiftInput, CheckInInput, CheckOutInput, CreateOvertimeInput,
} from './entities/attendance.entity'

export type {
  LeaveTypeEntity, LeaveRequestEntity, LeaveBalanceEntity,
  CreateLeaveTypeInput, CreateLeaveRequestInput,
} from './entities/leave.entity'

export type {
  PayrollCycleEntity, PayrollRunEntity, PayrollLineEntity,
  PayrollSummaryEntity, PayrollAdjustmentEntity, PayrollBenefitEntity,
  LoanEntity, LoanPaymentEntity, HrAccountingLinkEntity,
  CreatePayrollRunInput, CreateLoanInput, CreatePayrollAdjustmentInput,
} from './entities/payroll.entity'

export {
  EmployeeLifecycleEngine,
} from './employees/employee-engine'

export {
  AttendanceEngine,
} from './attendance/attendance-engine'

export {
  LeaveEngine,
} from './leaves/leave-engine'

export {
  PayrollEngine,
} from './payroll/payroll-engine'

export {
  ShiftEngine,
} from './shifts/shift-engine'

export {
  HrApprovalEngine,
} from './approvals/approval-engine'

export {
  HrAccountingService,
} from './services/hr-accounting.service'

export {
  HrIntegrityService,
} from './services/integrity.service'

export {
  HrReportGenerator,
} from './reports/report-generator'

export {
  HrAIService,
} from './ai/hr-ai.service'

export { HrEventBus } from './events/event-bus'

export {
  PayrollWorker, LeaveWorker, AttendanceWorker,
  IntegrityWorker, WorkforceAnalyticsWorker,
} from './workers'

export {
  EmployeeRepository, EmployeeContractRepository, EmployeeDocumentRepository,
  DepartmentRepository, PositionRepository,
} from './repositories/employee.repository'

export {
  ShiftRepository, ShiftAssignmentRepository,
  AttendanceLogRepository, AttendanceSessionRepository,
  OvertimeRepository,
} from './repositories/attendance.repository'

export {
  LeaveTypeRepository, LeaveRequestRepository, LeaveBalanceRepository,
} from './repositories/leave.repository'

export {
  PayrollCycleRepository, PayrollRunRepository, PayrollLineRepository,
  PayrollSummaryRepository, PayrollAdjustmentRepository, PayrollBenefitRepository,
  LoanRepository, LoanPaymentRepository, HrAccountingLinkRepository,
} from './repositories/payroll.repository'

export {
  CreateEmployeeSchema, CreateContractSchema, CreateShiftSchema,
  CheckInSchema, CreateLeaveTypeSchema, CreateLeaveRequestSchema,
  CreatePayrollRunSchema, CreateLoanSchema, CreateOvertimeSchema,
  CreatePayrollAdjustmentSchema,
} from './validators'

export { useEmployees, useAttendance, useLeaveBalances, usePayrollRuns } from './hooks'
