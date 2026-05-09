// ============================================================
// Financial Statements Engine
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrialBalanceLine } from './types'

export interface StatementLine {
  code:      string
  name:      string
  name_ar:   string
  amount:    number
  children?: StatementLine[]
}

export interface IncomeStatement {
  period_from:        string
  period_to:          string
  revenue:            StatementLine[]
  cogs:               StatementLine[]
  gross_profit:       number
  operating_expenses: StatementLine[]
  operating_income:   number
  other_income:       StatementLine[]
  net_income:         number
}

export interface BalanceSheet {
  as_of_date: string
  assets: {
    current: StatementLine[]
    fixed:   StatementLine[]
    total:   number
  }
  liabilities: {
    current:    StatementLine[]
    long_term:  StatementLine[]
    total:      number
  }
  equity: {
    items: StatementLine[]
    total: number
  }
  is_balanced: boolean
}

export interface TrialBalance {
  as_of_date:    string
  lines:         TrialBalanceLine[]
  total_debit:   number
  total_credit:  number
  is_balanced:   boolean
}

export interface CashFlow {
  period_from:  string
  period_to:    string
  operating:    { items: StatementLine[]; total: number }
  investing:    { items: StatementLine[]; total: number }
  financing:    { items: StatementLine[]; total: number }
  net_change:   number
  opening_cash: number
  closing_cash: number
}

// ── Helper: fetch account balances for a period ────────────────
async function fetchAccountBalances(
  supabase:   SupabaseClient,
  company_id: string,
  date_from?: string,
  date_to?:   string,
): Promise<Map<string, { code: string; name: string; name_ar: string; type: string; subtype: string | null; normal_balance: string; account_group: string | null; debit: number; credit: number; balance: number }>> {
  // Get all postable accounts with their type info
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type, subtype, normal_balance, account_group, is_postable')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .eq('is_postable', true)
    .order('code', { ascending: true })

  // Get journal entry lines with entries filtered by date/status
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

  const { data: lines } = await query

  // Aggregate by account
  const aggregated: Record<string, { debit: number; credit: number }> = {}
  for (const line of (lines || []) as any[]) {
    const aid = line.account_id
    if (!aggregated[aid]) aggregated[aid] = { debit: 0, credit: 0 }
    aggregated[aid].debit  += Number(line.debit  || 0)
    aggregated[aid].credit += Number(line.credit || 0)
  }

  const result = new Map<string, any>()

  for (const account of (accounts || [])) {
    const agg     = aggregated[account.id] || { debit: 0, credit: 0 }
    const balance = account.normal_balance === 'debit'
      ? agg.debit - agg.credit
      : agg.credit - agg.debit

    result.set(account.id, {
      code:            account.code,
      name:            account.name,
      name_ar:         account.name_ar,
      type:            account.type,
      subtype:         account.subtype || null,
      normal_balance:  account.normal_balance,
      account_group:   account.account_group || null,
      debit:           agg.debit,
      credit:          agg.credit,
      balance,
    })
  }

  return result
}

// ── generateIncomeStatement ────────────────────────────────────
export async function generateIncomeStatement(
  supabase:   SupabaseClient,
  company_id: string,
  date_from:  string,
  date_to:    string,
): Promise<IncomeStatement> {
  const balances = await fetchAccountBalances(supabase, company_id, date_from, date_to)

  const revenue:            StatementLine[] = []
  const cogs:               StatementLine[] = []
  const operating_expenses: StatementLine[] = []
  const other_income:       StatementLine[] = []

  for (const [, acct] of balances) {
    const line: StatementLine = {
      code:    acct.code,
      name:    acct.name,
      name_ar: acct.name_ar,
      amount:  Math.abs(acct.balance),
    }

    if (acct.type === 'revenue') {
      // Sales returns reduce revenue (normal_balance is debit for contra)
      if (acct.normal_balance === 'debit') {
        // Contra-revenue (returns, discounts)
        line.amount = -Math.abs(acct.balance)
      }
      revenue.push(line)
    } else if (acct.type === 'cogs') {
      cogs.push(line)
    } else if (acct.type === 'expense') {
      // Distinguish other income accounts if they appear here
      operating_expenses.push(line)
    }
  }

  const total_revenue  = revenue.reduce((s, l) => s + l.amount, 0)
  const total_cogs     = cogs.reduce((s, l) => s + l.amount, 0)
  const gross_profit   = total_revenue - total_cogs
  const total_opex     = operating_expenses.reduce((s, l) => s + l.amount, 0)
  const operating_income = gross_profit - total_opex
  const total_other    = other_income.reduce((s, l) => s + l.amount, 0)
  const net_income     = operating_income + total_other

  return {
    period_from: date_from,
    period_to:   date_to,
    revenue,
    cogs,
    gross_profit,
    operating_expenses,
    operating_income,
    other_income,
    net_income,
  }
}

