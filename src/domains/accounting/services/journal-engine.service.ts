import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '@/repositories/base.repository'
import { JournalRepository } from '../repositories/journal.repository'
import { AccountRepository } from '../repositories/account.repository'
import { PeriodRepository } from '../repositories/period.repository'
import { AccountingEventBus } from '../events/event-bus'
import { CreateJournalEntrySchema } from '../validators/journal.schema'
import type { JournalEntryEntity, CreateJournalEntryInput, PostJournalResult } from '../entities/journal.entity'
import type { ServiceResult } from '../types'

export class JournalEngine {
  private readonly repo: JournalRepository
  private readonly accountRepo: AccountRepository
  private readonly periodRepo: PeriodRepository
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.repo = new JournalRepository(db, companyId)
    this.accountRepo = new AccountRepository(db, companyId)
    this.periodRepo = new PeriodRepository(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async create(
    input: CreateJournalEntryInput,
    opts?: { skipValidation?: boolean },
  ): Promise<ServiceResult<PostJournalResult>> {
    if (!opts?.skipValidation) {
      const parsed = CreateJournalEntrySchema.safeParse(input)
      if (!parsed.success) {
        return {
          ok: false,
          error: parsed.error.errors.map(e => e.message).join('; '),
          code: 'VALIDATION_ERROR',
        }
      }
      input = parsed.data as CreateJournalEntryInput
    }

    const entryDate = input.date || new Date().toISOString().slice(0, 10)

    const period = await this.periodRepo.findOpenPeriodByDate(entryDate)
    if (!period) {
      return { ok: false, error: 'لا توجد فترة مالية مفتوحة لهذا التاريخ', code: 'NO_OPEN_PERIOD' }
    }

    const resolvedLines: Array<{
      account_id: string
      debit: number
      credit: number
      description: string | null
      line_number: number
      cost_center_id: string | null
      branch_id: string | null
    }> = []

    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i]
      let accountId = line.account_id

      if (!accountId && line.account_code) {
        const account = await this.accountRepo.findByCode(line.account_code)
        if (!account) {
          return { ok: false, error: `الحساب غير موجود: ${line.account_code}`, code: 'ACCOUNT_NOT_FOUND' }
        }
        if (!account.is_postable) {
          return { ok: false, error: `الحساب ${account.name} غير قابل للترحيل`, code: 'NON_POSTABLE_ACCOUNT' }
        }
        accountId = account.id
      }

      if (!accountId) {
        return { ok: false, error: `السطر ${i + 1}: لم يتم تحديد الحساب`, code: 'MISSING_ACCOUNT' }
      }

      resolvedLines.push({
        account_id: accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description || null,
        line_number: i + 1,
        cost_center_id: (line.cost_center_id as string | undefined) ?? null,
        branch_id: (line.branch_id as string | undefined) ?? null,
      })
    }

