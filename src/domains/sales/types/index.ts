export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type OrderStatus = 'draft' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'cancelled'
export type InvoiceStatus = 'draft' | 'posted' | 'partially_paid' | 'paid' | 'overdue' | 'reversed' | 'cancelled'
export type InvoiceType = 'standard' | 'proforma' | 'correction' | 'recurring'
export type PaymentType = 'cash' | 'bank_transfer' | 'cheque' | 'credit_card' | 'wallet' | 'pos' | 'online'
export type PaymentStatus = 'draft' | 'posted' | 'reversed' | 'cancelled'
export type CreditNoteStatus = 'draft' | 'posted' | 'applied' | 'cancelled'
export type CreditNoteType = 'return' | 'correction' | 'write_off' | 'goodwill'
export type ShipmentStatus = 'pending' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'returned' | 'cancelled'
export type ReturnStatus = 'draft' | 'approved' | 'received' | 'completed' | 'cancelled'
export type ReturnType = 'full' | 'partial' | 'replacement' | 'warranty'
export type PricingType = 'item_discount' | 'order_discount' | 'buy_x_get_y' | 'volume' | 'promotion' | 'customer_group'
export type DiscountType = 'percentage' | 'fixed' | 'free_item'
export type Severity = 'info' | 'warning' | 'error' | 'critical'

export type SalesDomainEvent =
  | 'sales.quotation.created'
  | 'sales.quotation.accepted'
  | 'sales.order.created'
  | 'sales.order.approved'
  | 'sales.order.fulfilled'
  | 'sales.invoice.posted'
  | 'sales.invoice.paid'
  | 'sales.invoice.reversed'
  | 'sales.invoice.overdue'
  | 'sales.shipment.delivered'
  | 'sales.return.created'
  | 'sales.return.completed'
  | 'sales.payment.received'
  | 'sales.credit_note.posted'
  | 'sales.credit_limit.exceeded'
  | 'sales.pricing.rule.applied'

export interface SalesEventPayload {
  id: string
  type: string
  companyId: string
  customerId?: string
  orderId?: string
  invoiceId?: string
  paymentId?: string
  returnId?: string
  amount: number
  description: string
  reference?: string
  sourceId?: string
  metadata?: Record<string, unknown>
  performedBy?: string
  timestamp: string
}

export type EventHandler = (event: SalesEventPayload) => Promise<void>
