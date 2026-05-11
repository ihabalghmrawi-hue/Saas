/**
 * Accounting Engine — Auto-Posting
 *
 * Every ERP action (sale, purchase, expense, return) calls postAccountingEvent().
 * The engine resolves the correct debit/credit accounts from account_mappings,
 * creates a balanced journal_entry + journal_entry_lines, and returns the entry ID.
 *
 * Double-entry invariant: SUM(debit) === SUM(credit) always enforced.
 */

import { SupabaseClient }           from '@supabase/supabase-js'
import { AccountingEvent, DEFAULT_ACCOUNTS } from './events'

export class InsufficientFundsError extends Error {
  constructor(public accountName: string, public available: number, public required: number) {
    super(`رصيد غير كافٍ في ${accountName}: المتاح ${available}، المطلوب ${required}`)
    this.name = 'InsufficientFundsError'
  }
}

export class AccountingEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountingEngineError'
  }
}

interface ResolvedLine {
  accountId:   string
  accountCode: string
  debit:       number
  credit:      number
  description: string
}

// ── Core engine function ──────────────────────────────────────────────────────

export async function postAccountingEvent(
  supabase: SupabaseClient,
  event:    AccountingEvent,
): Promise<string> {
  const { companyId, type, amount, description, reference, sourceId, source, date } = event
  const entryDate = date ?? new Date().toISOString().slice(0, 10)

  // 1. Resolve open fiscal period
  const period = await resolveOpenPeriod(supabase, companyId, entryDate)

  // 2. Build lines (from event.lines if provided, else resolve from account_mappings)
  let lines: ResolvedLine[]
  if (event.lines && event.lines.length > 0) {
    lines = await resolveExplicitLines(supabase, companyId, event.lines)
  } else {
    lines = await resolveAutoLines(supabase, companyId, event)
  }

  // 3. Validate balance
  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new AccountingEngineError(
      `القيد غير متوازن: مدين=${totalDebit} دائن=${totalCredit} للمرجع ${reference}`
    )
  }

  // 4. Insert journal_entry
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      company_id:  companyId,
      period_id:   period?.id ?? null,
      reference,
      date:        entryDate,
      description,
      source:      source ?? deriveSource(type),
      source_id:   sourceId ?? null,
      status:      'posted',
      is_posted:   true,
      posted_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    throw new AccountingEngineError(`فشل إنشاء القيد المحاسبي: ${entryError?.message}`)
  }

  // 5. Insert journal_entry_lines
  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(
      lines.map((l, i) => ({
        journal_entry_id: entry.id,
        account_id:       l.accountId,
        description:      l.description,
        debit:            l.debit,
        credit:           l.credit,
        sort_order:       i,
      }))
    )

  if (linesError) {
    // Rollback: delete the entry header
    await supabase.from('journal_entries').delete().eq('id', entry.id)
    throw new AccountingEngineError(`فشل إنشاء سطور القيد: ${linesError.message}`)
  }

  return entry.id
}

// ── Reverse a posted journal entry ───────────────────────────────────────────

export async function reverseJournalEntry(
  supabase:  SupabaseClient,
  entryId:   string,
  companyId: string,
  date?:     string,
): Promise<string> {
  const { data: original } = await supabase
    .from('journal_entries')
    .select('*, journal_entry_lines(*)')
    .eq('id', entryId)
    .eq('company_id', companyId)
    .single()

  if (!original) throw new AccountingEngineError('القيد غير موجود')
  if (original.status === 'reversed') throw new AccountingEngineError('القيد محوّل بالفعل')

  const lines = (original.journal_entry_lines as any[]).map((l: any) => ({
    journal_entry_id: '',   // will be set after insert
    account_id:       l.account_id,
    description:      `عكس: ${l.description ?? ''}`,
    debit:            l.credit,    // swap debit/credit
    credit:           l.debit,
    sort_order:       l.sort_order,
  }))

  const { data: reversal, error } = await supabase
    .from('journal_entries')
    .insert({
      company_id:  companyId,
      period_id:   original.period_id,
      reference:   `REV-${original.reference}`,
      date:        date ?? new Date().toISOString().slice(0, 10),
      description: `عكس قيد: ${original.description}`,
      source:      original.source,
      source_id:   original.source_id,
      status:      'posted',
      is_posted:   true,
      posted_at:   new Date().toISOString(),
      reversed_by: entryId,
    })
    .select('id')
    .single()

  if (error || !reversal) throw new AccountingEngineError(`فشل عكس القيد: ${error?.message}`)

  await supabase.from('journal_entry_lines').insert(
    lines.map(l => ({ ...l, journal_entry_id: reversal.id }))
  )

  await supabase.from('journal_entries')
    .update({ status: 'reversed' })
    .eq('id', entryId)

  return reversal.id
}

