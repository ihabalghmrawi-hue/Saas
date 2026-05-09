// ============================================================
// General Ledger Engine
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export interface LedgerEntry {
  date:             string
  entry_number:     string
  description:      string
  debit:            number
  credit:           number
  balance:          number
  journal_entry_id: string
  source:           string
  source_document:  string | null
}

export interface LedgerAccount {
  account_id:       string
  code:             string
  name:             string
  name_ar:          string
  type:             string
  normal_balance:   string
  opening_balance:  number
  entries:          LedgerEntry[]
  closing_balance:  number
  total_debit:      number
  total_credit:     number
}

// ── getGeneralLedger ──────────────────────────────────────────
export async function getGeneralLedger(
  supabase:   SupabaseClient,
  company_id: string,
  params: {
    account_id?: string
    date_from?:  string
    date_to?:    string
    period_id?:  string
  } = {},
): Promise<LedgerAccount[]> {
  const { account_id, date_from, date_to, period_id } = params

  // Get accounts
  let accountsQuery = supabase
    .from('accounts')
    .select('id, code, name, name_ar, type, normal_balance, current_balance')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .eq('is_postable', true)
    .order('code', { ascending: true })

  if (account_id) {
    accountsQuery = accountsQuery.eq('id', account_id)
  }

  const { data: accounts } = await accountsQuery
  if (!accounts || accounts.length === 0) return []

  const results: LedgerAccount[] = []

  for (const account of accounts) {
    const ledger = await getAccountLedger(
      supabase,
      account.id,
      company_id,
      date_from,
      date_to,
      period_id,
    )
    // Only include accounts with entries or a non-zero opening balance
    if (ledger.entries.length > 0 || ledger.opening_balance !== 0) {
      results.push(ledger)
    }
  }

  return results
}

// ── getAccountLedger ──────────────────────────────────────────
export async function getAccountLedger(
  supabase:    SupabaseClient,
  account_id:  string,
  company_id:  string,
  date_from?:  string,
  date_to?:    string,
  period_id?:  string,
): Promise<LedgerAccount> {
  // Get account details
  const { data: account } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type, normal_balance, current_balance')
    .eq('id', account_id)
    .eq('company_id', company_id)
    .maybeSingle()

  if (!account) {
    return {
      account_id,
      code:            '',
      name:            '',
      name_ar:         '',
      type:            '',
      normal_balance:  'debit',
      opening_balance: 0,
      entries:         [],
      closing_balance: 0,
      total_debit:     0,
      total_credit:    0,
    }
  }

  // Calculate opening balance (all posted entries before date_from)
  let opening_balance = 0
  if (date_from) {
    const { data: priorEntries } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit, credit,
        journal_entries!inner(id, date, status, company_id)
      `)
      .eq('account_id', account_id)
      .eq('journal_entries.company_id', company_id)
      .eq('journal_entries.status', 'posted')
      .lt('journal_entries.date', date_from)

    const priorDebit  = (priorEntries || []).reduce((s: number, r: any) => s + Number(r.debit  || 0), 0)
    const priorCredit = (priorEntries || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)

    opening_balance = account.normal_balance === 'debit'
      ? priorDebit - priorCredit
      : priorCredit - priorDebit
  }

  // Get entries in range
  let query = supabase
    .from('journal_entry_lines')
    .select(`
      id, debit, credit, description,
      journal_entries!inner(
        id, entry_number, date, description, source, source_document,
        status, company_id, period_id
      )
    `)
    .eq('account_id', account_id)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')
    .order('journal_entries(date)', { ascending: true })

  if (date_from) {
    query = query.gte('journal_entries.date', date_from)
  }
  if (date_to) {
    query = query.lte('journal_entries.date', date_to)
  }
  if (period_id) {
    query = query.eq('journal_entries.period_id', period_id)
  }

  const { data: lineRows } = await query

  // Build running balance entries
  let runningBalance = opening_balance
  let total_debit    = 0
  let total_credit   = 0
  const entries: LedgerEntry[] = []

  for (const row of (lineRows || []) as any[]) {
    const je     = row.journal_entries
    const debit  = Number(row.debit  || 0)
    const credit = Number(row.credit || 0)

    total_debit  += debit
    total_credit += credit

    if (account.normal_balance === 'debit') {
      runningBalance += debit - credit
    } else {
      runningBalance += credit - debit
    }

    entries.push({
      date:             je.date,
      entry_number:     je.entry_number,
      description:      row.description || je.description,
      debit,
      credit,
      balance:          runningBalance,
      journal_entry_id: je.id,
      source:           je.source || 'manual',
      source_document:  je.source_document || null,
    })
  }

  return {
    account_id:      account.id,
    code:            account.code,
    name:            account.name,
    name_ar:         account.name_ar,
    type:            account.type,
    normal_balance:  account.normal_balance,
    opening_balance,
    entries,
    closing_balance: runningBalance,
    total_debit,
    total_credit,
  }
}

// ── getAccountBalance ─────────────────────────────────────────
export async function getAccountBalance(
  supabase:    SupabaseClient,
  account_id:  string,
  company_id:  string,
  as_of_date?: string,
): Promise<number> {
  const { data: account } = await supabase
    .from('accounts')
    .select('normal_balance')
    .eq('id', account_id)
    .eq('company_id', company_id)
    .maybeSingle()

  if (!account) return 0

  let query = supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit,
      journal_entries!inner(date, status, company_id)
    `)
    .eq('account_id', account_id)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')

  if (as_of_date) {
    query = query.lte('journal_entries.date', as_of_date)
  }

  const { data: rows } = await query

  const totalDebit  = (rows || []).reduce((s: number, r: any) => s + Number(r.debit  || 0), 0)
  const totalCredit = (rows || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)

  return account.normal_balance === 'debit'
    ? totalDebit - totalCredit
    : totalCredit - totalDebit
}