    const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return {
        ok: false,
        error: `القيد غير متوازن: مدين=${totalDebit.toFixed(2)} دائن=${totalCredit.toFixed(2)}`,
        code: 'UNBALANCED_ENTRY',
      }
    }

    try {
      const entryNumber = await this.repo.getNextEntryNumber()
      const isPosted = input.source === 'auto_generated'

      const { data: entry, error } = await this.db
        .from('journal_entries')
        .insert({
          company_id: this.companyId,
          entry_number: entryNumber,
          date: entryDate,
          description: input.description,
          description_ar: input.description_ar || input.description,
          reference: input.reference || null,
          reference_type: input.source || 'manual',
          source: input.source || 'manual',
          source_id: input.source_id || null,
          source_document: input.source_document || null,
          status: isPosted ? 'posted' : 'draft',
          is_posted: isPosted,
          is_balanced: true,
          auto_generated: isPosted,
          total_debit: totalDebit,
          total_credit: totalCredit,
          fiscal_year_id: period.fiscal_year_id,
          period_id: period.id,
          branch_id: input.branch_id || null,
          cost_center_id: input.cost_center_id || null,
          created_by_id: input.created_by_id || null,
          currency: input.currency || 'SAR',
          exchange_rate: input.exchange_rate || 1,
          tags: input.tags || null,
          posted_at: isPosted ? new Date().toISOString() : null,
        })
        .select('id, entry_number')
        .single()

      if (error || !entry) {
        return { ok: false, error: `فشل إنشاء القيد: ${error?.message}`, code: 'INSERT_FAILED' }
      }

      await this.repo.insertLines(
        resolvedLines.map(l => ({ ...l, journal_entry_id: entry.id }))
      )

      await this.eventBus.emit('accounting.journal.created', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: (input.source as any) || 'manual',
        companyId: this.companyId,
        journalEntryId: entry.id,
        entryNumber: entry.entry_number,
        amount: totalDebit,
        description: input.description,
        reference: input.reference,
        source: input.source,
        sourceId: input.source_id,
        timestamp: new Date().toISOString(),
      })

      if (isPosted) {
        await this.eventBus.emit('accounting.journal.posted', {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          type: (input.source as any) || 'manual',
          companyId: this.companyId,
          journalEntryId: entry.id,
          entryNumber: entry.entry_number,
          amount: totalDebit,
          description: input.description,
          timestamp: new Date().toISOString(),
        })
      }

      return {
        ok: true,
        data: { journal_id: entry.id, entry_number: entry.entry_number },
      }
    } catch (e: any) {
      if (e.message?.includes?.('تم ترحيل هذه المعاملة مسبقاً')) {
        return { ok: false, error: e.message, code: 'DUPLICATE_POSTING' }
      }
      if (e.message?.includes?.('لا يمكن تعديل')) {
        return { ok: false, error: e.message, code: 'IMMUTABLE' }
      }
      return { ok: false, error: e.message, code: 'CREATE_FAILED' }
    }
  }

  async post(journalId: string, approvedById?: string): Promise<ServiceResult<PostJournalResult>> {
    const entry = await this.repo.findByIdWithLines(journalId)
    if (!entry) return { ok: false, error: 'القيد غير موجود', code: 'NOT_FOUND' }

    if (entry.status === 'posted') return { ok: false, error: 'القيد مرحّل بالفعل', code: 'ALREADY_POSTED' }
    if (entry.status === 'void') return { ok: false, error: 'لا يمكن ترحيل قيد ملغي', code: 'VOID_ENTRY' }
    if (entry.status === 'reversed') return { ok: false, error: 'لا يمكن ترحيل قيد معكوس', code: 'REVERSED_ENTRY' }

    const period = await this.periodRepo.findOpenPeriodByDate(entry.date)
    if (!period) {
      return { ok: false, error: 'لا توجد فترة مالية مفتوحة لهذا التاريخ', code: 'NO_OPEN_PERIOD' }
    }

    try {
      const { error } = await this.db
        .from('journal_entries')
        .update({
          status: 'posted',
          is_posted: true,
          approved_by_id: approvedById || null,
          posted_at: new Date().toISOString(),
          period_id: period.id,
        })
        .eq('id', journalId)
        .eq('company_id', this.companyId)

      if (error) throw new RepositoryError(error.message, error.code)

      await this.eventBus.emit('accounting.journal.posted', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: journalId,
        entryNumber: entry.entry_number,
        amount: entry.total_debit,
        description: entry.description,
        timestamp: new Date().toISOString(),
        performedBy: approvedById,
      })

      return { ok: true, data: { journal_id: journalId, entry_number: entry.entry_number } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'POST_FAILED' }
    }
  }

  async reverse(journalId: string, reason?: string): Promise<ServiceResult<PostJournalResult>> {
    const entry = await this.repo.findByIdWithLines(journalId)
    if (!entry) return { ok: false, error: 'القيد غير موجود', code: 'NOT_FOUND' }
    if (entry.status !== 'posted') return { ok: false, error: 'يمكن عكس القيود المرحّلة فقط', code: 'NOT_POSTED' }
    if (entry.reversal_entry_id) return { ok: false, error: 'هذا القيد تم عكسه مسبقاً', code: 'ALREADY_REVERSED' }
    if (!entry.lines) return { ok: false, error: 'القيد لا يحتوي على بنود', code: 'NO_LINES' }

    const today = new Date().toISOString().slice(0, 10)
    const reversedLines = entry.lines.map(l => ({
      account_code: '',
      account_id: l.account_id,
      debit: l.credit,
      credit: l.debit,
      description: l.description ? `عكس: ${l.description}` : 'قيد عكسي',
      cost_center_id: l.cost_center_id ?? undefined,
      branch_id: l.branch_id ?? undefined,
    }))

    const createResult = await this.create(
      {
        company_id: this.companyId,
        description: `عكس قيد: ${entry.description}${reason ? ` - ${reason}` : ''}`,
        description_ar: `عكس قيد: ${entry.description_ar || entry.description}`,
        reference: entry.reference || undefined,
        source: 'reversal',
        source_id: journalId,
        source_document: `Reversal of ${entry.entry_number}`,
        date: today,
        lines: reversedLines,
        currency: entry.currency,
        exchange_rate: entry.exchange_rate,
      },
      { skipValidation: true },
    )

    if (!createResult.ok) return createResult

    try {
      await this.repo.updateStatus(journalId, 'reversed', {
        reversal_entry_id: createResult.data.journal_id,
        reversal_reason: reason || null,
      })

      await this.repo.updateStatus(createResult.data.journal_id, 'posted', {
        reversal_of_id: journalId,
      })

      await this.eventBus.emit('accounting.journal.reversed', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: createResult.data.journal_id,
        entryNumber: createResult.data.entry_number,
        amount: entry.total_debit,
        description: `عكس قيد: ${entry.entry_number}`,
        timestamp: new Date().toISOString(),
        metadata: { originalEntryId: journalId, reason },
      })

      return createResult
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSAL_FAILED' }
    }
  }

  async voidEntry(journalId: string): Promise<ServiceResult<{ id: string }>> {
    const entry = await this.repo.findByIdWithLines(journalId)
    if (!entry) return { ok: false, error: 'القيد غير موجود', code: 'NOT_FOUND' }
    if (!['draft', 'pending'].includes(entry.status)) {
      return { ok: false, error: 'يمكن إلغاء القيود في حالة المسودة أو المعلقة فقط', code: 'INVALID_STATUS' }
    }

    try {
      await this.repo.updateStatus(journalId, 'void')

      await this.eventBus.emit('accounting.journal.voided', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: journalId,
        amount: entry.total_debit,
        description: `إلغاء قيد: ${entry.entry_number}`,
        timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { id: journalId } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'VOID_FAILED' }
    }
  }

  async getById(id: string): Promise<ServiceResult<JournalEntryEntity>> {
    const entry = await this.repo.findByIdWithLines(id)
    if (!entry) return { ok: false, error: 'القيد غير موجود', code: 'NOT_FOUND' }
    return { ok: true, data: entry }
  }

  async list(filters: {
    status?: string
    source?: string
    fromDate?: string
    toDate?: string
    periodId?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<ServiceResult<{ data: JournalEntryEntity[]; count: number }>> {
    try {
      const result = await this.repo.findPaged({
        ...filters,
        page: filters.page || 1,
        limit: filters.limit || 50,
        sortBy: 'date',
        sortOrder: 'desc',
      })
      return { ok: true, data: result }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'FETCH_FAILED' }
    }
  }
}
