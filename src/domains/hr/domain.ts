import type { SupabaseClient } from '@supabase/supabase-js'
import { EmployeeLifecycleEngine } from './employees/employee-engine'
import { AttendanceEngine } from './attendance/attendance-engine'
import { LeaveEngine } from './leaves/leave-engine'
import { PayrollEngine } from './payroll/payroll-engine'
import { ShiftEngine } from './shifts/shift-engine'
import { HrApprovalEngine } from './approvals/approval-engine'
import { HrAccountingService } from './services/hr-accounting.service'
import { HrIntegrityService } from './services/integrity.service'
import { HrReportGenerator } from './reports/report-generator'
import { HrAIService } from './ai/hr-ai.service'
import { HrEventBus } from './events/event-bus'
import { PayrollWorker, LeaveWorker, AttendanceWorker, IntegrityWorker, WorkforceAnalyticsWorker } from './workers'
import { EmployeeRepository, EmployeeContractRepository, EmployeeDocumentRepository, DepartmentRepository, PositionRepository } from './repositories/employee.repository'
import { ShiftRepository, ShiftAssignmentRepository, AttendanceLogRepository, AttendanceSessionRepository, OvertimeRepository } from './repositories/attendance.repository'
import { LeaveTypeRepository, LeaveRequestRepository, LeaveBalanceRepository } from './repositories/leave.repository'
import { PayrollCycleRepository, PayrollRunRepository, PayrollLineRepository, PayrollSummaryRepository, PayrollAdjustmentRepository, PayrollBenefitRepository, LoanRepository, LoanPaymentRepository, HrAccountingLinkRepository } from './repositories/payroll.repository'

export class HrDomain {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  get engines() {
    return {
      employee: new EmployeeLifecycleEngine(this.db, this.companyId),
      attendance: new AttendanceEngine(this.db, this.companyId),
      leave: new LeaveEngine(this.db, this.companyId),
      payroll: new PayrollEngine(this.db, this.companyId),
      shift: new ShiftEngine(this.db, this.companyId),
      approval: new HrApprovalEngine(this.db, this.companyId),
    }
  }

  get repositories() {
    return {
      employee: new EmployeeRepository(this.db, this.companyId),
      contract: new EmployeeContractRepository(this.db, this.companyId),
      document: new EmployeeDocumentRepository(this.db, this.companyId),
      department: new DepartmentRepository(this.db, this.companyId),
      position: new PositionRepository(this.db, this.companyId),
      shift: new ShiftRepository(this.db, this.companyId),
      shiftAssignment: new ShiftAssignmentRepository(this.db, this.companyId),
      attendanceLog: new AttendanceLogRepository(this.db, this.companyId),
      attendanceSession: new AttendanceSessionRepository(this.db, this.companyId),
      overtime: new OvertimeRepository(this.db, this.companyId),
      leaveType: new LeaveTypeRepository(this.db, this.companyId),
      leaveRequest: new LeaveRequestRepository(this.db, this.companyId),
      leaveBalance: new LeaveBalanceRepository(this.db, this.companyId),
      payrollCycle: new PayrollCycleRepository(this.db, this.companyId),
      payrollRun: new PayrollRunRepository(this.db, this.companyId),
      payrollLine: new PayrollLineRepository(this.db, this.companyId),
      payrollSummary: new PayrollSummaryRepository(this.db, this.companyId),
      payrollAdjustment: new PayrollAdjustmentRepository(this.db, this.companyId),
      payrollBenefit: new PayrollBenefitRepository(this.db, this.companyId),
      loan: new LoanRepository(this.db, this.companyId),
      loanPayment: new LoanPaymentRepository(this.db, this.companyId),
      acctLink: new HrAccountingLinkRepository(this.db, this.companyId),
    }
  }

  get services() {
    return {
      accounting: new HrAccountingService(this.db, this.companyId),
      integrity: new HrIntegrityService(this.db, this.companyId),
    }
  }

  get reports() {
    return {
      generator: new HrReportGenerator(this.db, this.companyId),
    }
  }

  get ai() {
    return {
      hr: new HrAIService(this.db, this.companyId),
    }
  }

  get workers() {
    return {
      payroll: new PayrollWorker(this.db, this.companyId),
      leave: new LeaveWorker(this.db, this.companyId),
      attendance: new AttendanceWorker(this.db, this.companyId),
      integrity: new IntegrityWorker(this.db, this.companyId),
      analytics: new WorkforceAnalyticsWorker(this.db, this.companyId),
    }
  }

  get eventBus() {
    return HrEventBus.getInstance()
  }
}
