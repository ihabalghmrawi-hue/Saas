// ============================================================
// Auto-Posting Engine — All Business Operations
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostingResult, JournalLine } from './types'
import { createJournalEntry, AUTO_POST_CODES } from './journal'

// ── postSaleJournal ────────────────────────────────────────────
export async function postSaleJournal(
  supabase: SupabaseClient,
  params: {
    company_id:      string
    invoice_number:  string
    sale_id:         string
    total:           number
    paid_amount:     number
    due_amount:      number
    tax_amount?:     number
    cost_amount?:    number
    wallet_id?:      string
    payment_method?: string
  },
): Promise<PostingResult> {
  const {
    company_id, invoice_number, sale_id,
    total, paid_amount, due_amount,
    tax_amount = 0, cost_amount = 0,
  } = params

  const net_revenue = total - tax_amount
  const lines: JournalLine[] = []

  // Debit: Cash (paid portion)
  if (paid_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.CASH,
      debit:        paid_amount,
      credit:       0,
      description:  `نقد - فاتورة ${invoice_number}`,
    })
  }

  // Debit: Accounts Receivable (due portion)
  if (due_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.RECEIVABLE,
      debit:        due_amount,
      credit:       0,
      description:  `ذمم مدينة - فاتورة ${invoice_number}`,
    })
  }

  // Credit: Sales Revenue (net of tax)
  if (net_revenue > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.SALES,
      debit:        0,
      credit:       net_revenue,
      description:  `إيرادات مبيعات - فاتورة ${invoice_number}`,
    })
  }

  // Credit: VAT Payable
  if (tax_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.VAT_PAYABLE,
      debit:        0,
      credit:       tax_amount,
      description:  `ضريبة القيمة المضافة - فاتورة ${invoice_number}`,
    })
  }

  // Handle COGS entry (if cost_amount provided)
  if (cost_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.COGS,
      debit:        cost_amount,
      credit:       0,
      description:  `تكلفة البضاعة المباعة - فاتورة ${invoice_number}`,
    })
    lines.push({
      account_code: AUTO_POST_CODES.INVENTORY,
      debit:        0,
      credit:       cost_amount,
      description:  `مخزون - فاتورة ${invoice_number}`,
    })
  }

  return createJournalEntry(supabase, {
    company_id,
    description:     `مبيعات - فاتورة ${invoice_number}`,
    description_ar:  `مبيعات - فاتورة ${invoice_number}`,
    reference:       invoice_number,
    source:          'pos',
    source_id:       sale_id,
    source_document: invoice_number,
    lines,
    auto_generated:  true,
  })
}

// ── postPurchaseJournal ────────────────────────────────────────
export async function postPurchaseJournal(
  supabase: SupabaseClient,
  params: {
    company_id:     string
    invoice_number: string
    purchase_id:    string
    total:          number
    paid_amount:    number
    due_amount:     number
    tax_amount?:    number
    wallet_id?:     string
  },
): Promise<PostingResult> {
  const {
    company_id, invoice_number, purchase_id,
    total, paid_amount, due_amount, tax_amount = 0,
  } = params

  const inventory_amount = total - tax_amount
  const lines: JournalLine[] = []

  // Debit: Inventory (net of tax)
  if (inventory_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.INVENTORY,
      debit:        inventory_amount,
      credit:       0,
      description:  `بضاعة واردة - فاتورة ${invoice_number}`,
    })
  }

  // Debit: Input VAT
  if (tax_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.INPUT_VAT,
      debit:        tax_amount,
      credit:       0,
      description:  `ضريبة مدخلات - فاتورة ${invoice_number}`,
    })
  }

  // Credit: Cash (paid portion)
  if (paid_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.CASH,
      debit:        0,
      credit:       paid_amount,
      description:  `نقد - فاتورة ${invoice_number}`,
    })
  }

  // Credit: Accounts Payable (due portion)
  if (due_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.PAYABLE,
      debit:        0,
      credit:       due_amount,
      description:  `ذمم دائنة - فاتورة ${invoice_number}`,
    })
  }

  return createJournalEntry(supabase, {
    company_id,
    description:     `مشتريات - فاتورة ${invoice_number}`,
    description_ar:  `مشتريات - فاتورة ${invoice_number}`,
    reference:       invoice_number,
    source:          'purchase',
    source_id:       purchase_id,
    source_document: invoice_number,
    lines,
    auto_generated:  true,
  })
}

// ── postExpenseJournal ─────────────────────────────────────────
export async function postExpenseJournal(
  supabase: SupabaseClient,
  params: {
    company_id:          string
    expense_id:          string
    description:         string
    amount:              number
    expense_account_code?: string
    wallet_id?:          string
    payment_method?:     string
  },
): Promise<PostingResult> {
  const {
    company_id, expense_id, description,
    amount, expense_account_code = AUTO_POST_CODES.MISC_EXP,
  } = params

  const lines: JournalLine[] = [
    {
      account_code: expense_account_code,
      debit:        amount,
      credit:       0,
      description:  `مصروف: ${description}`,
    },
    {
      account_code: AUTO_POST_CODES.CASH,
      debit:        0,
      credit:       amount,
      description:  `نقد - ${description}`,
    },
  ]

  return createJournalEntry(supabase, {
    company_id,
    description:     `مصروف: ${description}`,
    description_ar:  `مصروف: ${description}`,
    reference:       expense_id,
    source:          'expense',
    source_id:       expense_id,
    lines,
    auto_generated:  true,
  })
}

