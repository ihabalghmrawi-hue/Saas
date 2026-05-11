/**
 * Financial Report Engine v2
 *
 * All reports are derived from journal_entry_lines + chart_of_accounts.
 * This ensures accounting integrity — reports match the ledger exactly.
 */

import { SupabaseClient } from '@supabase/supabase-js'

interface DateRange { from: string; to: string }

// ── Profit & Loss Statement ───────────────────────────────────────────────────

export async function getProfitLoss(
  supabase:   SupabaseClient,
  companyId:  string,
  range:      DateRange,
) {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit,
      chart_of_accounts!inner(code, name, name_ar, type, nature, company_id)
    `)
    .eq('chart_of_accounts.company_id', companyId)

  // Filter to posted entries in date range via journal_entries
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_posted', true)
    .gte('date', range.from)
    .lte('date', range.to)

  const entryIds = new Set((entries ?? []).map((e: any) => e.id))

  const filtered = (lines ?? []).filter((l: any) => entryIds.has(l.journal_entry_id))

  const grouped = groupByAccountType(filtered)

  const revenue   = sumType(grouped, 'revenue',   'credit')
  const cogs      = sumType(grouped, 'cogs',       'debit')
  const expenses  = sumType(grouped, 'expense',    'debit')
  const grossProfit = revenue - cogs
  const netProfit   = grossProfit - expenses

  return {
    period:      range,
    revenue,
    cogs,
    gross_profit: grossProfit,
    expenses,
    net_profit:   netProfit,
    gross_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(2) : '0',
    net_margin:   revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(2) : '0',
    details: {
      revenue_accounts: getAccountDetails(grouped, 'revenue',  'credit'),
      cogs_accounts:    getAccountDetails(grouped, 'cogs',     'debit'),
      expense_accounts: getAccountDetails(grouped, 'expense',  'debit'),
    },
  }
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export async function getBalanceSheet(
  supabase:   SupabaseClient,
  companyId:  string,
  asOf:       string,  // date
) {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit,
      chart_of_accounts!inner(code, name, name_ar, type, nature, company_id)
    `)
    .eq('chart_of_accounts.company_id', companyId)

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_posted', true)
    .lte('date', asOf)

  const entryIds = new Set((entries ?? []).map((e: any) => e.id))
  const filtered = (lines ?? []).filter((l: any) => entryIds.has(l.journal_entry_id))
  const grouped  = groupByAccountType(filtered)

  const totalAssets      = sumType(grouped, 'asset',     'debit')
  const totalLiabilities = sumType(grouped, 'liability', 'credit')
  const totalEquity      = sumType(grouped, 'equity',    'credit')

  return {
    as_of:       asOf,
    total_assets:      totalAssets,
    total_liabilities: totalLiabilities,
    total_equity:      totalEquity,
    balanced:          Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
    assets:            getAccountDetails(grouped, 'asset',     'debit'),
    liabilities:       getAccountDetails(grouped, 'liability', 'credit'),
    equity:            getAccountDetails(grouped, 'equity',    'credit'),
  }
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

export async function getTrialBalance(
  supabase:  SupabaseClient,
  companyId: string,
  range:     DateRange,
) {
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, name_ar, type, nature')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('allow_posting', true)
    .order('code')

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_posted', true)
    .gte('date', range.from)
    .lte('date', range.to)

  const entryIds = (entries ?? []).map((e: any) => e.id)

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit')
    .in('journal_entry_id', entryIds.length ? entryIds : ['00000000-0000-0000-0000-000000000000'])

  const totals = new Map<string, { debit: number; credit: number }>()
  for (const l of lines ?? []) {
    const existing = totals.get(l.account_id) ?? { debit: 0, credit: 0 }
    totals.set(l.account_id, {
      debit:  existing.debit  + Number(l.debit),
      credit: existing.credit + Number(l.credit),
    })
  }

  const rows = (accounts ?? [])
    .map((a: any) => {
      const t = totals.get(a.id) ?? { debit: 0, credit: 0 }
      return {
        code:    a.code,
        name:    a.name_ar || a.name,
        type:    a.type,
        nature:  a.nature,
        debit:   t.debit,
        credit:  t.credit,
        balance: a.nature === 'debit' ? t.debit - t.credit : t.credit - t.debit,
      }
    })
    .filter(r => r.debit > 0 || r.credit > 0)

  const totalDebit  = rows.reduce((s, r) => s + r.debit,  0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

  return {
    period:        range,
    accounts:      rows,
    total_debit:   totalDebit,
    total_credit:  totalCredit,
    is_balanced:   Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

// ── Cash Flow Statement ───────────────────────────────────────────────────────

export async function getCashFlow(
  supabase:  SupabaseClient,
  companyId: string,
  range:     DateRange,
) {
  const { data: txns } = await supabase
    .from('treasury_transactions')
    .select('type, amount, source, description, created_at')
    .eq('company_id', companyId)
    .gte('created_at', range.from)
    .lte('created_at', range.to + 'T23:59:59Z')
    .order('created_at')

  const operating: any[] = []
  const investing:  any[] = []
  const financing:  any[] = []

  for (const tx of txns ?? []) {
    const flow = {
      type:    tx.type,
      amount:  tx.type === 'deposit' || tx.type === 'transfer_in' ? Number(tx.amount) : -Number(tx.amount),
      source:  tx.source,
      desc:    tx.description,
      date:    tx.created_at,
    }
    if (['sale','expense','purchase'].includes(tx.source ?? '')) operating.push(flow)
    else if (['asset_purchase','asset_sale'].includes(tx.source ?? '')) investing.push(flow)
    else financing.push(flow)
  }

  const sum = (arr: typeof operating) => arr.reduce((s, x) => s + x.amount, 0)

  return {
    period:           range,
    operating:        { items: operating, total: sum(operating) },
    investing:        { items: investing, total: sum(investing) },
    financing:        { items: financing, total: sum(financing) },
    net_cash_flow:    sum(operating) + sum(investing) + sum(financing),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Line = { debit: number; credit: number; chart_of_accounts: any }

function groupByAccountType(lines: Line[]): Map<string, Line[]> {
  const map = new Map<string, Line[]>()
  for (const l of lines) {
    const type = l.chart_of_accounts?.type ?? 'other'
    if (!map.has(type)) map.set(type, [])
    map.get(type)!.push(l)
  }
  return map
}

function sumType(
  grouped: Map<string, Line[]>,
  type:    string,
  side:    'debit' | 'credit',
): number {
  return (grouped.get(type) ?? []).reduce((s, l) => s + Number(l[side]), 0)
}

function getAccountDetails(
  grouped: Map<string, Line[]>,
  type:    string,
  side:    'debit' | 'credit',
) {
  const lines = grouped.get(type) ?? []
  const byAccount = new Map<string, { code: string; name: string; total: number }>()

  for (const l of lines) {
    const code = l.chart_of_accounts?.code ?? ''
    const name = l.chart_of_accounts?.name_ar ?? l.chart_of_accounts?.name ?? ''
    const key  = code
    const existing = byAccount.get(key) ?? { code, name, total: 0 }
    byAccount.set(key, { ...existing, total: existing.total + Number(l[side]) })
  }

  return Array.from(byAccount.values()).sort((a, b) => a.code.localeCompare(b.code))
}