// ── generateBalanceSheet ───────────────────────────────────────
export async function generateBalanceSheet(
  supabase:    SupabaseClient,
  company_id:  string,
  as_of_date:  string,
): Promise<BalanceSheet> {
  // For balance sheet: all posted entries up to as_of_date
  const balances = await fetchAccountBalances(supabase, company_id, undefined, as_of_date)

  // Also fetch IS for retained earnings computation
  const currentYear = as_of_date.slice(0, 4)
  const yearStart   = `${currentYear}-01-01`
  const isBalances  = await fetchAccountBalances(supabase, company_id, yearStart, as_of_date)

  // Compute net income for the current period
  let netIncome = 0
  for (const [, acct] of isBalances) {
    if (acct.type === 'revenue') {
      netIncome += acct.normal_balance === 'debit' ? -acct.balance : acct.balance
    } else if (acct.type === 'cogs' || acct.type === 'expense') {
      netIncome -= Math.abs(acct.balance)
    }
  }

  const currentAssets: StatementLine[]  = []
  const fixedAssets:   StatementLine[]  = []
  const currentLiab:   StatementLine[]  = []
  const longTermLiab:  StatementLine[]  = []
  const equityItems:   StatementLine[]  = []

  // Group accounts by code range
  for (const [, acct] of balances) {
    if (Math.abs(acct.balance) < 0.001 && acct.type !== 'equity') continue

    const line: StatementLine = {
      code:    acct.code,
      name:    acct.name,
      name_ar: acct.name_ar,
      amount:  Math.abs(acct.balance),
    }

    const code = parseInt(acct.code, 10)

    if (acct.type === 'asset') {
      if (code >= 1200) {
        fixedAssets.push(line)
      } else {
        currentAssets.push(line)
      }
    } else if (acct.type === 'liability') {
      if (code >= 2200) {
        longTermLiab.push(line)
      } else {
        currentLiab.push(line)
      }
    } else if (acct.type === 'equity') {
      equityItems.push({
        ...line,
        amount: acct.normal_balance === 'credit'
          ? acct.balance
          : -acct.balance,
      })
    }
  }

  // Add net income line to equity
  if (Math.abs(netIncome) > 0.001) {
    equityItems.push({
      code:    '3099',
      name:    'Net Income (Current Period)',
      name_ar: 'صافي الدخل (الفترة الحالية)',
      amount:  netIncome,
    })
  }

  const total_assets      = currentAssets.reduce((s, l) => s + l.amount, 0) + fixedAssets.reduce((s, l) => s + l.amount, 0)
  const total_liabilities = currentLiab.reduce((s, l) => s + l.amount, 0) + longTermLiab.reduce((s, l) => s + l.amount, 0)
  const total_equity      = equityItems.reduce((s, l) => s + l.amount, 0)

  return {
    as_of_date,
    assets: {
      current: currentAssets,
      fixed:   fixedAssets,
      total:   total_assets,
    },
    liabilities: {
      current:   currentLiab,
      long_term: longTermLiab,
      total:     total_liabilities,
    },
    equity: {
      items: equityItems,
      total: total_equity,
    },
    is_balanced: Math.abs(total_assets - (total_liabilities + total_equity)) < 0.01,
  }
}

// ── generateTrialBalance ───────────────────────────────────────
export async function generateTrialBalance(
  supabase:   SupabaseClient,
  company_id: string,
  date_from?: string,
  date_to?:   string,
): Promise<TrialBalance> {
  const as_of_date = date_to || new Date().toISOString().slice(0, 10)
  const balances   = await fetchAccountBalances(supabase, company_id, date_from, date_to)

  const lines: TrialBalanceLine[] = []
  let total_debit  = 0
  let total_credit = 0

  for (const [aid, acct] of balances) {
    const netBalance = acct.balance
    if (Math.abs(acct.debit) < 0.001 && Math.abs(acct.credit) < 0.001) continue

    const closing_debit  = acct.normal_balance === 'debit'  && netBalance > 0 ? netBalance : 0
    const closing_credit = acct.normal_balance === 'credit' && netBalance > 0 ? netBalance : 0

    // If balance is negative (abnormal side)
    const closing_debit_final  = acct.normal_balance === 'debit'
      ? (netBalance >= 0 ? netBalance : 0)
      : (netBalance < 0  ? Math.abs(netBalance) : 0)
    const closing_credit_final = acct.normal_balance === 'credit'
      ? (netBalance >= 0 ? netBalance : 0)
      : (netBalance < 0  ? Math.abs(netBalance) : 0)

    total_debit  += closing_debit_final
    total_credit += closing_credit_final

    lines.push({
      account_id:     aid,
      code:           acct.code,
      name:           acct.name,
      name_ar:        acct.name_ar,
      type:           acct.type as any,
      opening_debit:  0,
      opening_credit: 0,
      period_debit:   acct.debit,
      period_credit:  acct.credit,
      closing_debit:  closing_debit_final,
      closing_credit: closing_credit_final,
      balance:        netBalance,
    })
  }

  lines.sort((a, b) => a.code.localeCompare(b.code))

  return {
    as_of_date,
    lines,
    total_debit,
    total_credit,
    is_balanced: Math.abs(total_debit - total_credit) < 0.01,
  }
}

