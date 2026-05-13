import type { SupabaseClient } from '@supabase/supabase-js'
import { PostingService, type AccountingEvent } from '../services/posting.service'
import { AccountRepository } from '../repositories/account.repository'
import { PeriodRepository } from '../repositories/period.repository'
import type { ServiceResult, AccountingEventType } from '../types'

export interface PostingRequest {
  event: AccountingEvent
  transaction?: {
    id: string
    type: string
    total: number
    date?: string
  }
}

export interface SalePostingInput {
  saleId: string
  invoiceNumber: string
  total: number
  cogsTotal: number
  isCredit: boolean
  date?: string
  paidAmount?: number
}

export interface PurchasePostingInput {
  purchaseId: string
  invoiceNumber: string
  total: number
  isCredit: boolean
  date?: string
}

export interface ExpensePostingInput {
  expenseId: string
  reference: string
  amount: number
  description: string
  categoryCode?: string
  date?: string
}

export interface PaymentPostingInput {
  partyId: string
  reference: string
  amount: number
  type: 'customer' | 'supplier'
  date?: string
}

export class PostingEngine {
  private readonly postingService: PostingService
  private readonly accountRepo: AccountRepository
  private readonly periodRepo: PeriodRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.postingService = new PostingService(db, companyId)
    this.accountRepo = new AccountRepository(db, companyId)
    this.periodRepo = new PeriodRepository(db, companyId)
  }

  async postSale(input: SalePostingInput): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    const entryDate = input.date || new Date().toISOString().slice(0, 10)

    const periodCheck = await this.periodRepo.findOpenPeriodByDate(entryDate)
    if (!periodCheck) {
      return { ok: false, error: 'لا توجد فترة مالية مفتوحة لهذا التاريخ', code: 'NO_OPEN_PERIOD' }
    }

    const revenueResult = await this.postingService.postEvent({
      type: input.isCredit ? 'sale_credit' : 'sale_cash',
      companyId: this.companyId,
      amount: input.total,
      description: `مبيعات ${input.invoiceNumber}`,
      reference: input.invoiceNumber,
      sourceId: input.saleId,
      source: 'sale',
      date: entryDate,
    })

    if (!revenueResult.ok) return revenueResult

    let cogsEntryId: string | undefined

    if (input.cogsTotal > 0) {
      const cogsResult = await this.postingService.postEvent({
        type: 'sale_cogs',
        companyId: this.companyId,
        amount: input.cogsTotal,
        description: `تكلفة مبيعات ${input.invoiceNumber}`,
        reference: `COGS-${input.invoiceNumber}`,
        sourceId: input.saleId,
        source: 'sale',
        date: entryDate,
      })

      if (!cogsResult.ok) return cogsResult
      cogsEntryId = cogsResult.data.journal_id
    }

    return {
      ok: true,
      data: {
        revenueEntryId: revenueResult.data.journal_id,
        cogsEntryId,
      },
    }
  }

  async postSaleReturn(input: SalePostingInput): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    const entryDate = input.date || new Date().toISOString().slice(0, 10)

    const revenueResult = await this.postingService.postEvent({
      type: input.isCredit ? 'sale_return_credit' : 'sale_return_cash',
      companyId: this.companyId,
      amount: input.total,
      description: `مرتجع مبيعات ${input.invoiceNumber}`,
      reference: `RET-${input.invoiceNumber}`,
      sourceId: input.saleId,
      source: 'return',
      date: entryDate,
    })

    if (!revenueResult.ok) return revenueResult

    let cogsEntryId: string | undefined

    if (input.cogsTotal > 0) {
      const cogsResult = await this.postingService.postEvent({
        type: 'sale_return_cogs',
        companyId: this.companyId,
        amount: input.cogsTotal,
        description: `تكلفة مرتجع مبيعات ${input.invoiceNumber}`,
        reference: `RETCOGS-${input.invoiceNumber}`,
        sourceId: input.saleId,
        source: 'return',
        date: entryDate,
      })

      if (!cogsResult.ok) return cogsResult
      cogsEntryId = cogsResult.data.journal_id
    }

    return { ok: true, data: { revenueEntryId: revenueResult.data.journal_id, cogsEntryId } }
  }

  async postPurchase(input: PurchasePostingInput): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.postingService.postEvent({
      type: input.isCredit ? 'purchase_credit' : 'purchase_cash',
      companyId: this.companyId,
      amount: input.total,
      description: `مشتريات ${input.invoiceNumber}`,
      reference: input.invoiceNumber,
      sourceId: input.purchaseId,
      source: 'purchase',
      date: input.date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postExpense(input: ExpensePostingInput): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.postingService.postEvent({
      type: 'expense_cash',
      companyId: this.companyId,
      amount: input.amount,
      description: input.description,
      reference: input.reference,
      sourceId: input.expenseId,
      source: 'expense',
      date: input.date,
      debitAccountCode: input.categoryCode,
      creditAccountCode: undefined,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postCustomerPayment(input: PaymentPostingInput): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.postingService.postEvent({
      type: 'customer_payment',
      companyId: this.companyId,
      amount: input.amount,
      description: `دفعة من عميل ${input.reference}`,
      reference: input.reference,
      sourceId: input.partyId,
      source: 'sale',
      date: input.date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postSupplierPayment(input: PaymentPostingInput): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.postingService.postEvent({
      type: 'supplier_payment',
      companyId: this.companyId,
      amount: input.amount,
      description: `دفعة لمورد ${input.reference}`,
      reference: input.reference,
      sourceId: input.partyId,
      source: 'purchase',
      date: input.date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postInventoryAdjustment(
    productId: string,
    quantityChange: number,
    unitCost: number,
    reason: string,
    date?: string,
  ): Promise<ServiceResult<{ entryId: string }>> {
    const amount = Math.abs(quantityChange * unitCost)

    const result = await this.postingService.postEvent({
      type: 'inventory_adjustment',
      companyId: this.companyId,
      amount,
      description: `تسوية مخزون: ${reason}`,
      reference: `INV-ADJ-${Date.now()}`,
      sourceId: productId,
      source: 'inventory',
      date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }

  async postPayroll(
    employeeId: string,
    reference: string,
    salary: number,
    deductions: number,
    additions: number,
    date?: string,
  ): Promise<ServiceResult<{ entryId: string; netAmount: number }>> {
    const netAmount = salary + additions - deductions

    const result = await this.postingService.postEvent({
      type: 'payroll',
      companyId: this.companyId,
      amount: netAmount,
      description: `راتب: ${reference}`,
      reference,
      sourceId: employeeId,
      source: 'payroll',
      date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id, netAmount } }
  }

  async postTreasuryTransfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    reference: string,
    date?: string,
  ): Promise<ServiceResult<{ entryId: string }>> {
    const result = await this.postingService.postEvent({
      type: 'treasury_transfer',
      companyId: this.companyId,
      amount,
      description: `تحويل خزينة: ${reference}`,
      reference,
      sourceId: `${fromWalletId}-${toWalletId}`,
      source: 'treasury',
      date,
    })

    if (!result.ok) return result
    return { ok: true, data: { entryId: result.data.journal_id } }
  }
}
