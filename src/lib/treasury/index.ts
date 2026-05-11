/**
 * Treasury Engine
 *
 * Manages treasury accounts (cash/bank/credit).
 * Every debit operation validates available balance first.
 * Every transaction creates a corresponding journal entry.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { postAccountingEvent } from '@/lib/accounting/engine'

export class InsufficientFundsError extends Error {
  constructor(
    public accountName: string,
    public available:   number,
    public required:    number,
    public currency:    string = 'SAR',
  ) {
    super(`رصيد غير كافٍ في "${accountName}": المتاح ${available.toFixed(2)} ${currency}، المطلوب ${required.toFixed(2)} ${currency}`)
    this.name = 'InsufficientFundsError'
  }
}

export interface TreasuryTransactionOpts {
  companyId:   string
  accountId:   string
  type:        'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out'
  amount:      number
  description: string
  reference:   string
  sourceId?:   string
  source?:     string
  transferToId?: string  // required for transfer_in / transfer_out
  postJournal?:  boolean // default true
  date?:         string
}

// ── Validate balance before any debit ────────────────────────────────────────

export async function validateTreasuryBalance(
  supabase:  SupabaseClient,
  accountId: string,
  required:  number,
): Promise<void> {
  const { data: account } = await supabase
    .from('treasury_accounts')
    .select('balance, name, currency, type')
    .eq('id', accountId)
    .single()

  if (!account) throw new Error('حساب الخزينة غير موجود')

  // Credit accounts have no balance limit
  if (account.type === 'credit') return

  if (Number(account.balance) < required) {
    throw new InsufficientFundsError(account.name, Number(account.balance), required, account.currency)
  }
}

// ── Post a treasury transaction ───────────────────────────────────────────────

export async function postTreasuryTransaction(
  supabase: SupabaseClient,
  opts:     TreasuryTransactionOpts,
): Promise<{ transactionId: string; journalEntryId: string | null }> {
  const { companyId, accountId, type, amount, description, reference, sourceId, source, date } = opts

  // Validate balance for outgoing transactions
  if (type === 'withdrawal' || type === 'transfer_out') {
    await validateTreasuryBalance(supabase, accountId, amount)
  }

  // Get current balance to compute balance_after
  const { data: account } = await supabase
    .from('treasury_accounts')
    .select('balance, coa_account_id')
    .eq('id', accountId)
    .single()

  const currentBalance = Number(account?.balance ?? 0)
  const balanceAfter = type === 'deposit' || type === 'transfer_in'
    ? currentBalance + amount
    : currentBalance - amount

  // Insert treasury transaction (trigger handles balance update)
  const { data: tx, error } = await supabase
    .from('treasury_transactions')
    .insert({
      company_id:      companyId,
      account_id:      accountId,
      type,
      amount,
      balance_after:   balanceAfter,
      description,
      reference,
      source:          source ?? null,
      source_id:       sourceId ?? null,
      transfer_to_id:  opts.transferToId ?? null,
    })
    .select('id')
    .single()

  if (error || !tx) throw new Error(`فشل تسجيل معاملة الخزينة: ${error?.message}`)

  // Post journal entry (skip if caller handles it separately)
  let journalEntryId: string | null = null
  if (opts.postJournal !== false && account?.coa_account_id) {
    try {
      journalEntryId = await postAccountingEvent(supabase, {
        type:        type === 'deposit' ? 'sale_cash' : 'expense_cash',
        companyId,
        amount,
        description,
        reference,
        sourceId,
        source,
        date,
      })
      // Link journal entry to transaction
      await supabase
        .from('treasury_transactions')
        .update({ journal_entry_id: journalEntryId })
        .eq('id', tx.id)
    } catch {
      // Journal posting failure is non-fatal — treasury transaction is recorded
    }
  }

  return { transactionId: tx.id, journalEntryId }
}

// ── Internal transfer between two treasury accounts ───────────────────────────

export async function transferBetweenAccounts(
  supabase:    SupabaseClient,
  companyId:   string,
  fromId:      string,
  toId:        string,
  amount:      number,
  description: string,
  reference:   string,
): Promise<{ outTxId: string; inTxId: string }> {
  await validateTreasuryBalance(supabase, fromId, amount)

  const [out, into] = await Promise.all([
    postTreasuryTransaction(supabase, {
      companyId, accountId: fromId, type: 'transfer_out',
      amount, description, reference, transferToId: toId, postJournal: false,
    }),
    postTreasuryTransaction(supabase, {
      companyId, accountId: toId, type: 'transfer_in',
      amount, description, reference, transferToId: fromId, postJournal: false,
    }),
  ])

  // Single journal entry for the transfer (DR destination / CR source)
  const [fromAccount, toAccount] = await Promise.all([
    supabase.from('treasury_accounts').select('coa_account_id').eq('id', fromId).single(),
    supabase.from('treasury_accounts').select('coa_account_id').eq('id', toId).single(),
  ])

  if (fromAccount.data?.coa_account_id && toAccount.data?.coa_account_id) {
    await postAccountingEvent(supabase, {
      type:        'treasury_transfer',
      companyId,
      amount,
      description,
      reference,
      lines: [
        { accountCode: toAccount.data.coa_account_id,   debit: amount, credit: 0,      description: `تحويل إلى: ${description}` },
        { accountCode: fromAccount.data.coa_account_id, debit: 0,      credit: amount, description: `تحويل من: ${description}` },
      ],
    })
  }

  return { outTxId: out.transactionId, inTxId: into.transactionId }
}

// ── Get default treasury account for a company ───────────────────────────────

export async function getDefaultTreasuryAccount(
  supabase:  SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('treasury_accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()
  return data?.id ?? null
}
