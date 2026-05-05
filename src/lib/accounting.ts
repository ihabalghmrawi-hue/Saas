/**
 * Accounting Engine
 *
 * Enforces double-entry accounting for every financial transaction.
 * Auto-provisions chart of accounts if missing.
 * Never fails silently — returns structured errors.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Standard account codes used by this system
export const ACCOUNT_CODES = {
  CASH:        '1001',
  BANK:        '1002',
  RECEIVABLES: '1100',
  INVENTORY:   '1200',
  PAYABLES:    '2001',
  REVENUE:     '4001',
  COGS:        '5001',
  EXPENSES:    '5100',
} as const

type AccountCode = typeof ACCOUNT_CODES[keyof typeof ACCOUNT_CODES]

export interface AccountRow {
  id: string
  code: string
  name: string
  name_ar: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
}

export interface JournalLine {
  account_code: AccountCode
  debit:        number
  credit:       number
  description:  string
}

export interface AccountingResult {
  ok:            boolean
  error?:        string
  journal_id?:   string
  accounts_created?: boolean
}

// ── Default chart of accounts ─────────────────────────────────────────────────
const DEFAULT_ACCOUNTS: Omit<AccountRow, 'id'>[] = [
  { code: '1001', name: 'Cash',                name_ar: 'الصندوق',             type: 'asset'     },
  { code: '1002', name: 'Bank',                name_ar: 'البنك',               type: 'asset'     },
  { code: '1100', name: 'Accounts Receivable', name_ar: 'ذمم مدينة',           type: 'asset'     },
  { code: '1200', name: 'Inventory',           name_ar: 'المخزون',             type: 'asset'     },
  { code: '2001', name: 'Accounts Payable',    name_ar: 'ذمم دائنة',           type: 'liability' },
  { code: '4001', name: 'Sales Revenue',       name_ar: 'إيرادات المبيعات',    type: 'revenue'   },
  { code: '5001', name: 'Cost of Goods Sold',  name_ar: 'تكلفة البضاعة المباعة', type: 'expense' },
  { code: '5100', name: 'Operating Expenses',  name_ar: 'المصروفات التشغيلية', type: 'expense'   },
]

// ── Ensure chart of accounts exists (auto-provision if missing) ───────────────
export async function ensureAccounts(
  supabase: SupabaseClient,
  company_id: string,
): Promise<{ accounts: AccountRow[]; created: boolean }> {
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type')
    .eq('company_id', company_id)
    .eq('is_active', true)

  if (existing && existing.length >= DEFAULT_ACCOUNTS.length) {
    return { accounts: existing as AccountRow[], created: false }
  }

  // Find which codes are missing
  const existingCodes = new Set((existing || []).map((a: any) => a.code))
  const missing = DEFAULT_ACCOUNTS.filter(a => !existingCodes.has(a.code))

  if (missing.length > 0) {
    const { error } = await supabase.from('accounts').insert(
      missing.map(a => ({ ...a, company_id, is_active: true }))
    )
    if (error) throw new Error(`فشل إنشاء دليل الحسابات: ${error.message}`)
  }

  const { data: all } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type')
    .eq('company_id', company_id)
    .eq('is_active', true)

  return { accounts: (all || []) as AccountRow[], created: missing.length > 0 }
}

// ── Core: post a journal entry ────────────────────────────────────────────────
export async function postJournalEntry(
  supabase:     SupabaseClient,
  company_id:   string,
  description:  string,
  reference:    string,
  source:       string,
  source_id:    string,
  lines:        JournalLine[],
): Promise<AccountingResult> {
  // 1. Validate balanced entry
  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { ok: false, error: `القيد غير متوازن: مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}` }
  }

  // 2. Ensure accounts exist
  let accounts: AccountRow[]
  let accounts_created = false
  try {
    const result = await ensureAccounts(supabase, company_id)
    accounts         = result.accounts
    accounts_created = result.created
  } catch (e: any) {
    return { ok: false, error: e.message }
  }

  const accountByCode = Object.fromEntries(accounts.map(a => [a.code, a]))

  // 3. Validate all codes exist
  for (const line of lines) {
    if (!accountByCode[line.account_code]) {
      return { ok: false, error: `حساب غير موجود: ${line.account_code}` }
    }
  }

  // 4. Insert journal entry
  const { data: entry, error: entryErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id,
      date:        new Date().toISOString().slice(0, 10),
      description,
      reference,
      source,
      source_id,
      is_posted:   true,
    })
    .select('id')
    .single()

  if (entryErr || !entry) {
    return { ok: false, error: `فشل إنشاء القيد: ${entryErr?.message}` }
  }

  // 5. Insert journal lines
  const { error: linesErr } = await supabase.from('journal_entry_lines').insert(
    lines.map(l => ({
      journal_entry_id: entry.id,
      account_id:       accountByCode[l.account_code].id,
      debit:            l.debit,
      credit:           l.credit,
      description:      l.description,
    }))
  )

  if (linesErr) {
    // Rollback the entry header
    await supabase.from('journal_entries').delete().eq('id', entry.id)
    return { ok: false, error: `فشل إدراج بنود القيد: ${linesErr.message}` }
  }

  return { ok: true, journal_id: entry.id, accounts_created }
}

// ── Sale journal entry ─────────────────────────────────────────────────────────
// Debit: Cash (paid) + Receivables (due)
// Credit: Revenue (total)
export async function postSaleEntry(
  supabase:       SupabaseClient,
  company_id:     string,
  invoice_number: string,
  sale_id:        string,
  total:          number,
  paid_amount:    number,
  due_amount:     number,
): Promise<AccountingResult> {
  const lines: JournalLine[] = []

  if (paid_amount > 0) {
    lines.push({
      account_code: ACCOUNT_CODES.CASH,
      debit:        paid_amount,
      credit:       0,
      description:  `نقد - ${invoice_number}`,
    })
  }
  if (due_amount > 0) {
    lines.push({
      account_code: ACCOUNT_CODES.RECEIVABLES,
      debit:        due_amount,
      credit:       0,
      description:  `ذمم مدينة - ${invoice_number}`,
    })
  }
  lines.push({
    account_code: ACCOUNT_CODES.REVENUE,
    debit:        0,
    credit:       total,
    description:  `إيراد مبيعات - ${invoice_number}`,
  })

  return postJournalEntry(
    supabase, company_id,
    `مبيعات - فاتورة ${invoice_number}`,
    invoice_number, 'pos', sale_id, lines,
  )
}

// ── Purchase journal entry ────────────────────────────────────────────────────
// Debit: Inventory (total)
// Credit: Cash (paid) + Payables (due)
export async function postPurchaseEntry(
  supabase:       SupabaseClient,
  company_id:     string,
  invoice_number: string,
  purchase_id:    string,
  total:          number,
  paid_amount:    number,
  due_amount:     number,
): Promise<AccountingResult> {
  const lines: JournalLine[] = [
    {
      account_code: ACCOUNT_CODES.INVENTORY,
      debit:        total,
      credit:       0,
      description:  `بضاعة واردة - ${invoice_number}`,
    },
  ]

  if (paid_amount > 0) {
    lines.push({
      account_code: ACCOUNT_CODES.CASH,
      debit:        0,
      credit:       paid_amount,
      description:  `نقد - ${invoice_number}`,
    })
  }
  if (due_amount > 0) {
    lines.push({
      account_code: ACCOUNT_CODES.PAYABLES,
      debit:        0,
      credit:       due_amount,
      description:  `ذمم دائنة - ${invoice_number}`,
    })
  }

  return postJournalEntry(
    supabase, company_id,
    `مشتريات - فاتورة ${invoice_number}`,
    invoice_number, 'purchase', purchase_id, lines,
  )
}

// ── Expense journal entry ─────────────────────────────────────────────────────
// Debit: Expenses
// Credit: Cash
export async function postExpenseEntry(
  supabase:    SupabaseClient,
  company_id:  string,
  description: string,
  expense_id:  string,
  amount:      number,
): Promise<AccountingResult> {
  return postJournalEntry(
    supabase, company_id,
    `مصروف: ${description}`,
    expense_id, 'expense', expense_id,
    [
      { account_code: ACCOUNT_CODES.EXPENSES, debit: amount,  credit: 0,      description },
      { account_code: ACCOUNT_CODES.CASH,     debit: 0,       credit: amount, description },
    ],
  )
}

// ── Update wallet balance (cash register) ────────────────────────────────────
export async function updateWallet(
  supabase:        SupabaseClient,
  company_id:      string,
  amount:          number,          // positive = income, negative = expense
  description:     string,
  reference_id:    string,
  reference_type:  string,
  payment_method = 'cash',
): Promise<{ ok: boolean; error?: string; new_balance?: number }> {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle()

  if (!wallet) {
    // Auto-create default wallet
    const { data: newWallet, error: wErr } = await supabase
      .from('wallets')
      .insert({
        company_id,
        name:       'الصندوق الرئيسي',
        balance:    0,
        is_default: true,
        is_active:  true,
      })
      .select('id, balance')
      .single()

    if (wErr || !newWallet) {
      return { ok: false, error: `فشل إنشاء الصندوق: ${wErr?.message}` }
    }
    return updateWallet(supabase, company_id, amount, description, reference_id, reference_type, payment_method)
  }

  const new_balance = Number(wallet.balance || 0) + amount
  const { error: updateErr } = await supabase
    .from('wallets')
    .update({ balance: new_balance })
    .eq('id', wallet.id)

  if (updateErr) return { ok: false, error: `فشل تحديث الصندوق: ${updateErr.message}` }

  await supabase.from('transactions').insert({
    company_id,
    wallet_id:        wallet.id,
    type:             amount >= 0 ? 'income' : 'expense',
    amount:           Math.abs(amount),
    description,
    reference_id,
    reference_type,
    payment_method,
    transaction_date: new Date().toISOString().slice(0, 10),
    status:           'completed',
  })

  return { ok: true, new_balance }
}
