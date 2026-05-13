// ============================================================
// Reconciliation Engine — Payment & Invoice Matching
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reconciliation, ReconciliationLine, AgedReport, AgedItem } from './enterprise-types'

export class ReconciliationEngine {
  private supabase: SupabaseClient
  private companyId: string

  constructor(supabase: SupabaseClient, companyId: string) {
    this.supabase = supabase
    this.companyId = companyId
  }

  async createReconciliation(params: {
    account_id: string
    reference_type: string
    reference_id?: string
    reference_number?: string
    statement_date: string
    statement_amount: number
    notes?: string
  }): Promise<{ ok: boolean; error?: string; id?: string }> {
    const { data, error } = await this.supabase
      .from('reconciliations')
      .insert({
        company_id: this.companyId,
        account_id: params.account_id,
        reference_type: params.reference_type,
        reference_id: params.reference_id,
        reference_number: params.reference_number,
        statement_date: params.statement_date,
        statement_amount: params.statement_amount,
        cleared_amount: 0,
        status: 'unmatched',
        notes: params.notes,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data.id }
  }

  async matchLines(reconciliationId: string, lines: Array<{
    journal_entry_id?: string
    invoice_id?: string
    payment_id?: string
    amount: number
    matched_amount: number
    notes?: string
  }>): Promise<{ ok: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('reconciliation_lines')
      .insert(
        lines.map(l => ({
          reconciliation_id: reconciliationId,
          journal_entry_id: l.journal_entry_id,
          invoice_id: l.invoice_id,
          payment_id: l.payment_id,
          amount: l.amount,
          matched_amount: l.matched_amount,
          status: Math.abs(l.amount - l.matched_amount) < 0.01 ? 'matched' : 'partial',
          notes: l.notes,
        }))
      )

    if (error) return { ok: false, error: error.message }
    await this.updateReconciliationStatus(reconciliationId)
    return { ok: true }
  }

  private async updateReconciliationStatus(reconciliationId: string): Promise<void> {
    const { data: rec } = await this.supabase
      .from('reconciliations')
      .select('statement_amount')
      .eq('id', reconciliationId)
      .single()

    if (!rec) return

    const { data: lines } = await this.supabase
      .from('reconciliation_lines')
      .select('matched_amount')
      .eq('reconciliation_id', reconciliationId)

    const totalMatched = (lines || []).reduce((s, l: any) => s + Number(l.matched_amount), 0)
    const diff = Number(rec.statement_amount) - totalMatched

    let status: string
    if (Math.abs(diff) < 0.01) {
      status = 'matched'
    } else if (diff < 0) {
      status = 'overpaid'
    } else {
      status = totalMatched > 0 ? 'partial' : 'unmatched'
    }

    await this.supabase
      .from('reconciliations')
      .update({
        cleared_amount: totalMatched,
        status,
        reconciled_at: status === 'matched' ? new Date().toISOString() : null,
      })
      .eq('id', reconciliationId)
  }

  async autoMatchInvoice(
    invoiceId: string,
    paymentIds: string[],
  ): Promise<{ ok: boolean; error?: string; totalMatched?: number }> {
    const { data: invoice } = await this.supabase
      .from('journal_entries')
      .select('id, total_debit, reference')
      .eq('id', invoiceId)
      .eq('company_id', this.companyId)
      .single()

    if (!invoice) {
      return { ok: false, error: 'الفاتورة غير موجودة' }
    }

    const invoiceAmount = Number(invoice.total_debit)

    let totalPaid = 0
    for (const pid of paymentIds) {
      const { data: payment } = await this.supabase
        .from('journal_entries')
        .select('total_credit')
        .eq('id', pid)
        .eq('company_id', this.companyId)
        .maybeSingle()

      if (payment) totalPaid += Number(payment.total_credit)
    }

    const matched = Math.min(invoiceAmount, totalPaid)
    const status = Math.abs(matched - invoiceAmount) < 0.01 ? 'matched' : 'partial'

    const { data: rec } = await this.supabase
      .from('reconciliations')
      .insert({
        company_id: this.companyId,
        account_id: invoiceId,
        reference_type: 'invoice_payment',
        reference_id: invoiceId,
        reference_number: invoice.reference || invoiceId,
        statement_date: new Date().toISOString().slice(0, 10),
        statement_amount: invoiceAmount,
        cleared_amount: matched,
        status,
      })
      .select('id')
      .single()

    if (rec) {
      const lines = paymentIds.map(pid => ({
        reconciliation_id: rec.id,
        journal_entry_id: pid,
        invoice_id: invoiceId,
        payment_id: pid,
        amount: invoiceAmount,
        matched_amount: matched,
        status: status === 'matched' ? 'matched' as const : 'partial' as const,
      }))
      await this.supabase.from('reconciliation_lines').insert(lines as any)
    }

    return { ok: true, totalMatched: matched }
  }

  async getPendingReconciliations(params: {
    account_id?: string
    status?: string
    limit?: number
  } = {}): Promise<Reconciliation[]> {
    let query = this.supabase
      .from('reconciliations')
      .select('*, reconciliation_lines(*)')
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false })

