import type { SupabaseClient } from '@supabase/supabase-js'
import { PostingEngine, type SalePostingInput, type PurchasePostingInput, type ExpensePostingInput, type PaymentPostingInput } from './posting-engine'
import type { ServiceResult } from '../types'

export class AutoPoster {
  private readonly engine: PostingEngine

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.engine = new PostingEngine(db, companyId)
  }

  async onSaleCreated(input: {
    saleId: string
    invoiceNumber: string
    total: number
    cogsTotal: number
    isCredit: boolean
    paidAmount?: number
    date?: string
  }): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    return this.engine.postSale({
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      total: input.total,
      cogsTotal: input.cogsTotal,
      isCredit: input.isCredit,
      date: input.date,
      paidAmount: input.paidAmount,
    })
  }

  async onSaleReturnCreated(input: {
    saleId: string
    invoiceNumber: string
    total: number
    cogsTotal: number
    isCredit: boolean
    date?: string
  }): Promise<ServiceResult<{ revenueEntryId: string; cogsEntryId?: string }>> {
    return this.engine.postSaleReturn(input)
  }

  async onPurchaseCreated(input: {
    purchaseId: string
    invoiceNumber: string
    total: number
    isCredit: boolean
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postPurchase(input)
  }

  async onExpenseCreated(input: {
    expenseId: string
    reference: string
    amount: number
    description: string
    categoryCode?: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postExpense(input)
  }

  async onCustomerPayment(input: {
    partyId: string
    reference: string
    amount: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postCustomerPayment({
      ...input,
      type: 'customer',
    })
  }

  async onSupplierPayment(input: {
    partyId: string
    reference: string
    amount: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postSupplierPayment({
      ...input,
      type: 'supplier',
    })
  }

  async onInventoryAdjustment(input: {
    productId: string
    quantityChange: number
    unitCost: number
    reason: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postInventoryAdjustment(
      input.productId,
      input.quantityChange,
      input.unitCost,
      input.reason,
      input.date,
    )
  }

  async onPayrollProcessed(input: {
    employeeId: string
    reference: string
    salary: number
    deductions: number
    additions: number
    date?: string
  }): Promise<ServiceResult<{ entryId: string; netAmount: number }>> {
    return this.engine.postPayroll(
      input.employeeId,
      input.reference,
      input.salary,
      input.deductions,
      input.additions,
      input.date,
    )
  }

  async onTreasuryTransfer(input: {
    fromWalletId: string
    toWalletId: string
    amount: number
    reference: string
    date?: string
  }): Promise<ServiceResult<{ entryId: string }>> {
    return this.engine.postTreasuryTransfer(
      input.fromWalletId,
      input.toWalletId,
      input.amount,
      input.reference,
      input.date,
    )
  }
}
