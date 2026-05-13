export { SalesDomain } from './domain'

export type {
  QuotationEntity, QuotationLineEntity, CreateQuotationInput,
} from './entities/quotation.entity'
export type {
  SalesOrderEntity, SalesOrderLineEntity, CreateSalesOrderInput,
} from './entities/order.entity'
export type {
  InvoiceEntity, InvoiceLineEntity, CreateInvoiceInput, InvoiceSummary,
} from './entities/invoice.entity'
export type {
  CreditNoteEntity, CreditNoteLineEntity, CreateCreditNoteInput,
} from './entities/credit-note.entity'
export type {
  CustomerPaymentEntity, PaymentAllocationEntity, CreatePaymentInput,
} from './entities/payment.entity'
export type {
  CustomerWalletEntity, WalletTransactionEntity,
} from './entities/wallet.entity'
export type {
  SalesShipmentEntity, ShipmentLineEntity, CreateShipmentInput,
} from './entities/shipment.entity'
export type {
  SalesReturnEntity, ReturnLineEntity, CreateReturnInput,
} from './entities/return.entity'
export type {
  SalesPricingRuleEntity,
} from './entities/pricing.entity'
export type {
  CustomerCreditLimitEntity,
} from './entities/credit-limit.entity'

export type {
  ServiceResult, SalesDomainEvent, SalesEventPayload, EventHandler,
  QuotationStatus, OrderStatus, InvoiceStatus, InvoiceType,
  PaymentType, PaymentStatus, CreditNoteStatus, CreditNoteType,
  ShipmentStatus, ReturnStatus, ReturnType, PricingType, DiscountType, Severity,
} from './types'

export { OrderEngine } from './orders/order-engine'
export { InvoiceEngine } from './invoicing/invoice-engine'
export { PaymentEngine } from './payments/payment-engine'
export { ReturnEngine } from './returns/return-engine'
export { FulfillmentEngine } from './fulfillment/fulfillment-engine'

export { InventoryOrchestrator, SalesAccountingService, SalesIntegrityService } from './services'
export { SalesWorkflow } from './workflows'
export { SalesReportGenerator } from './reports/report-generator'
export { SalesAIService } from './ai/sales-ai.service'
export { SalesWorker } from './workers/sales.workers'

export { SalesEventBus } from './events/event-bus'

export type { SalesSummaryReport, CustomerAgingReport, ProductProfitability } from './reports/report-generator'
export type { PricingSuggestion, CustomerRiskScore } from './ai/sales-ai.service'
export type { IntegrityCheck } from './services/integrity.service'

export { QuotationRepository, QuotationLineRepository } from './repositories/quotation.repository'
export { SalesOrderRepository, SalesOrderLineRepository } from './repositories/order.repository'
export { InvoiceRepository, InvoiceLineRepository } from './repositories/invoice.repository'
export { CreditNoteRepository, CreditNoteLineRepository } from './repositories/credit-note.repository'
export { CustomerPaymentRepository, PaymentAllocationRepository } from './repositories/payment.repository'
export { CustomerWalletRepository, WalletTransactionRepository } from './repositories/wallet.repository'
export { SalesShipmentRepository, ShipmentLineRepository } from './repositories/shipment.repository'
export { SalesReturnRepository, ReturnLineRepository } from './repositories/return.repository'
export { SalesPricingRuleRepository } from './repositories/pricing.repository'
export { CustomerCreditLimitRepository } from './repositories/credit-limit.repository'
export { SalesIntegrityLogRepository } from './repositories/credit-limit.repository'

export { CreateQuotationSchema, CreateOrderSchema, CreateInvoiceSchema, CreatePaymentSchema, CreateReturnSchema, CreateShipmentSchema } from './validators'

export { useSalesOrders, useInvoices, usePayments } from './hooks'