// ── generateCashFlow ───────────────────────────────────────────
export async function generateCashFlow(
  supabase:   SupabaseClient,
  company_id: string,
  date_from:  string,
  date_to:    string,
): Promise<CashFlow> {
  // Direct method: look at cash/bank account movements

  // Get opening cash balance
  const cashAccountQuery = await supabase
    .from('accounts')
    .select('id, code, name, name_ar')
    .eq('company_id', company_id)
    .in('code', ['1101', '1102'])
    .eq('is_active', true)

  const cashAccounts = cashAccountQuery.data || []
  const cashAccountIds = cashAccounts.map((a: any) => a.id)

  // Opening balance (before date_from)
  let opening_cash = 0
  if (cashAccountIds.length > 0) {
    const { data: priorLines } = await supabase
      .from('journal_entry_lines')
      .select(`debit, credit, account_id, journal_entries!inner(date, status, company_id)`)
      .in('account_id', cashAccountIds)
      .eq('journal_entries.company_id', company_id)
      .eq('journal_entries.status', 'posted')
      .lt('journal_entries.date', date_from)

    const priorDebit  = (priorLines || []).reduce((s: number, r: any) => s + Number(r.debit  || 0), 0)
    const priorCredit = (priorLines || []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0)
    opening_cash = priorDebit - priorCredit
  }

  // Get all journal entries in period with their lines and account types
  const { data: periodLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit, account_id,
      journal_entries!inner(
        id, entry_number, date, description, source, status, company_id
      ),
      accounts!inner(type, normal_balance, code, name, name_ar)
    `)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')
    .gte('journal_entries.date', date_from)
    .lte('journal_entries.date', date_to)

  // Classify cash movements by source type
  // Operating: sales, purchases, expenses (linked to revenue/cogs/expense accounts)
  // Investing: fixed asset purchases/sales
  // Financing: loans, capital injections

  const operatingItems = new Map<string, StatementLine>()
  const investingItems = new Map<string, StatementLine>()
  const financingItems = new Map<string, StatementLine>()

  for (const row of (periodLines || []) as any[]) {
    const acct   = row.accounts
    const je     = row.journal_entries
    const debit  = Number(row.debit  || 0)
    const credit = Number(row.credit || 0)

    // Only care about cash account movements
    if (!cashAccountIds.includes(row.account_id)) continue

    const netCash = debit - credit  // positive = cash in, negative = cash out
    const source  = je.source || 'manual'
    const key     = `${source}-${je.description || ''}`

    const line: StatementLine = {
      code:    acct.code,
      name:    je.description || source,
      name_ar: je.description || source,
      amount:  netCash,
    }

    // Classify by source
    if (['pos', 'sale', 'purchase', 'expense', 'manual'].includes(source)) {
      const existing = operatingItems.get(key)
      if (existing) {
        existing.amount += netCash
      } else {
        operatingItems.set(key, { ...line })
      }
    } else if (['asset_purchase', 'asset_sale', 'investing'].includes(source)) {
      const existing = investingItems.get(key)
      if (existing) {
        existing.amount += netCash
      } else {
        investingItems.set(key, { ...line })
      }
    } else if (['loan', 'capital', 'financing'].includes(source)) {
      const existing = financingItems.get(key)
      if (existing) {
        existing.amount += netCash
      } else {
        financingItems.set(key, { ...line })
      }
    } else {
      // Default to operating
      const existing = operatingItems.get(key)
      if (existing) {
        existing.amount += netCash
      } else {
        operatingItems.set(key, { ...line })
      }
    }
  }

  const operatingArr = Array.from(operatingItems.values()).filter(i => Math.abs(i.amount) > 0.001)
  const investingArr  = Array.from(investingItems.values()).filter(i => Math.abs(i.amount) > 0.001)
  const financingArr  = Array.from(financingItems.values()).filter(i => Math.abs(i.amount) > 0.001)

  const operating_total = operatingArr.reduce((s, i) => s + i.amount, 0)
  const investing_total = investingArr.reduce((s, i)  => s + i.amount, 0)
  const financing_total = financingArr.reduce((s, i)  => s + i.amount, 0)
  const net_change      = operating_total + investing_total + financing_total
  const closing_cash    = opening_cash + net_change

  return {
    period_from:  date_from,
    period_to:    date_to,
    operating:    { items: operatingArr,  total: operating_total },
    investing:    { items: investingArr,  total: investing_total },
    financing:    { items: financingArr,  total: financing_total },
    net_change,
    opening_cash,
    closing_cash,
  }
}
