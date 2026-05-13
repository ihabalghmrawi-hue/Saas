import type { SupabaseClient } from '@supabase/supabase-js'
import { PeriodRepository } from '../repositories/period.repository'
import { JournalRepository } from '../repositories/journal.repository'
import { CreateFiscalYearSchema, CreatePeriodSchema, PeriodActionSchema } from '../validators/period.schema'
import type { FiscalYearEntity, AccountingPeriodEntity, PeriodClosingResult, CreateFiscalYearInput, CreatePeriodInput } from '../entities/period.entity'
import type { ServiceResult } from '../types'

export class PeriodService {
  private readonly repo: PeriodRepository
  private readonly journalRepo: JournalRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new PeriodRepository(db, companyId)
    this.journalRepo = new JournalRepository(db, companyId)
  }

  async createFiscalYear(input: CreateFiscalYearInput): Promise<ServiceResult<FiscalYearEntity>> {
    const parsed = CreateFiscalYearSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors.map(e => e.message).join('; '), code: 'VALIDATION_ERROR' }
    }

    const existing = await this.repo.findYearByDate(parsed.data.start_date)
    if (existing) {
      return { ok: false, error: 'توجد سنة مالية بالفعل لهذه الفترة', code: 'YEAR_EXISTS' }
    }

    try {
      const year = await this.repo.createFiscalYear({
        ...parsed.data,
        status: 'active',
        is_current: parsed.data.is_current || false,
      })
      return { ok: true, data: year }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CREATE_FAILED' }
    }
  }

  async generatePeriods(yearId: string): Promise<ServiceResult<AccountingPeriodEntity[]>> {
    const year = await this.repo.findYearWithPeriods(yearId)
    if (!year) return { ok: false, error: 'السنة المالية غير موجودة', code: 'NOT_FOUND' }

    const existingPeriods = year.periods || []
    if (existingPeriods.length > 0) {
      return { ok: false, error: 'هذه السنة تحتوي بالفعل على فترات محاسبية', code: 'PERIODS_EXIST' }
    }

    const startDate = new Date(year.start_date)
    const endDate = new Date(year.end_date)
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ]

    const periods: AccountingPeriodEntity[] = []
    for (let i = 0; i < Math.min(months, 12); i++) {
      const periodStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
      const periodEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0)

      if (periodEnd > endDate) {
        periodEnd.setDate(endDate.getDate())
      }

      try {
        const period = await this.repo.createPeriod({
          company_id: this.companyId,
          fiscal_year_id: yearId,
          period_number: i + 1,
          name: `${monthNames[i]} ${periodStart.getFullYear()}`,
          name_ar: `${monthNames[i]} ${periodStart.getFullYear()}`,
          start_date: periodStart.toISOString().slice(0, 10),
          end_date: periodEnd.toISOString().slice(0, 10),
        })
        periods.push(period)
      } catch {
        break
      }
    }

    return { ok: true, data: periods }
  }

  async closePeriod(periodId: string, closedById?: string): Promise<ServiceResult<PeriodClosingResult>> {
    const period = await this.repo.findPeriodById(periodId)
    if (!period) return { ok: false, error: 'الفترة غير موجودة', code: 'NOT_FOUND' }
    if (period.status === 'closed') return { ok: false, error: 'الفترة مغلقة بالفعل', code: 'ALREADY_CLOSED' }
    if (period.status === 'locked') return { ok: false, error: 'الفترة مقفلة ولا يمكن إغلاقها', code: 'LOCKED' }

    const postedEntries = await this.journalRepo.findPostedInPeriod(periodId)
    if (postedEntries.length === 0) {
      return { ok: false, error: 'لا توجد قيود مرحّلة في هذه الفترة', code: 'NO_ENTRIES' }
    }

    const unpostedInPeriod = await this.db
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .eq('period_id', periodId)
      .not('status', 'in', '("posted","reversed","void")')

    const warnings: string[] = []
    if ((unpostedInPeriod.count ?? 0) > 0) {
      warnings.push(`توجد ${unpostedInPeriod.count} قيود غير مرحّلة في هذه الفترة`)
    }

    try {
      await this.repo.updatePeriodStatus(periodId, 'closed', {
        closed_at: new Date().toISOString(),
        closed_by: closedById || null,
      })
      return {
        ok: true,
        data: {
          period_id: periodId,
          closed: true,
          entries_posted: postedEntries.length,
          warnings,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'CLOSE_FAILED' }
    }
  }

  async openPeriod(periodId: string): Promise<ServiceResult<AccountingPeriodEntity>> {
    const period = await this.repo.findPeriodById(periodId)
    if (!period) return { ok: false, error: 'الفترة غير موجودة', code: 'NOT_FOUND' }
    if (period.status === 'open') return { ok: false, error: 'الفترة مفتوحة بالفعل', code: 'ALREADY_OPEN' }
    if (period.status === 'locked') return { ok: false, error: 'الفترة مقفلة ولا يمكن فتحها', code: 'LOCKED' }

    try {
      const updated = await this.repo.updatePeriodStatus(periodId, 'open', {
        closed_at: null,
        closed_by: null,
      })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'OPEN_FAILED' }
    }
  }

  async lockPeriod(periodId: string, lockedById?: string): Promise<ServiceResult<AccountingPeriodEntity>> {
    const period = await this.repo.findPeriodById(periodId)
    if (!period) return { ok: false, error: 'الفترة غير موجودة', code: 'NOT_FOUND' }
    if (period.status === 'locked') return { ok: false, error: 'الفترة مقفلة بالفعل', code: 'ALREADY_LOCKED' }

    try {
      const updated = await this.repo.updatePeriodStatus(periodId, 'locked', {
        locked_at: new Date().toISOString(),
        locked_by: lockedById || null,
      })
      return { ok: true, data: updated }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'LOCK_FAILED' }
    }
  }

  async getCurrentPeriod(): Promise<ServiceResult<AccountingPeriodEntity | null>> {
    const today = new Date().toISOString().slice(0, 10)
    const period = await this.repo.findOpenPeriodByDate(today)
    return { ok: true, data: period }
  }

  async getFiscalYears(): Promise<ServiceResult<FiscalYearEntity[]>> {
    try {
      const years = await this.repo.findAllYears()
      return { ok: true, data: years }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getPeriodsByYear(yearId: string): Promise<ServiceResult<AccountingPeriodEntity[]>> {
    try {
      const periods = await this.repo.findPeriodsByYear(yearId)
      return { ok: true, data: periods }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }

  async getYearWithPeriods(yearId: string): Promise<ServiceResult<FiscalYearEntity | null>> {
    const year = await this.repo.findYearWithPeriods(yearId)
    return { ok: true, data: year }
  }

  async validatePostingDate(date: string): Promise<ServiceResult<{ valid: boolean; period: AccountingPeriodEntity | null; fiscalYear: FiscalYearEntity | null }>> {
    const period = await this.repo.findOpenPeriodByDate(date)
    if (!period) {
      return {
        ok: true,
        data: { valid: false, period: null, fiscalYear: null },
      }
    }
    const year = await this.repo.findYearByDate(date)
    return {
      ok: true,
      data: { valid: period.status === 'open', period, fiscalYear: year },
    }
  }
}