// ── postSaleReturnJournal ──────────────────────────────────────
export async function postSaleReturnJournal(
  supabase: SupabaseClient,
  params: {
    company_id:      string
    return_id:       string
    original_sale_id: string
    total:           number
    refund_amount:   number
    cost_amount?:    number
  },
): Promise<PostingResult> {
  const {
    company_id, return_id, original_sale_id,
    total, refund_amount, cost_amount = 0,
  } = params

  const ar_amount = total - refund_amount
  const lines: JournalLine[] = []

  // Debit: Sales Returns
  lines.push({
    account_code: AUTO_POST_CODES.SALES_RETURNS,
    debit:        total,
    credit:       0,
    description:  `مردودات مبيعات - مرتجع ${return_id}`,
  })

  // Credit: Cash (refunded portion)
  if (refund_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.CASH,
      debit:        0,
      credit:       refund_amount,
      description:  `استرداد نقدي - مرتجع ${return_id}`,
    })
  }

  // Credit: Accounts Receivable (remaining portion)
  if (ar_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.RECEIVABLE,
      debit:        0,
      credit:       ar_amount,
      description:  `تخفيض ذمم - مرتجع ${return_id}`,
    })
  }

  // If cost amount: reverse COGS (DR Inventory, CR COGS)
  if (cost_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.INVENTORY,
      debit:        cost_amount,
      credit:       0,
      description:  `إعادة مخزون - مرتجع ${return_id}`,
    })
    lines.push({
      account_code: AUTO_POST_CODES.COGS,
      debit:        0,
      credit:       cost_amount,
      description:  `عكس تكلفة - مرتجع ${return_id}`,
    })
  }

  return createJournalEntry(supabase, {
    company_id,
    description:     `مردودات مبيعات - ${return_id}`,
    description_ar:  `مردودات مبيعات - ${return_id}`,
    reference:       return_id,
    source:          'sale_return',
    source_id:       return_id,
    lines,
    auto_generated:  true,
  })
}

// ── postPurchaseReturnJournal ──────────────────────────────────
export async function postPurchaseReturnJournal(
  supabase: SupabaseClient,
  params: {
    company_id:    string
    return_id:     string
    total:         number
    refund_amount: number
  },
): Promise<PostingResult> {
  const { company_id, return_id, total, refund_amount } = params
  const ap_amount = total - refund_amount
  const lines: JournalLine[] = []

  // Debit: Accounts Payable (reduce AP)
  if (ap_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.PAYABLE,
      debit:        ap_amount,
      credit:       0,
      description:  `تخفيض ذمم دائنة - مرتجع مشتريات ${return_id}`,
    })
  }

  // Debit: Cash (if cash refund received)
  if (refund_amount > 0) {
    lines.push({
      account_code: AUTO_POST_CODES.CASH,
      debit:        refund_amount,
      credit:       0,
      description:  `استرداد نقدي - مرتجع مشتريات ${return_id}`,
    })
  }

  // Credit: Purchase Returns
  lines.push({
    account_code: AUTO_POST_CODES.PURCHASE_RETURNS,
    debit:        0,
    credit:       total,
    description:  `مردودات مشتريات - ${return_id}`,
  })

  return createJournalEntry(supabase, {
    company_id,
    description:     `مردودات مشتريات - ${return_id}`,
    description_ar:  `مردودات مشتريات - ${return_id}`,
    reference:       return_id,
    source:          'purchase_return',
    source_id:       return_id,
    lines,
    auto_generated:  true,
  })
}

// ── postCustomerPaymentJournal ─────────────────────────────────
export async function postCustomerPaymentJournal(
  supabase: SupabaseClient,
  params: {
    company_id:   string
    customer_id:  string
    amount:       number
    payment_id:   string
    invoice_ref?: string
  },
): Promise<PostingResult> {
  const { company_id, customer_id, amount, payment_id, invoice_ref } = params

  const lines: JournalLine[] = [
    {
      account_code: AUTO_POST_CODES.CASH,
      debit:        amount,
      credit:       0,
      description:  `تحصيل من عميل - ${invoice_ref || customer_id}`,
    },
    {
      account_code: AUTO_POST_CODES.RECEIVABLE,
      debit:        0,
      credit:       amount,
      description:  `سداد ذمم مدينة - ${invoice_ref || customer_id}`,
    },
  ]

  return createJournalEntry(supabase, {
    company_id,
    description:     `تحصيل من عميل - ${invoice_ref || payment_id}`,
    description_ar:  `تحصيل من عميل - ${invoice_ref || payment_id}`,
    reference:       payment_id,
    source:          'customer_payment',
    source_id:       payment_id,
    lines,
    auto_generated:  true,
  })
}

