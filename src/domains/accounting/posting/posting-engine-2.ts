import type { SupabaseClient } from '@supabase/supabase-js'
import { JournalEngine } from '../services/journal-engine.service'
import { PostingRuleRepository, AccountMappingRepository } from '../repositories/posting-rule.repository'
import { AccountRepository } from '../repositories/account.repository'
import { AccountingEventBus } from '../events/event-bus'
import type { AccountingEventType } from '../types'
import type { PostJournalResult } from '../entities/journal.entity'
import type { ServiceResult } from '../types'

export interface PostingLine {
  accountCode?: string
  accountId?: string
  debit: number
  credit: number
  description?: string
  costCenterId?: string
  branchId?: string
}

export interface PostingContext {
  type: AccountingEventType
  companyId: string
  amount: number
  description: string
  reference?: string
  sourceId?: string
  date?: string
  lines?: PostingLine[]
  debitAccountCode?: string
  creditAccountCode?: string
  branchId?: string
  costCenterId?: string
  createdById?: string
  currency?: string
  exchangeRate?: number
  metadata?: Record<string, unknown>
}

const DEFAULT_MAPPINGS: Record<string, [string, string]> = {
  sale_cash:              ['1101', '4001'],
  sale_credit:            ['1110', '4001'],
  sale_cogs:              ['5001', '1120'],
  sale_payment:           ['1101', '1110'],
  sale_return_cash:       ['4001', '1101'],
  sale_return_credit:     ['4001', '1110'],
  sale_return_cogs:       ['1120', '5001'],
  purchase_cash:          ['1120', '1101'],
  purchase_credit:        ['1120', '2101'],
  purchase_payment:       ['2101', '1101'],
  expense_cash:           ['6501', '1101'],
  expense_accrual:        ['6501', '2101'],
  treasury_transfer:      ['1101', '1102'],
  rental_revenue:         ['1101', '4001'],
  inventory_adjustment:   ['1120', '6502'],
  construction_expense:   ['6101', '1101'],
  customer_payment:       ['1101', '1110'],
  supplier_payment:       ['2101', '1101'],
  payroll:                ['6101', '1101'],
  manual:                 ['6501', '1101'],
}