// ── getAccountsBalances ───────────────────────────────────────
export async function getAccountsBalances(
  supabase:   SupabaseClient,
  company_id: string,
  date_from?: string,
  date_to?:   string,
): Promise<Record<string, { debit: number; credit: number; balance: number }>> {
  let query = supabase
    .from('journal_entry_lines')
    .select(`
      account_id, debit, credit,
      journal_entries!inner(date, status, company_id)
    `)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')

  if (date_from) query = query.gte('journal_entries.date', date_from)
  if (date_to)   query = query.lte('journal_entries.date', date_to)

  const { data: rows } = await query

  // Get all accounts to determine normal_balance
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, normal_balance')
    .eq('company_id', company_id)

  const normalBalanceMap: Record<string, string> = {}
  for (const a of accounts || []) {
    normalBalanceMap[a.id] = a.normal_balance
  }

  const result: Record<string, { debit: number; credit: number; balance: number }> = {}

  for (const row of (rows || []) as any[]) {
    const aid    = row.account_id
    const debit  = Number(row.debit  || 0)
    const credit = Number(row.credit || 0)

    if (!result[aid]) result[aid] = { debit: 0, credit: 0, balance: 0 }
    result[aid].debit  += debit
    result[aid].credit += credit
  }

  for (const [aid, bal] of Object.entries(result)) {
    const nb = normalBalanceMap[aid] || 'debit'
    bal.balance = nb === 'debit' ? bal.debit - bal.credit : bal.credit - bal.debit
  }

  return result
}

// ── recalculateAccountBalance ─────────────────────────────────
export async function recalculateAccountBalance(
  supabase:   SupabaseClient,
  account_id: string,
): Promise<void> {
  const { data: account } = await supabase
    .from('accounts')
    .select('id, company_id, normal_balance')
    .eq('id', account_id)
    .maybeSingle()

  if (!account) return

  const { data: rows } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit,
      journal_entries!inner(status, company_id)
    `)
    .eq('account_id', account_id)
    .eq('journal_entries.company_id', account.company_id)
    .eq('journal_entries.status', 'posted')

  const totalDebit  = (rows || []).reduce((s: number, r: any) => s + Number(r.debit  || 0), 0)
  const totalCredit = (rows || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)

  const balance = account.normal_balance === 'debit'
    ? totalDebit - totalCredit
    : totalCredit - totalDebit

  await supabase
    .from('accounts')
    .update({ current_balance: balance })
    .eq('id', account_id)
}
