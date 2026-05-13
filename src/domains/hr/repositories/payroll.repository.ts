import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import type {
  PayrollCycleEntity, PayrollRunEntity, PayrollLineEntity, PayrollSummaryEntity,
  PayrollAdjustmentEntity, PayrollBenefitEntity, LoanEntity, LoanPaymentEntity,
  HrAccountingLinkEntity,
} from '../entities/payroll.entity'

export class PayrollCycleRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findOpen(year: number, month: number): Promise<PayrollCycleEntity | null> {
    const { data, error } = await this.db.from('payroll_cycles').select('*').eq('company_id', this.companyId).eq('year', year).eq('month', month).eq('is_closed', false).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<PayrollCycleEntity>): Promise<PayrollCycleEntity> {
    const { data, error } = await this.db.from('payroll_cycles').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async close(id: string): Promise<void> {
    const { error } = await this.db.from('payroll_cycles').update({ is_closed: true }).eq('id', id).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}

export class PayrollRunRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async create(input: Partial<PayrollRunEntity>): Promise<PayrollRunEntity> {
    const { data, error } = await this.db.from('payroll_runs').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findById(id: string): Promise<PayrollRunEntity | null> {
    const { data, error } = await this.db.from('payroll_runs').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async update(id: string, input: Partial<PayrollRunEntity>): Promise<PayrollRunEntity> {
    const { data, error } = await this.db.from('payroll_runs').update(input).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findByCycle(cycleId: string): Promise<PayrollRunEntity[]> {
    const { data, error } = await this.db.from('payroll_runs').select('*').eq('cycle_id', cycleId).eq('company_id', this.companyId).order('created_at')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class PayrollLineRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByRun(runId: string): Promise<PayrollLineEntity[]> {
    const { data, error } = await this.db.from('payroll_lines').select('*').eq('run_id', runId).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async createBatch(lines: Partial<PayrollLineEntity>[]): Promise<void> {
    const { error } = await this.db.from('payroll_lines').insert(lines.map(l => ({ company_id: this.companyId, ...l })))
    if (error) throw new RepositoryError(error.message, error.code)
  }

  async deleteByRun(runId: string): Promise<void> {
    const { error } = await this.db.from('payroll_lines').delete().eq('run_id', runId).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}

export class PayrollSummaryRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async upsert(input: Partial<PayrollSummaryEntity>): Promise<PayrollSummaryEntity> {
    const { data, error } = await this.db.from('payroll_summaries').upsert({ company_id: this.companyId, ...input }, { onConflict: 'run_id,employee_id' }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findByRun(runId: string): Promise<PayrollSummaryEntity[]> {
    const { data, error } = await this.db.from('payroll_summaries').select('*').eq('run_id', runId).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class PayrollAdjustmentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByEmployee(employeeId: string): Promise<PayrollAdjustmentEntity[]> {
    const { data, error } = await this.db.from('payroll_adjustments').select('*').eq('employee_id', employeeId).eq('company_id', this.companyId)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async create(input: Partial<PayrollAdjustmentEntity>): Promise<PayrollAdjustmentEntity> {
    const { data, error } = await this.db.from('payroll_adjustments').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class PayrollBenefitRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findAll(): Promise<PayrollBenefitEntity[]> {
    const { data, error } = await this.db.from('payroll_benefits').select('*').eq('company_id', this.companyId).eq('is_active', true)
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }
}

export class LoanRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findActiveByEmployee(employeeId: string): Promise<LoanEntity[]> {
    const { data, error } = await this.db.from('employee_loans').select('*').eq('employee_id', employeeId).eq('company_id', this.companyId).eq('status', 'active')
    if (error) throw new RepositoryError(error.message, error.code)
    return data || []
  }

  async create(input: Partial<LoanEntity>): Promise<LoanEntity> {
    const { data, error } = await this.db.from('employee_loans').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async findById(id: string): Promise<LoanEntity | null> {
    const { data, error } = await this.db.from('employee_loans').select('*').eq('id', id).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async update(id: string, input: Partial<LoanEntity>): Promise<LoanEntity> {
    const { data, error } = await this.db.from('employee_loans').update(input).eq('id', id).eq('company_id', this.companyId).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class LoanPaymentRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async create(input: Partial<LoanPaymentEntity>): Promise<LoanPaymentEntity> {
    const { data, error } = await this.db.from('loan_payments').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }
}

export class HrAccountingLinkRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async findByRun(runId: string): Promise<HrAccountingLinkEntity | null> {
    const { data, error } = await this.db.from('payroll_accounting_links').select('*').eq('run_id', runId).eq('company_id', this.companyId).maybeSingle()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async create(input: Partial<HrAccountingLinkEntity>): Promise<HrAccountingLinkEntity> {
    const { data, error } = await this.db.from('payroll_accounting_links').insert({ company_id: this.companyId, ...input }).select().single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await this.db.from('payroll_accounting_links').update({ status }).eq('id', id)
    if (error) throw new RepositoryError(error.message, error.code)
  }
}
