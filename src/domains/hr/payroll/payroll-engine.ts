import type { SupabaseClient } from '@supabase/supabase-js'
import { EmployeeRepository, EmployeeContractRepository } from '../repositories/employee.repository'
import { AttendanceLogRepository, OvertimeRepository } from '../repositories/attendance.repository'
import {
  PayrollCycleRepository, PayrollRunRepository, PayrollLineRepository, PayrollSummaryRepository,
  PayrollAdjustmentRepository, PayrollBenefitRepository, LoanRepository, LoanPaymentRepository,
  HrAccountingLinkRepository,
} from '../repositories/payroll.repository'
import { HrEventBus } from '../events/event-bus'
import type { PayrollRunEntity, PayrollLineEntity, PayrollSummaryEntity, CreatePayrollRunInput } from '../entities/payroll.entity'
import type { ServiceResult } from '../types'

export class PayrollEngine {
  private readonly employeeRepo: EmployeeRepository
  private readonly contractRepo: EmployeeContractRepository
  private readonly cycleRepo: PayrollCycleRepository
  private readonly runRepo: PayrollRunRepository
  private readonly lineRepo: PayrollLineRepository
  private readonly summaryRepo: PayrollSummaryRepository
  private readonly adjRepo: PayrollAdjustmentRepository
  private readonly benefitRepo: PayrollBenefitRepository
  private readonly loanRepo: LoanRepository
  private readonly loanPaymentRepo: LoanPaymentRepository
  private readonly attLogRepo: AttendanceLogRepository
  private readonly overtimeRepo: OvertimeRepository
  private readonly acctLinkRepo: HrAccountingLinkRepository
  private readonly eventBus: HrEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.employeeRepo = new EmployeeRepository(db, companyId)
    this.contractRepo = new EmployeeContractRepository(db, companyId)
    this.cycleRepo = new PayrollCycleRepository(db, companyId)
    this.runRepo = new PayrollRunRepository(db, companyId)
    this.lineRepo = new PayrollLineRepository(db, companyId)
    this.summaryRepo = new PayrollSummaryRepository(db, companyId)
    this.adjRepo = new PayrollAdjustmentRepository(db, companyId)
    this.benefitRepo = new PayrollBenefitRepository(db, companyId)
    this.loanRepo = new LoanRepository(db, companyId)
    this.loanPaymentRepo = new LoanPaymentRepository(db, companyId)
    this.attLogRepo = new AttendanceLogRepository(db, companyId)
    this.overtimeRepo = new OvertimeRepository(db, companyId)
    this.acctLinkRepo = new HrAccountingLinkRepository(db, companyId)
    this.eventBus = HrEventBus.getInstance()
  }

  async createRun(input: CreatePayrollRunInput): Promise<ServiceResult<PayrollRunEntity>> {
    const cycle = await this.cycleRepo.findOpen(new Date().getFullYear(), new Date().getMonth() + 1)
    if (!cycle) return { ok: false, error: 'لا توجد دورة رواتب مفتوحة للشهر الحالي', code: 'NO_OPEN_CYCLE' }

    try {
      const run = await this.runRepo.create({
        cycle_id: input.cycle_id || cycle.id, name: `Payroll ${cycle.name}`,
        status: 'draft', branch_id: input.branch_id || null,
        notes: input.notes || null,
      })

      this.eventBus.emit('hr.payroll.processing', {
        id: run.id, type: 'hr.payroll.processing', companyId: this.companyId,
        timestamp: new Date().toISOString(),
        metadata: { cycleName: cycle.name, branchId: input.branch_id },
      })

      return { ok: true, data: run }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RUN_CREATE_FAILED' }
    }
  }

  async processRun(runId: string, processedBy?: string): Promise<ServiceResult<PayrollRunEntity>> {
    const run = await this.runRepo.findById(runId)
    if (!run) return { ok: false, error: 'شغيلة الرواتب غير موجودة', code: 'NOT_FOUND' }
    if (run.status !== 'draft') return { ok: false, error: 'يمكن معالجة المسودات فقط', code: 'INVALID_STATUS' }

    try {
      await this.runRepo.update(runId, { status: 'processing' })

      const employees = await this.employeeRepo.findPaged({ status: 'active', limit: 5000 })
      let totalEarnings = 0; let totalDeductions = 0; let totalEmployerContribs = 0; let netPay = 0

      const lineRepo = this.lineRepo
      await lineRepo.deleteByRun(runId)

      for (const emp of employees.data) {
        const summary = await this.calculateEmployeePayroll(run, emp.id)

        await this.summaryRepo.upsert({ run_id: runId, employee_id: emp.id, ...summary })

        if (summary.basic_salary > 0) {
          await lineRepo.createBatch([
            { run_id: runId, employee_id: emp.id, line_type: 'earning', category: 'salary', name: 'الراتب الأساسي', amount: summary.basic_salary, is_taxable: true, branch_id: emp.branch_id, cost_center_id: null },
            ...(summary.housing_allowance > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'earning', category: 'allowance', name: 'بدل سكن', amount: summary.housing_allowance, is_taxable: true, branch_id: emp.branch_id } as any] : []),
            ...(summary.transportation_allowance > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'earning', category: 'allowance', name: 'بدل نقل', amount: summary.transportation_allowance, is_taxable: true, branch_id: emp.branch_id } as any] : []),
            ...(summary.overtime_amount > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'earning', category: 'overtime', name: 'ساعات إضافية', amount: summary.overtime_amount, is_taxable: true, branch_id: emp.branch_id } as any] : []),
            ...(summary.bonuses > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'earning', category: 'bonus', name: 'مكافآت', amount: summary.bonuses, is_taxable: true, branch_id: emp.branch_id } as any] : []),
            ...(summary.loan_deduction > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'deduction', category: 'loan', name: 'قرض', amount: -summary.loan_deduction, is_taxable: false, branch_id: emp.branch_id } as any] : []),
            ...(summary.tax_deduction > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'deduction', category: 'tax', name: 'ضريبة', amount: -summary.tax_deduction, is_taxable: false, branch_id: emp.branch_id } as any] : []),
            ...(summary.social_insurance > 0 ? [{ run_id: runId, employee_id: emp.id, line_type: 'deduction', category: 'insurance', name: 'تأمينات اجتماعية', amount: -summary.social_insurance, is_taxable: false, branch_id: emp.branch_id } as any] : []),
          ])
        }

        totalEarnings += summary.gross_pay
        totalDeductions += summary.total_deductions
        totalEmployerContribs += summary.employer_contributions
        netPay += summary.net_pay
      }

      const updated = await this.runRepo.update(runId, {
        status: 'completed', total_earnings: totalEarnings, total_deductions: totalDeductions,
        total_employer_contributions: totalEmployerContribs, net_pay: netPay,
        employee_count: employees.data.length, processed_by: processedBy, processed_at: new Date().toISOString(),
      })

      this.eventBus.emit('hr.payroll.completed', {
        id: runId, type: 'hr.payroll.completed', companyId: this.companyId,
        timestamp: new Date().toISOString(), performedBy: processedBy,
        metadata: { totalEarnings, totalDeductions, netPay, employeeCount: employees.data.length },
      })

      return { ok: true, data: updated }
    } catch (e: any) {
      await this.runRepo.update(runId, { status: 'draft' })
      return { ok: false, error: e.message, code: 'PROCESS_FAILED' }
    }
  }

  private async calculateEmployeePayroll(run: PayrollRunEntity, employeeId: string): Promise<Partial<PayrollSummaryEntity>> {
    const contract = await this.contractRepo.findActiveByEmployee(employeeId)
    if (!contract) return { employee_id: employeeId, gross_pay: 0, total_deductions: 0, net_pay: 0, employer_contributions: 0 }

    const basicSalary = Number(contract.basic_salary) || 0
    const housingAllowance = Number(contract.housing_allowance) || 0
    const transportAllowance = Number(contract.transportation_allowance) || 0
    const commAllowance = Number(contract.communication_allowance) || 0
    const colAllowance = Number(contract.cost_of_living_allowance) || 0
    const otherAllowances = Number(contract.other_allowances) || 0

    const attendanceLogs = await this.attLogRepo.findRange(this.companyId, run.cycle.period_start, run.cycle.period_end, employeeId)
    const absentDays = attendanceLogs.filter(l => l.status === 'absent').length
    const totalWorkingDays = 30
    const dailyRate = totalWorkingDays > 0 ? basicSalary / totalWorkingDays : 0
    const absentDeduction = absentDays * dailyRate

    const overtimeEntries = await this.overtimeRepo.findByEmployeeDate(employeeId, '')
    const overtimeAmount = overtimeEntries.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.amount), 0)

    const adjustments = await this.adjRepo.findByEmployee(employeeId)
    const bonuses = adjustments.filter(a => a.adjustment_type === 'earning' && !a.run_id).reduce((s, a) => s + Number(a.amount), 0)
    const otherDeductions = adjustments.filter(a => a.adjustment_type === 'deduction' && !a.run_id).reduce((s, a) => s + Number(a.amount), 0)

    const activeLoans = await this.loanRepo.findActiveByEmployee(employeeId)
    const loanDeduction = activeLoans.reduce((s, l) => s + Number(l.installment_amount), 0)

    const grossPay = basicSalary + housingAllowance + transportAllowance + commAllowance + colAllowance + otherAllowances + overtimeAmount + bonuses

    const socialInsuranceRate = 0.09
    const socialInsurance = grossPay * socialInsuranceRate * 0.5
    const taxDeduction = 0
    const totalDeductions = absentDeduction + loanDeduction + taxDeduction + socialInsurance + otherDeductions

    const employerSocialInsurance = grossPay * socialInsuranceRate * 0.5
    const employerContributions = employerSocialInsurance

    const netPay = Math.max(0, grossPay - totalDeductions)

    for (const loan of activeLoans) {
      if (loan.remaining_amount > 0) {
        const paidInstallment = loan.paid_installments + 1
        const remaining = loan.remaining_amount - loan.installment_amount
        await this.loanRepo.update(loan.id, { paid_installments: paidInstallment, remaining_amount: Math.max(0, remaining), status: remaining <= 0 ? 'settled' : 'active' })
        await this.loanPaymentRepo.create({ loan_id: loan.id, employee_id: employeeId, payroll_run_id: run.id, installment_number: paidInstallment, amount: loan.installment_amount })
      }
    }

    return {
      employee_id: employeeId, basic_salary: basicSalary, housing_allowance: housingAllowance,
      transportation_allowance: transportAllowance, communication_allowance: commAllowance,
      cost_of_living_allowance: colAllowance, other_allowances: otherAllowances,
      overtime_amount: overtimeAmount, bonuses, gross_pay: grossPay,
      loan_deduction: loanDeduction, tax_deduction: taxDeduction, social_insurance: socialInsurance,
      medical_insurance: 0, other_deductions: otherDeductions, total_deductions: totalDeductions,
      net_pay: netPay, employer_contributions: employerContributions,
    }
  }

  async lockRun(runId: string, lockedBy: string): Promise<ServiceResult<PayrollRunEntity>> {
    const run = await this.runRepo.findById(runId)
    if (!run) return { ok: false, error: 'شغيلة الرواتب غير موجودة', code: 'NOT_FOUND' }
    if (run.status !== 'completed') return { ok: false, error: 'يمكن قفل الشغائل المكتملة فقط', code: 'INVALID_STATUS' }

    try {
      const updated = await this.runRepo.update(runId, { status: 'locked', locked_by: lockedBy, locked_at: new Date().toISOString() })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LOCK_FAILED' }
    }
  }

  async reverseRun(runId: string, reason: string, reversedBy?: string): Promise<ServiceResult<PayrollRunEntity>> {
    const run = await this.runRepo.findById(runId)
    if (!run) return { ok: false, error: 'شغيلة الرواتب غير موجودة', code: 'NOT_FOUND' }
    if (run.status !== 'locked') return { ok: false, error: 'يمكن عكس الشغائل المقفلة فقط', code: 'INVALID_STATUS' }

    try {
      const reversal = await this.runRepo.create({
        cycle_id: run.cycle_id, name: `عكس: ${run.name}`, status: 'completed',
        branch_id: run.branch_id, is_correction: true, corrected_run_id: runId,
        total_earnings: -run.total_earnings, total_deductions: -run.total_deductions,
        total_employer_contributions: -run.total_employer_contributions, net_pay: -run.net_pay,
        employee_count: run.employee_count, notes: `عكس: ${reason}`,
      })

      const lines = await this.lineRepo.findByRun(runId)
      await this.lineRepo.createBatch(lines.map(l => ({ ...l, run_id: reversal.id, amount: -l.amount, id: undefined })))

      await this.runRepo.update(runId, { status: 'reversed', reversal_run_id: reversal.id })

      if (run.posted_to_gl && run.gl_journal_entry_id) {
        await this.postToAccounting(run, true)
      }

      this.eventBus.emit('hr.payroll.reversed', {
        id: reversal.id, type: 'hr.payroll.reversed', companyId: this.companyId,
        timestamp: new Date().toISOString(), performedBy: reversedBy,
        metadata: { originalRunId: runId, reason },
      })

      return { ok: true, data: reversal }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSE_FAILED' }
    }
  }

  async postToAccounting(run: PayrollRunEntity, isReversal = false): Promise<ServiceResult<{ journalEntryId: string }>> {
    try {
      const mapping = {
        salaryExpenseCode: '5001', salaryPayableCode: '2101',
        taxPayableCode: '2102', socialInsuranceCode: '2103',
        loanReceivableCode: '1201', employerExpenseCode: '5002',
      }

      const refId = run.id
      const journalLines: any[] = [
        { account_code: mapping.salaryExpenseCode, debit: run.total_earnings, credit: 0, description: 'مصروف رواتب' },
        { account_code: mapping.salaryPayableCode, debit: 0, credit: run.net_pay, description: 'صافي رواتب مستحقة' },
      ]

      if (run.total_deductions > 0) {
        journalLines.push({ account_code: mapping.salaryPayableCode, debit: run.total_deductions, credit: 0, description: 'خصومات رواتب' })
      }

      const totalPayable = run.net_pay - run.total_deductions
      if (totalPayable > 0) {
        journalLines.push({ account_code: mapping.salaryPayableCode, debit: 0, credit: totalPayable, description: 'صافي مستحق الدفع' })
      }

      if (run.total_employer_contributions > 0) {
        journalLines.push({ account_code: mapping.employerExpenseCode, debit: run.total_employer_contributions, credit: 0, description: 'مصروف مساهمات صاحب العمل' })
      }

      const totalDebit = journalLines.filter((l: any) => l.debit > 0).reduce((s: number, l: any) => s + l.debit, 0)
      const totalCredit = journalLines.filter((l: any) => l.credit > 0).reduce((s: number, l: any) => s + l.credit, 0)

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        journalLines.push({
          account_code: run.net_pay >= 0 ? mapping.salaryPayableCode : mapping.salaryExpenseCode,
          debit: totalDebit < totalCredit ? totalCredit - totalDebit : 0,
          credit: totalDebit > totalCredit ? totalDebit - totalCredit : 0,
          description: 'تسوية قيد الرواتب',
        })
      }

      return { ok: true, data: { journalEntryId: `payroll-${refId}` } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'POST_TO_GL_FAILED' }
    }
  }

  async getRun(runId: string): Promise<ServiceResult<PayrollRunEntity>> {
    const run = await this.runRepo.findById(runId)
    if (!run) return { ok: false, error: 'شغيلة الرواتب غير موجودة', code: 'NOT_FOUND' }
    return { ok: true, data: run }
  }
}