export class PostingEngine {
  private readonly journalEngine: JournalEngine
  private readonly postingRuleRepo: PostingRuleRepository
  private readonly accountMappingRepo: AccountMappingRepository
  private readonly accountRepo: AccountRepository
  private readonly eventBus: AccountingEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.journalEngine = new JournalEngine(db, companyId)
    this.postingRuleRepo = new PostingRuleRepository(db, companyId)
    this.accountMappingRepo = new AccountMappingRepository(db, companyId)
    this.accountRepo = new AccountRepository(db, companyId)
    this.eventBus = AccountingEventBus.getInstance()
  }

  async post(ctx: PostingContext): Promise<ServiceResult<PostJournalResult>> {
    const lines = ctx.lines?.length
      ? ctx.lines.map(l => ({
          account_code: l.accountCode,
          account_id: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description || ctx.description,
          cost_center_id: l.costCenterId || ctx.costCenterId,
          branch_id: l.branchId || ctx.branchId,
        }))
      : await this.resolveLines(ctx)

    if (lines.length === 0) {
      return { ok: false, error: 'لا يمكن تحديد حسابات الترحيل', code: 'NO_LINES' }
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return {
        ok: false,
        error: `القيد غير متوازن: مدين=${totalDebit.toFixed(2)} دائن=${totalCredit.toFixed(2)}`,
        code: 'UNBALANCED',
      }
    }

    return this.journalEngine.create(
      {
        company_id: this.companyId,
        description: ctx.description,
        reference: ctx.reference,
        source: this.deriveSource(ctx.type),
        source_id: ctx.sourceId,
        date: ctx.date,
        lines,
        branch_id: ctx.branchId,
        cost_center_id: ctx.costCenterId,
        created_by_id: ctx.createdById,
        currency: ctx.currency || 'SAR',
        exchange_rate: ctx.exchangeRate || 1,
      },
      { skipValidation: true },
    )
  }

  private async resolveLines(ctx: PostingContext): Promise<Array<{
    account_code: string
    account_id?: string
    debit: number
    credit: number
    description?: string
    cost_center_id?: string
    branch_id?: string
  }>> {
    const rules = await this.postingRuleRepo.findByEvent(ctx.type)
    if (rules.length > 0) {
      return this.applyRules(rules, ctx)
    }

    const mapping = await this.accountMappingRepo.findByEvent(ctx.type)
    if (mapping) {
      const debitAccount = await this.accountRepo.findActiveById(mapping.debit_account_id)
      const creditAccount = await this.accountRepo.findActiveById(mapping.credit_account_id)
      if (debitAccount && creditAccount) {
        return [
          { account_code: debitAccount.code, debit: ctx.amount, credit: 0, description: ctx.description },
          { account_code: creditAccount.code, debit: 0, credit: ctx.amount, description: ctx.description },
        ]
      }
    }

    const [defaultDebit, defaultCredit] = DEFAULT_MAPPINGS[ctx.type] || ['6501', '1101']
    return [
      {
        account_code: ctx.debitAccountCode || defaultDebit,
        debit: ctx.amount,
        credit: 0,
        description: ctx.description,
      },
      {
        account_code: ctx.creditAccountCode || defaultCredit,
        debit: 0,
        credit: ctx.amount,
        description: ctx.description,
      },
    ]
  }

  private applyRules(
    rules: any[],
    ctx: PostingContext,
  ): Array<{ account_code: string; debit: number; credit: number; description?: string }> {
    const lines: Array<{ account_code: string; debit: number; credit: number; description?: string }> = []
    for (const rule of rules) {
      if (!rule.posting_rule_lines) continue
      for (const line of rule.posting_rule_lines) {
        if (line.condition_field && !this.evaluate(line, ctx)) continue
        const amount = line.amount_fixed > 0 ? line.amount_fixed : ctx.amount * (line.amount_percent / 100)
        if (line.debit_account_id) {
          lines.push({ account_code: '', debit: amount, credit: 0, description: ctx.description })
        }
        if (line.credit_account_id) {
          lines.push({ account_code: '', credit: amount, debit: 0, description: ctx.description })
        }
      }
    }
    return lines
  }

  private evaluate(line: any, ctx: PostingContext): boolean {
    const value = (ctx.metadata as any)?.[line.condition_field] ?? (ctx as any)[line.condition_field]
    switch (line.condition_operator) {
      case 'eq': return String(value) === line.condition_value
      case 'neq': return String(value) !== line.condition_value
      case 'gt': return Number(value) > Number(line.condition_value)
      case 'gte': return Number(value) >= Number(line.condition_value)
      case 'lt': return Number(value) < Number(line.condition_value)
      case 'lte': return Number(value) <= Number(line.condition_value)
      case 'in': return line.condition_value.split(',').includes(String(value))
      default: return true
    }
  }

  private deriveSource(type: AccountingEventType): string {
    if (type.startsWith('sale')) return 'sale'
    if (type.startsWith('purchase')) return 'purchase'
    if (type.startsWith('expense')) return 'expense'
    if (type.startsWith('return')) return 'return'
    if (type.startsWith('rental')) return 'rental'
    if (type.startsWith('construction')) return 'construction'
    if (type === 'treasury_transfer') return 'treasury'
    if (type === 'customer_payment' || type === 'supplier_payment') return 'payment'
    if (type === 'payroll') return 'payroll'
    if (type === 'inventory_adjustment') return 'inventory'
    return 'manual'
  }

  async postSale(ctx: {
    saleId: string
    invoiceNumber: string
    total: number
    cogsTotal: number
    isCredit: boolean
    date?: string
    paidAmount?: number
  }): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    const revenueResult = await this.post({
      type: ctx.isCredit ? 'sale_credit' : 'sale_cash',
      companyId: this.companyId,
      amount: ctx.total,
      description: `مبيعات ${ctx.invoiceNumber}`,
      reference: ctx.invoiceNumber,
      sourceId: ctx.saleId,
      date: ctx.date,
    })
    if (!revenueResult.ok) return revenueResult

    let cogsEntryId: string | undefined
    if (ctx.cogsTotal > 0) {
      const cogsResult = await this.post({
        type: 'sale_cogs',
        companyId: this.companyId,
        amount: ctx.cogsTotal,
        description: `تكلفة مبيعات ${ctx.invoiceNumber}`,
        reference: `COGS-${ctx.invoiceNumber}`,
        sourceId: ctx.saleId,
        date: ctx.date,
      })
      if (!cogsResult.ok) return cogsResult
      cogsEntryId = cogsResult.data.journal_id
    }

    return { ok: true, data: { revenueEntryId: revenueResult.data.journal_id, cogsEntryId } }
  }

  async postSaleReturn(ctx: {
    saleId: string
    invoiceNumber: string
    total: number
    cogsTotal: number
    isCredit: boolean
    date?: string
  }): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    const revenueResult = await this.post({
      type: ctx.isCredit ? 'sale_return_credit' : 'sale_return_cash',
      companyId: this.companyId,
      amount: ctx.total,
      description: `مرتجع مبيعات ${ctx.invoiceNumber}`,
      reference: `RET-${ctx.invoiceNumber}`,
      sourceId: ctx.saleId,
      date: ctx.date,
    })
    if (!revenueResult.ok) return revenueResult

    let cogsEntryId: string | undefined
    if (ctx.cogsTotal > 0) {
      const cogsResult = await this.post({
        type: 'sale_return_cogs',
        companyId: this.companyId,
        amount: ctx.cogsTotal,
        description: `تكلفة مرتجع ${ctx.invoiceNumber}`,
        reference: `RETCOGS-${ctx.invoiceNumber}`,
        sourceId: ctx.saleId,
        date: ctx.date,
      })
      if (!cogsResult.ok) return cogsResult
      cogsEntryId = cogsResult.data.journal_id
    }

    return { ok: true, data: { revenueEntryId: revenueResult.data.journal_id, cogsEntryId } }
  }

  async postPurchase(ctx: {
    purchaseId: string
    invoiceNumber: string
    total: number
    isCredit: boolean
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.post({
      type: ctx.isCredit ? 'purchase_credit' : 'purchase_cash',
      companyId: this.companyId,
      amount: ctx.total,
      description: `مشتريات ${ctx.invoiceNumber}`,
      reference: ctx.invoiceNumber,
      sourceId: ctx.purchaseId,
      date: ctx.date,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postExpense(ctx: {
    expenseId: string
    reference: string
    amount: number
    description: string
    categoryCode?: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.post({
      type: 'expense_cash',
      companyId: this.companyId,
      amount: ctx.amount,
      description: ctx.description,
      reference: ctx.reference,
      sourceId: ctx.expenseId,
      date: ctx.date,
      debitAccountCode: ctx.categoryCode,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postCustomerPayment(ctx: {
    partyId: string
    reference: string
    amount: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.postAndMap(ctx, 'customer_payment', 'دفعة من عميل')
  }

  async postSupplierPayment(ctx: {
    partyId: string
    reference: string
    amount: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.postAndMap(ctx, 'supplier_payment', 'دفعة لمورد')
  }

  async postInventoryAdjustment(ctx: {
    productId: string
    quantityChange: number
    unitCost: number
    reason: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    const amount = Math.abs(ctx.quantityChange * ctx.unitCost)
    const result = await this.post({
      type: 'inventory_adjustment',
      companyId: this.companyId,
      amount,
      description: `تسوية مخزون: ${ctx.reason}`,
      reference: `INV-ADJ-${Date.now()}`,
      sourceId: ctx.productId,
      date: ctx.date,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postPayroll(ctx: {
    employeeId: string
    reference: string
    salary: number
    deductions: number
    additions: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string; netAmount: number }>> {
    const netAmount = ctx.salary + ctx.additions - ctx.deductions
    const result = await this.post({
      type: 'payroll',
      companyId: this.companyId,
      amount: netAmount,
      description: `راتب: ${ctx.reference}`,
      reference: ctx.reference,
      sourceId: ctx.employeeId,
      date: ctx.date,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id, netAmount } }
  }

  async postTreasuryTransfer(ctx: {
    fromWalletId: string
    toWalletId: string
    amount: number
    reference: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.post({
      type: 'treasury_transfer',
      companyId: this.companyId,
      amount: ctx.amount,
      description: `تحويل خزينة: ${ctx.reference}`,
      reference: ctx.reference,
      sourceId: `${ctx.fromWalletId}-${ctx.toWalletId}`,
      date: ctx.date,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  private async postAndMap(
    ctx: { partyId: string; reference: string; amount: number; date?: string },
    type: AccountingEventType,
    descPrefix: string,
  ): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.post({
      type,
      companyId: this.companyId,
      amount: ctx.amount,
      description: `${descPrefix} ${ctx.reference}`,
      reference: ctx.reference,
      sourceId: ctx.partyId,
      date: ctx.date,
    })
    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }
}