// ── Get account balance ───────────────────────────────────────────────────────

export async function getAccountBalance(
  supabase:    SupabaseClient,
  accountId:   string,
  companyId:   string,
  fromDate?:   string,
  toDate?:     string,
): Promise<{ debit: number; credit: number; balance: number; nature: string }> {
  let query = supabase
    .from('journal_entry_lines')
    .select('debit, credit, accounts!inner(type, nature, company_id)')
    .eq('account_id', accountId)
    .eq('accounts.company_id', companyId)

  if (fromDate || toDate) {
    const entries = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_posted', true)
      .gte(fromDate ? 'date' : 'id', fromDate ?? '')
      .lte(toDate   ? 'date' : 'id', toDate   ?? '')

    const entryIds = (entries.data ?? []).map((e: any) => e.id)
    if (entryIds.length) {
      query = query.in('journal_entry_id', entryIds)
    }
  }

  const { data } = await query
  const totalDebit  = (data ?? []).reduce((s: number, l: any) => s + Number(l.debit),  0)
  const totalCredit = (data ?? []).reduce((s: number, l: any) => s + Number(l.credit), 0)
  const nature      = (data as any)?.[0]?.accounts?.nature ?? 'debit'
  const balance     = nature === 'debit' ? totalDebit - totalCredit : totalCredit - totalDebit

  return { debit: totalDebit, credit: totalCredit, balance, nature }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveOpenPeriod(
  supabase:  SupabaseClient,
  companyId: string,
  date:      string,
) {
  const { data } = await supabase
    .from('fiscal_periods')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'open')
    .lte('start_date', date)
    .gte('end_date', date)
    .maybeSingle()
  return data
}

async function resolveAccountByCode(
  supabase:   SupabaseClient,
  companyId:  string,
  code:       string,
): Promise<string> {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!data?.id) {
    throw new AccountingEngineError(`حساب غير موجود: ${code}`)
  }
  return data.id
}

async function resolveAutoLines(
  supabase:  SupabaseClient,
  companyId: string,
  event:     AccountingEvent,
): Promise<ResolvedLine[]> {
  const { type, amount, description } = event

  // Try custom account_mappings first
  const { data: mapping } = await supabase
    .from('account_mappings')
    .select('debit_account, credit_account')
    .eq('company_id', companyId)
    .eq('event_type', type)
    .maybeSingle()

  let debitId:  string
  let creditId: string

  if (mapping) {
    debitId  = mapping.debit_account
    creditId = mapping.credit_account
  } else {
    // Fall back to default COA codes
    const [dr, cr] = getDefaultMapping(type)
    debitId  = await resolveAccountByCode(supabase, companyId, event.debitAccountCode  ?? dr)
    creditId = await resolveAccountByCode(supabase, companyId, event.creditAccountCode ?? cr)
  }

  return [
    { accountId: debitId,  accountCode: '', debit: amount, credit: 0,      description },
    { accountId: creditId, accountCode: '', debit: 0,      credit: amount, description },
  ]
}

async function resolveExplicitLines(
  supabase:   SupabaseClient,
  companyId:  string,
  rawLines:   NonNullable<AccountingEvent['lines']>,
): Promise<ResolvedLine[]> {
  return Promise.all(rawLines.map(async l => ({
    accountId:   await resolveAccountByCode(supabase, companyId, l.accountCode),
    accountCode: l.accountCode,
    debit:       l.debit,
    credit:      l.credit,
    description: l.description ?? '',
  })))
}

