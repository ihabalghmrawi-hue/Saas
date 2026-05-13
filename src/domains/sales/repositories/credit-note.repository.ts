import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { CreditNoteEntity, CreditNoteLineEntity } from '../entities/credit-note.entity'

export class CreditNoteRepository extends BaseSalesRepository<CreditNoteEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'credit_notes') }

  async generateCreditNoteNo(): Promise<string> {
    const { count } = await this.db.from('credit_notes').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `CN-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByInvoice(invoiceId: string): Promise<CreditNoteEntity[]> {
    return this.findMany({ filters: { invoice_id: invoiceId }, orderBy: 'created_at', orderDir: 'desc' })
  }
}

export class CreditNoteLineRepository extends BaseSalesRepository<CreditNoteLineEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'credit_note_lines') }
  async findByCreditNote(noteId: string): Promise<CreditNoteLineEntity[]> {
    return this.findMany({ filters: { credit_note_id: noteId } })
  }
}
