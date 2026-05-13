import type { SupabaseClient } from '@supabase/supabase-js'
import { CustomerPaymentRepository, PaymentAllocationRepository } from '../repositories/payment.repository'
import { CustomerWalletRepository, WalletTransactionRepository } from '../repositories/wallet.repository'
import { InvoiceRepository } from '../repositories/invoice.repository'
import { CustomerCreditLimitRepository } from '../repositories/credit-limit.repository'
import { SalesEventBus } from '../events/event-bus'
import type { CustomerPaymentEntity, CreatePaymentInput } from '../entities/payment.entity'
import type { ServiceResult } from '../types'

export class PaymentEngine {
  private readonly paymentRepo: CustomerPaymentRepository
  private readonly allocRepo: PaymentAllocationRepository
  private readonly walletRepo: CustomerWalletRepository
  private readonly walletTxRepo: WalletTransactionRepository
  private readonly invoiceRepo: InvoiceRepository
  private readonly creditLimitRepo: CustomerCreditLimitRepository
  private readonly eventBus: SalesEventBus

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.paymentRepo = new CustomerPaymentRepository(db, companyId)
    this.allocRepo = new PaymentAllocationRepository(db, companyId)
    this.walletRepo = new CustomerWalletRepository(db, companyId)
    this.walletTxRepo = new WalletTransactionRepository(db, companyId)
    this.invoiceRepo = new InvoiceRepository(db, companyId)
    this.creditLimitRepo = new CustomerCreditLimitRepository(db, companyId)
    this.eventBus = SalesEventBus.getInstance()
  }

  async receivePayment(input: CreatePaymentInput): Promise<ServiceResult<{ id: string; payment_no: string }>> {
    try {
      const paymentNo = await this.paymentRepo.generatePaymentNo()
      let allocatedAmount = 0

      const payment = await this.paymentRepo.create({
        payment_no: paymentNo, customer_id: input.customer_id, customer_name: input.customer_name,
        payment_type: input.payment_type, payment_date: input.payment_date || new Date().toISOString().slice(0, 10),
        amount: input.amount, currency: input.currency || 'SAR', reference: input.reference,
        cheque_no: input.cheque_no, cheque_date: input.cheque_date, bank_account: input.bank_account,
        notes: input.notes, status: 'draft', allocated_amount: 0, reconciled: false,
        created_by: input.created_by, metadata: input.metadata,
      } as any)

      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          await this.allocRepo.create({
            payment_id: payment.id, company_id: this.companyId,
            invoice_id: alloc.invoice_id, credit_note_id: alloc.credit_note_id,
            amount: alloc.amount, allocated_at: new Date().toISOString(),
          } as any)
          allocatedAmount += alloc.amount

          if (alloc.invoice_id) {
            const invoice = await this.invoiceRepo.findById(alloc.invoice_id)
            if (invoice) {
              const newPaid = invoice.paid_amount + alloc.amount
              const newStatus = newPaid >= invoice.total ? 'paid' : 'partially_paid'
              await this.invoiceRepo.update(alloc.invoice_id, { paid_amount: newPaid, status: newStatus } as any)

              if (newStatus === 'paid') {
                this.eventBus.emit('sales.invoice.paid', {
                  id: alloc.invoice_id, type: 'invoice_paid', companyId: this.companyId,
                  invoiceId: alloc.invoice_id, customerId: input.customer_id, amount: alloc.amount,
                  description: `تم سداد الفاتورة ${invoice.invoice_no}`,
                  reference: paymentNo, timestamp: new Date().toISOString(),
                })
              }
            }
          }
        }
      }

      await this.paymentRepo.update(payment.id, {
        status: 'posted', allocated_amount: allocatedAmount,
        posted_by: input.created_by, posted_at: new Date().toISOString(),
      } as any)

      if (input.payment_type === 'wallet' || input.payment_type === 'cash') {
        try {
          const wallet = await this.walletRepo.ensureWallet(input.customer_id)
          const oldBalance = wallet.balance
          await this.walletRepo.updateBalance(wallet.id, oldBalance + input.amount)
          await this.walletTxRepo.create({
            wallet_id: wallet.id, company_id: this.companyId, type: 'payment',
            amount: input.amount, balance_before: oldBalance, balance_after: oldBalance + input.amount,
            reference_type: 'payment', reference_id: payment.id,
            description: `دفعة ${paymentNo}`, metadata: input.metadata,
          } as any)
        } catch {}
      }

      this.eventBus.emit('sales.payment.received', {
        id: payment.id, type: 'payment', companyId: this.companyId, paymentId: payment.id,
        customerId: input.customer_id, amount: input.amount, description: `دفعة ${paymentNo}`,
        reference: paymentNo, performedBy: input.created_by, timestamp: new Date().toISOString(),
      })

      return { ok: true, data: { id: payment.id, payment_no: paymentNo } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'PAYMENT_FAILED' }
    }
  }

  async allocate(paymentId: string, allocations: Array<{ invoice_id?: string; credit_note_id?: string; amount: number }>): Promise<ServiceResult<void>> {
    try {
      const payment = await this.paymentRepo.findById(paymentId)
      if (!payment) return { ok: false, error: 'الدفعة غير موجودة', code: 'NOT_FOUND' }

      let totalAllocated = payment.allocated_amount
      for (const alloc of allocations) {
        if (totalAllocated + alloc.amount > payment.amount + 0.01) {
          return { ok: false, error: 'تجاوز مبلغ التخصيص قيمة الدفعة', code: 'OVER_ALLOCATION' }
        }

        await this.allocRepo.create({
          payment_id: paymentId, company_id: this.companyId,
          invoice_id: alloc.invoice_id, credit_note_id: alloc.credit_note_id,
          amount: alloc.amount, allocated_at: new Date().toISOString(),
        } as any)
        totalAllocated += alloc.amount

        if (alloc.invoice_id) {
          const invoice = await this.invoiceRepo.findById(alloc.invoice_id)
          if (invoice) {
            const newPaid = invoice.paid_amount + alloc.amount
            const newStatus = newPaid >= invoice.total ? 'paid' : 'partially_paid'
            await this.invoiceRepo.update(alloc.invoice_id, { paid_amount: newPaid, status: newStatus } as any)
          }
        }
      }

      await this.paymentRepo.update(paymentId, { allocated_amount: totalAllocated } as any)
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ALLOCATE_FAILED' }
    }
  }

  async reversePayment(paymentId: string, reason: string): Promise<ServiceResult<void>> {
    try {
      const payment = await this.paymentRepo.findById(paymentId)
      if (!payment) return { ok: false, error: 'الدفعة غير موجودة', code: 'NOT_FOUND' }

      const allocations = await this.allocRepo.findByPayment(paymentId)
      for (const alloc of allocations) {
        if (alloc.invoice_id) {
          const invoice = await this.invoiceRepo.findById(alloc.invoice_id)
          if (invoice) {
            const newPaid = Math.max(0, invoice.paid_amount - alloc.amount)
            await this.invoiceRepo.update(alloc.invoice_id, { paid_amount: newPaid, status: 'posted' } as any)
          }
        }
      }

      await this.paymentRepo.update(paymentId, { status: 'reversed', notes: reason } as any)
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REVERSE_PAYMENT_FAILED' }
    }
  }
}
