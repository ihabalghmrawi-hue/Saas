import type { SupabaseClient } from '@supabase/supabase-js'
import { JournalService } from '../services/journal.service'
import { AccountingEventBus } from '../events/event-bus'
import type { JournalEntryEntity, CreateJournalEntryInput } from '../entities/journal.entity'
import type { ServiceResult } from '../types'

export class JournalWorkflow {
  private readonly journalService: JournalService
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.journalService = new JournalService(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async createDraft(input: CreateJournalEntryInput): Promise<ServiceResult<{ journal_id: string; entry_number: string }>> {
    const result = await this.journalService.create({
      ...input,
      source: input.source || 'manual',
    })

    if (result.ok) {
      await this.eventBus.emit('accounting.journal.created', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: result.data.journal_id,
        entryNumber: result.data.entry_number,
        amount: 0,
        description: `إنشاء قيد: ${input.description}`,
        reference: input.reference,
        timestamp: new Date().toISOString(),
      })
      return { ok: true, data: { journal_id: result.data.journal_id, entry_number: result.data.entry_number } }
    }

    return { ok: false, error: result.error!, code: result.code }
  }

  async submitForApproval(journalId: string): Promise<ServiceResult<JournalEntryEntity>> {
    const entry = await this.journalService.getById(journalId)
    if (!entry.ok) return entry
    if (entry.data.status !== 'draft') {
      return { ok: false, error: 'يمكن تقديم المسودات فقط للموافقة', code: 'INVALID_STATUS' }
    }

    try {
      await this.db
        .from('journal_entries')
        .update({ status: 'pending', approval_status: 'pending' })
        .eq('id', journalId)
        .eq('company_id', this.companyId)

      const updated = await this.journalService.getById(journalId)
      return updated
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SUBMIT_FAILED' }
    }
  }

  async approve(journalId: string, approvedById: string): Promise<ServiceResult<JournalEntryEntity>> {
    const entry = await this.journalService.getById(journalId)
    if (!entry.ok) return entry
    if (entry.data.status !== 'pending') {
      return { ok: false, error: 'يمكن اعتماد القيود المعلقة فقط', code: 'INVALID_STATUS' }
    }

    const result = await this.journalService.post(journalId, approvedById)
    if (!result.ok) return result

    await this.eventBus.emit('accounting.journal.posted', {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type: 'manual',
      companyId: this.companyId,
      journalEntryId: journalId,
      entryNumber: result.data.entry_number,
      amount: 0,
      description: `اعتماد وترحيل قيد`,
      timestamp: new Date().toISOString(),
      performedBy: approvedById,
    })

    const updated = await this.journalService.getById(journalId)
    return updated
  }

  async reject(journalId: string, rejectedById: string, reason: string): Promise<ServiceResult<JournalEntryEntity>> {
    const entry = await this.journalService.getById(journalId)
    if (!entry.ok) return entry
    if (entry.data.status !== 'pending') {
      return { ok: false, error: 'يمكن رفض القيود المعلقة فقط', code: 'INVALID_STATUS' }
    }

    try {
      await this.db
        .from('journal_entries')
        .update({
          status: 'draft',
          approval_status: 'rejected',
          rejection_reason: reason,
          approved_by_id: rejectedById,
          approved_at: new Date().toISOString(),
        })
        .eq('id', journalId)
        .eq('company_id', this.companyId)

      return this.journalService.getById(journalId)
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REJECT_FAILED' }
    }
  }

  async reverse(journalId: string, reason?: string): Promise<ServiceResult<{ journal_id: string; entry_number: string }>> {
    const entry = await this.journalService.getById(journalId)
    if (!entry.ok) return { ok: false, error: entry.error!, code: 'NOT_FOUND' }

    const result = await this.journalService.reverse(journalId, reason)
    if (result.ok) {
      await this.eventBus.emit('accounting.journal.reversed', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: result.data.journal_id,
        entryNumber: result.data.entry_number,
        amount: 0,
        description: `عكس قيد: ${entry.data.entry_number}${reason ? ` - ${reason}` : ''}`,
        reference: entry.data.reference || '',
        timestamp: new Date().toISOString(),
        metadata: { originalEntryId: journalId },
      })
    }

    return result
  }

  async void(journalId: string): Promise<ServiceResult<{ id: string }>> {
    const result = await this.journalService.voidEntry(journalId)
    if (result.ok) {
      await this.eventBus.emit('accounting.journal.voided', {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        type: 'manual',
        companyId: this.companyId,
        journalEntryId: journalId,
        amount: 0,
        description: `إلغاء قيد`,
        timestamp: new Date().toISOString(),
      })
    }
    return result
  }
}
