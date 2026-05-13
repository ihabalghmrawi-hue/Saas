import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseSalesRepository, RepositoryError } from './base'
import type { CustomerPaymentEntity, PaymentAllocationEntity } from '../entities/payment.entity'

export class CustomerPaymentRepository extends BaseSalesRepository<CustomerPaymentEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'customer_payments') }

  async generatePaymentNo(): Promise<string> {
    const { count } = await this.db.from('customer_payments').select('id', { count: 'exact', head: true }).eq('company_id', this.companyId)
    return `PMT-${String((count || 0) + 1).padStart(6, '0')}`
  }

  async findByCustomer(customerId: string): Promise<CustomerPaymentEntity[]> {
    return this.findMany({ filters: { customer_id: customerId }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findUnallocated(): Promise<CustomerPaymentEntity[]> {
    return this.findMany({ filters: { status: 'posted' }, orderBy: 'created_at' })
      .then(ps => ps.filter(p => (p.amount - p.allocated_amount) > 0.01))
  }
}

export class PaymentAllocationRepository extends BaseSalesRepository<PaymentAllocationEntity> {
  constructor(db: SupabaseClient, companyId: string) { super(db, companyId, 'payment_allocations') }

  async findByPayment(paymentId: string): Promise<PaymentAllocationEntity[]> {
    return this.findMany({ filters: { payment_id: paymentId } })
  }

  async findByInvoice(invoiceId: string): Promise<PaymentAllocationEntity[]> {
    return this.findMany({ filters: { invoice_id: invoiceId } })
  }
}