// ── postSupplierPaymentJournal ─────────────────────────────────
export async function postSupplierPaymentJournal(
  supabase: SupabaseClient,
  params: {
    company_id:   string
    supplier_id:  string
    amount:       number
    payment_id:   string
    invoice_ref?: string
  },
): Promise<PostingResult> {
  const { company_id, supplier_id, amount, payment_id, invoice_ref } = params

  const lines: JournalLine[] = [
    {
      account_code: AUTO_POST_CODES.PAYABLE,
      debit:        amount,
      credit:       0,
      description:  `سداد لمورد - ${invoice_ref || supplier_id}`,
    },
    {
      account_code: AUTO_POST_CODES.CASH,
      debit:        0,
      credit:       amount,
      description:  `نقد - دفع لمورد - ${invoice_ref || supplier_id}`,
    },
  ]

  return createJournalEntry(supabase, {
    company_id,
    description:     `دفع لمورد - ${invoice_ref || payment_id}`,
    description_ar:  `دفع لمورد - ${invoice_ref || payment_id}`,
    reference:       payment_id,
    source:          'supplier_payment',
    source_id:       payment_id,
    lines,
    auto_generated:  true,
  })
}

// ── postInventoryAdjustmentJournal ─────────────────────────────
export async function postInventoryAdjustmentJournal(
  supabase: SupabaseClient,
  params: {
    company_id:  string
    product_id:  string
    warehouse_id?: string
    qty_change:  number
    unit_cost:   number
    notes?:      string
  },
): Promise<PostingResult> {
  const { company_id, product_id, qty_change, unit_cost, notes } = params

  const amount   = Math.abs(qty_change * unit_cost)
  const isIncrease = qty_change > 0
  const adjRef   = `ADJ-${product_id}-${Date.now()}`
  const lines: JournalLine[] = []

  if (isIncrease) {
    // DR Inventory, CR Retained Earnings (inventory surplus)
    lines.push({
      account_code: AUTO_POST_CODES.INVENTORY,
      debit:        amount,
      credit:       0,
      description:  `تسوية مخزون (زيادة) - ${notes || product_id}`,
    })
    lines.push({
      account_code: AUTO_POST_CODES.RETAINED,
      debit:        0,
      credit:       amount,
      description:  `مقابل زيادة مخزون - ${notes || product_id}`,
    })
  } else {
    // DR Inventory Write-off (expense), CR Inventory
    lines.push({
      account_code: AUTO_POST_CODES.INV_WRITEOFF,
      debit:        amount,
      credit:       0,
      description:  `هالك/نقص مخزون - ${notes || product_id}`,
    })
    lines.push({
      account_code: AUTO_POST_CODES.INVENTORY,
      debit:        0,
      credit:       amount,
      description:  `تخفيض مخزون - ${notes || product_id}`,
    })
  }

  return createJournalEntry(supabase, {
    company_id,
    description:     `تسوية مخزون - ${notes || product_id}`,
    description_ar:  `تسوية مخزون - ${notes || product_id}`,
    reference:       adjRef,
    source:          'inventory_adjustment',
    source_id:       product_id,
    lines,
    auto_generated:  true,
  })
}

// ── postPayrollJournal ─────────────────────────────────────────
export async function postPayrollJournal(
  supabase: SupabaseClient,
  params: {
    company_id:  string
    payroll_id:  string
    gross_amount: number
    net_amount:  number
    deductions:  number
  },
): Promise<PostingResult> {
  const { company_id, payroll_id, gross_amount, net_amount, deductions } = params

  const lines: JournalLine[] = [
    // DR Salaries Expense (gross)
    {
      account_code: AUTO_POST_CODES.SALARIES_EXP,
      debit:        gross_amount,
      credit:       0,
      description:  `رواتب وأجور - كشف ${payroll_id}`,
    },
    // CR Salaries Payable (net to be paid)
    {
      account_code: AUTO_POST_CODES.SALARIES_PAYABLE,
      debit:        0,
      credit:       net_amount,
      description:  `رواتب مستحقة - كشف ${payroll_id}`,
    },
  ]

  // CR Deductions (if any — withheld taxes, insurance etc.)
  if (deductions > 0.001) {
    lines.push({
      account_code: AUTO_POST_CODES.ACCRUED_EXP,
      debit:        0,
      credit:       deductions,
      description:  `استقطاعات الرواتب - كشف ${payroll_id}`,
    })
  }

  return createJournalEntry(supabase, {
    company_id,
    description:     `كشف رواتب - ${payroll_id}`,
    description_ar:  `كشف رواتب - ${payroll_id}`,
    reference:       payroll_id,
    source:          'payroll',
    source_id:       payroll_id,
    lines,
    auto_generated:  true,
  })
}
