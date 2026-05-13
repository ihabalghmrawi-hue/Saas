// ============================================================
// Accounting Engine — Main Entry Point
// Re-exports everything + backward compatibility
// ============================================================

// Types
export * from './types'

// Chart of Accounts
export { ensureCOA, getAccountId, buildAccountTree, STANDARD_COA } from './coa'

// Fiscal Periods
export {
  getCurrentFiscalYear,
  getCurrentPeriod,
  ensureFiscalYear,
  ensurePeriod,
  getOrCreatePeriod,
  closePeriod,
  generatePeriods,
} from './periods'

// Journal Engine
export {
  AUTO_POST_CODES,
  generateEntryNumber,
  validateJournalEntry,
  createJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  voidJournalEntry,
} from './journal'

// General Ledger
export {
  getGeneralLedger,
  getAccountLedger,
  getAccountBalance,
  getAccountsBalances,
  recalculateAccountBalance,
} from './ledger'
export type { LedgerEntry, LedgerAccount } from './ledger'

// Financial Statements
export {
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalance,
  generateCashFlow,
} from './statements'
export type {
  StatementLine,
  IncomeStatement,
  BalanceSheet,
  TrialBalance,
  CashFlow,
} from './statements'

// Auto-Post Engine
export {
  postSaleJournal,
  postPurchaseJournal,
  postExpenseJournal,
  postSaleReturnJournal,
  postPurchaseReturnJournal,
  postCustomerPaymentJournal,
  postSupplierPaymentJournal,
  postInventoryAdjustmentJournal,
  postPayrollJournal,
} from './auto-post'

// ── Enterprise Modules ──────────────────────────────────────
export * from './enterprise-types'
export {
  PostingRulesEngine,
  allocateToCostCenters,
  allocateToBranches,
} from './posting-rules'
export {
  ReconciliationEngine,
  getAgedReceivables,
  getAgedPayables,
  getCustomerBalances,
  getSupplierBalances,
} from './reconciliation'
export { RecurringJournalEngine } from './recurring'
export { AIAccountingEngine } from './ai-accounting'
export { AccountingEventBus, processRecurringJournals, suggestReconciliations, runIntegrityChecks } from './event-bus'

// ── Backward Compatibility Aliases ────────────────────────────
export { postSaleJournal     as postSaleEntry     } from './auto-post'
export { postPurchaseJournal as postPurchaseEntry } from './auto-post'
export { postExpenseJournal  as postExpenseEntry  } from './auto-post'

// Re-export updateWallet (copied inline for backward compatibility)
import type { SupabaseClient } from '@supabase/supabase-js'

export async function updateWallet(
  supabase:       SupabaseClient,
  company_id:     string,
  amount:         number,
  description:    string,
  reference_id:   string,
  reference_type: string,
  payment_method = 'cash',
  wallet_id?:     string,
): Promise<{ ok: boolean; error?: string; new_balance?: number }> {
  let query = supabase
    .from('wallets')
    .select('id, current_balance')
    .eq('company_id', company_id)
    .eq('is_active', true)

  if (wallet_id) {
    query = query.eq('id', wallet_id)
  } else {
    query = query.eq('is_default', true)
  }

  const { data: wallet } = await (query.maybeSingle() as any)

  if (!wallet) {
    const { data: newWallet, error: wErr } = await supabase
      .from('wallets')
      .insert({
        company_id,
        name:            'الصندوق الرئيسي',
        name_ar:         'الصندوق الرئيسي',
        type:            'cash',
        current_balance: 0,
        initial_balance: 0,
        is_default:      true,
        is_active:       true,
      })
      .select('id, current_balance')
      .single()

    if (wErr || !newWallet) {
      return { ok: false, error: `فشل إنشاء الصندوق: ${wErr?.message}` }
    }
    return updateWallet(supabase, company_id, amount, description, reference_id, reference_type, payment_method, newWallet.id)
  }

  const new_balance = Number(wallet.current_balance || 0) + amount
  const { error: updateErr } = await supabase
    .from('wallets')
    .update({ current_balance: new_balance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id)

  if (updateErr) return { ok: false, error: `فشل تحديث الصندوق: ${updateErr.message}` }

  await supabase.from('transactions').insert({
    company_id,
    wallet_id:        wallet.id,
    type:             amount >= 0 ? 'income' : 'expense',
    amount:           Math.abs(amount),
    description,
    description_ar:   description,
    reference_id,
    reference_type,
    payment_method,
    transaction_date: new Date().toISOString().slice(0, 10),
    status:           'completed',
  })

  return { ok: true, new_balance }
}