function getDefaultMapping(type: AccountingEvent['type']): [string, string] {
  const A = DEFAULT_ACCOUNTS
  const map: Record<string, [string, string]> = {
    sale_cash:           [A.CASH,               A.SALES_REVENUE],
    sale_credit:         [A.ACCOUNTS_RECEIVABLE, A.SALES_REVENUE],
    sale_cogs:           [A.COST_OF_GOODS_SOLD,  A.INVENTORY],
    sale_payment:        [A.CASH,               A.ACCOUNTS_RECEIVABLE],
    sale_return_cash:    [A.SALES_REVENUE,       A.CASH],
    sale_return_credit:  [A.SALES_REVENUE,       A.ACCOUNTS_RECEIVABLE],
    sale_return_cogs:    [A.INVENTORY,           A.COST_OF_GOODS_SOLD],
    purchase_cash:       [A.INVENTORY,           A.CASH],
    purchase_credit:     [A.INVENTORY,           A.ACCOUNTS_PAYABLE],
    purchase_payment:    [A.ACCOUNTS_PAYABLE,    A.CASH],
    expense_cash:        [A.MISCELLANEOUS,       A.CASH],
    expense_accrual:     [A.MISCELLANEOUS,       A.ACCOUNTS_PAYABLE],
    treasury_transfer:   [A.CASH,               A.CASH],   // overridden by explicit lines
    rental_revenue:      [A.CASH,               A.RENTAL_REVENUE],
    inventory_adjustment:[A.INVENTORY,           A.INVENTORY_ADJUSTMENT],
    construction_expense:[A.CONSTRUCTION_LABOR,  A.CASH],
  }
  return map[type] ?? [A.MISCELLANEOUS, A.CASH]
}

function deriveSource(type: AccountingEvent['type']): string {
  if (type.startsWith('sale'))         return 'sale'
  if (type.startsWith('purchase'))     return 'purchase'
  if (type.startsWith('expense'))      return 'expense'
  if (type.startsWith('rental'))       return 'rental'
  if (type.startsWith('construction')) return 'construction'
  if (type === 'treasury_transfer')    return 'treasury'
  return 'manual'
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function postSaleEntry(
  supabase:   SupabaseClient,
  companyId:  string,
  opts: {
    saleId:         string
    invoiceNumber:  string
    total:          number
    cogsTotal:      number
    isCredit:       boolean
    date?:          string
  }
): Promise<string> {
  const { saleId, invoiceNumber, total, cogsTotal, isCredit, date } = opts

  // Revenue line
  const revenueEntryId = await postAccountingEvent(supabase, {
    type:        isCredit ? 'sale_credit' : 'sale_cash',
    companyId,
    amount:      total,
    description: `مبيعات ${invoiceNumber}`,
    reference:   invoiceNumber,
    sourceId:    saleId,
    source:      'sale',
    date,
  })

  // COGS line (if inventory tracked)
  if (cogsTotal > 0) {
    await postAccountingEvent(supabase, {
      type:        'sale_cogs',
      companyId,
      amount:      cogsTotal,
      description: `تكلفة مبيعات ${invoiceNumber}`,
      reference:   `COGS-${invoiceNumber}`,
      sourceId:    saleId,
      source:      'sale',
      date,
    })
  }

  return revenueEntryId
}

export async function postExpenseEntry(
  supabase:   SupabaseClient,
  companyId:  string,
  opts: {
    expenseId:      string
    reference:      string
    amount:         number
    description:    string
    categoryCode?:  string  // COA code for the expense account
    date?:          string
  }
): Promise<string> {
  return postAccountingEvent(supabase, {
    type:               'expense_cash',
    companyId,
    amount:             opts.amount,
    description:        opts.description,
    reference:          opts.reference,
    sourceId:           opts.expenseId,
    source:             'expense',
    date:               opts.date,
    debitAccountCode:   opts.categoryCode ?? DEFAULT_ACCOUNTS.MISCELLANEOUS,
    creditAccountCode:  DEFAULT_ACCOUNTS.CASH,
  })
}

export async function postPurchaseEntry(
  supabase:   SupabaseClient,
  companyId:  string,
  opts: {
    purchaseId:     string
    invoiceNumber:  string
    total:          number
    isCredit:       boolean
    date?:          string
  }
): Promise<string> {
  return postAccountingEvent(supabase, {
    type:       opts.isCredit ? 'purchase_credit' : 'purchase_cash',
    companyId,
    amount:     opts.total,
    description:`مشتريات ${opts.invoiceNumber}`,
    reference:  opts.invoiceNumber,
    sourceId:   opts.purchaseId,
    source:     'purchase',
    date:       opts.date,
  })
}