    if (params.account_id) query = query.eq('account_id', params.account_id)
    if (params.status) query = query.eq('status', params.status)
    if (params.limit) query = query.limit(params.limit)

    const { data } = await query
    return (data || []) as Reconciliation[]
  }
}

// ── Aged Receivables ───────────────────────────────────────────
async function fetchAgedData(
  supabase: SupabaseClient,
  companyId: string,
  accountType: 'receivable' | 'payable',
  asOfDate?: string,
): Promise<AgedReport> {
  const field = accountType === 'receivable' ? 'debit' : 'credit'
  const balanceField = accountType === 'receivable' ? 'is_receivable' : 'is_payable'

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select(`
      ${field},
      journal_entries!inner(id, entry_number, date, reference, status, company_id),
      accounts!inner(id, code, name_ar, company_id)
    `)
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .eq(`accounts.${balanceField}`, true)
    .gt(field, 0)
    .lte('journal_entries.date', asOfDate || new Date().toISOString().slice(0, 10))

  const buckets: AgedReport['buckets'] = {
    '0-30': [], '31-60': [], '61-90': [], '90+': [],
  }
  let total_0_30 = 0, total_31_60 = 0, total_61_90 = 0, total_90_plus = 0

  const today = new Date(asOfDate || new Date().toISOString().slice(0, 10))

  for (const row of (lines || []) as any[]) {
    const je = row.journal_entries
    const acct = row.accounts
    const amt = Number(row[field] || 0)
    const invoiceDate = new Date(je.date)
    const daysOverdue = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))

    const item: AgedItem = {
      account_id: acct.id,
      company_id: companyId,
      code: acct.code,
      account_name: acct.name_ar,
      invoice_date: je.date,
      journal_entry_id: je.id,
      entry_number: je.entry_number,
      reference: je.reference,
      amount: amt,
      days_overdue: Math.max(0, daysOverdue),
      aging_bucket: '0-30',
    }

    let bucket: keyof AgedReport['buckets']
    if (daysOverdue <= 30) {
      bucket = '0-30'; total_0_30 += amt
    } else if (daysOverdue <= 60) {
      bucket = '31-60'; total_31_60 += amt
    } else if (daysOverdue <= 90) {
      bucket = '61-90'; total_61_90 += amt
    } else {
      bucket = '90+'; total_90_plus += amt
    }
    item.aging_bucket = bucket
    buckets[bucket].push(item)
  }

  return {
    as_of_date: asOfDate || new Date().toISOString().slice(0, 10),
    total_0_30,
    total_31_60,
    total_61_90,
    total_90_plus,
    grand_total: total_0_30 + total_31_60 + total_61_90 + total_90_plus,
    buckets,
  }
}

export async function getAgedReceivables(
  supabase: SupabaseClient,
  companyId: string,
  asOfDate?: string,
): Promise<AgedReport> {
  return fetchAgedData(supabase, companyId, 'receivable', asOfDate)
}

export async function getAgedPayables(
  supabase: SupabaseClient,
  companyId: string,
  asOfDate?: string,
): Promise<AgedReport> {
  return fetchAgedData(supabase, companyId, 'payable', asOfDate)
}

// ── Customer/Supplier Balance ──────────────────────────────────
export async function getCustomerBalances(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Array<{ party_id: string; name: string; total: number; paid: number; due: number }>> {
  const { data: sales } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, journal_entries!inner(id, reference, date, status, company_id),
      accounts!inner(code, is_receivable)
    `)
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .eq('accounts.code', '1110')

  const { data: payments } = await supabase
    .from('journal_entry_lines')
    .select(`
      credit, journal_entries!inner(id, reference, date, status, company_id),
      accounts!inner(code)
    `)
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .eq('accounts.code', '1110')

  const totalInvoiced = (sales || []).reduce((s, r: any) => s + Number(r.debit || 0), 0)
  const totalPaid = (payments || []).reduce((s, r: any) => s + Number(r.credit || 0), 0)

  return [{
    party_id: 'all',
    name: 'إجمالي العملاء',
    total: totalInvoiced,
    paid: totalPaid,
    due: totalInvoiced - totalPaid,
  }]
}

export async function getSupplierBalances(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Array<{ party_id: string; name: string; total: number; paid: number; due: number }>> {
  const { data: purchases } = await supabase
    .from('journal_entry_lines')
    .select(`
      credit, journal_entries!inner(id, reference, date, status, company_id),
      accounts!inner(code, is_payable)
    `)
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .eq('accounts.code', '2101')

  const { data: payments } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, journal_entries!inner(id, reference, date, status, company_id),
      accounts!inner(code)
    `)
    .eq('journal_entries.company_id', companyId)
    .eq('journal_entries.status', 'posted')
    .eq('accounts.code', '2101')

  const totalInvoiced = (purchases || []).reduce((s, r: any) => s + Number(r.credit || 0), 0)
  const totalPaid = (payments || []).reduce((s, r: any) => s + Number(r.debit || 0), 0)

  return [{
    party_id: 'all',
    name: 'إجمالي الموردين',
    total: totalInvoiced,
    paid: totalPaid,
    due: totalInvoiced - totalPaid,
  }]
}
