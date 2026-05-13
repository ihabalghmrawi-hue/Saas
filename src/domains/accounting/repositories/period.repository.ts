import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository, RepositoryError } from '@/repositories/base.repository'
import type { FiscalYearEntity, AccountingPeriodEntity } from '../entities/period.entity'

export class PeriodRepository extends BaseRepository<FiscalYearEntity> {
  protected readonly table = 'fiscal_years'
  protected hasSoftDelete = false

  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId)
  }

  async findCurrentYear(): Promise<FiscalYearEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_current', true)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as FiscalYearEntity | null
  }

  async findYearByDate(date: string): Promise<FiscalYearEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as FiscalYearEntity | null
  }

  async findAllYears(): Promise<FiscalYearEntity[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('company_id', this.companyId)
      .order('start_date', { ascending: false })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as FiscalYearEntity[]
  }

  async findYearWithPeriods(yearId: string): Promise<FiscalYearEntity | null> {
    const { data, error } = await this.db
      .from(this.table)
      .select(`
        *,
        accounting_periods (*)
      `)
      .eq('company_id', this.companyId)
      .eq('id', yearId)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as FiscalYearEntity
  }

  async findPeriodById(periodId: string): Promise<AccountingPeriodEntity | null> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .select('*')
      .eq('id', periodId)
      .eq('company_id', this.companyId)
      .single()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as AccountingPeriodEntity
  }

  async findPeriodByDate(date: string): Promise<AccountingPeriodEntity | null> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', this.companyId)
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as AccountingPeriodEntity | null
  }

  async findOpenPeriodByDate(date: string): Promise<AccountingPeriodEntity | null> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('status', 'open')
      .lte('start_date', date)
      .gte('end_date', date)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as AccountingPeriodEntity | null
  }

  async findPeriodsByYear(yearId: string): Promise<AccountingPeriodEntity[]> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('fiscal_year_id', yearId)
      .order('period_number', { ascending: true })
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? []) as unknown as AccountingPeriodEntity[]
  }

  async createFiscalYear(input: Record<string, unknown>): Promise<FiscalYearEntity> {
    return this.create(input)
  }

  async createPeriod(input: Record<string, unknown>): Promise<AccountingPeriodEntity> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .insert({ ...input, company_id: this.companyId })
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as AccountingPeriodEntity
  }

  async updatePeriodStatus(periodId: string, status: string, extra?: Record<string, unknown>): Promise<AccountingPeriodEntity> {
    const payload = { status, ...extra }
    const { data, error } = await this.db
      .from('accounting_periods')
      .update(payload)
      .eq('id', periodId)
      .eq('company_id', this.companyId)
      .select()
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as unknown as AccountingPeriodEntity
  }

  async updateFiscalYearStatus(yearId: string, status: string, extra?: Record<string, unknown>): Promise<FiscalYearEntity> {
    const payload = { status, ...extra }
    return this.update(yearId, payload)
  }

  async setCurrentYear(yearId: string): Promise<void> {
    await this.db
      .from(this.table)
      .update({ is_current: false })
      .eq('company_id', this.companyId)
      .eq('is_current', true)
    await this.update(yearId, { is_current: true })
  }

  async getEarliestOpenPeriod(): Promise<AccountingPeriodEntity | null> {
    const { data, error } = await this.db
      .from('accounting_periods')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('status', 'open')
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error?.code === 'PGRST116') return null
    if (error) throw new RepositoryError(error.message, error.code)
    return (data ?? null) as unknown as AccountingPeriodEntity | null
  }
}
