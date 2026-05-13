import type { SupabaseClient } from '@supabase/supabase-js'
import { OrderEngine } from './orders/order-engine'
import { InvoiceEngine } from './invoicing/invoice-engine'
import { PaymentEngine } from './payments/payment-engine'
import { ReturnEngine } from './returns/return-engine'
import { FulfillmentEngine } from './fulfillment/fulfillment-engine'
import { InventoryOrchestrator, SalesAccountingService, SalesIntegrityService } from './services'
import { SalesEventBus } from './events/event-bus'
import { registerDefaultHandlers } from './events/event-handlers'
import { SalesReportGenerator } from './reports/report-generator'
import { SalesAIService } from './ai/sales-ai.service'
import { SalesWorker } from './workers/sales.workers'
import { SalesWorkflow } from './workflows'
import { QuotationRepository, QuotationLineRepository } from './repositories/quotation.repository'
import { SalesOrderRepository, SalesOrderLineRepository } from './repositories/order.repository'
import { InvoiceRepository, InvoiceLineRepository } from './repositories/invoice.repository'
import { CreditNoteRepository, CreditNoteLineRepository } from './repositories/credit-note.repository'
import { CustomerPaymentRepository, PaymentAllocationRepository } from './repositories/payment.repository'
import { CustomerWalletRepository, WalletTransactionRepository } from './repositories/wallet.repository'
import { SalesShipmentRepository, ShipmentLineRepository } from './repositories/shipment.repository'
import { SalesReturnRepository, ReturnLineRepository } from './repositories/return.repository'
import { SalesPricingRuleRepository } from './repositories/pricing.repository'
import { CustomerCreditLimitRepository } from './repositories/credit-limit.repository'
import { SalesIntegrityLogRepository } from './repositories/credit-limit.repository'

export class SalesDomain {
  private _cleanupHandlers: (() => void) | null = null

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  get engines() {
    return {
      order: new OrderEngine(this.db, this.companyId),
      invoice: new InvoiceEngine(this.db, this.companyId),
      payment: new PaymentEngine(this.db, this.companyId),
      return: new ReturnEngine(this.db, this.companyId),
      fulfillment: new FulfillmentEngine(this.db, this.companyId),
    }
  }

  get repositories() {
    return {
      quotation: new QuotationRepository(this.db, this.companyId),
      quotationLine: new QuotationLineRepository(this.db, this.companyId),
      order: new SalesOrderRepository(this.db, this.companyId),
      orderLine: new SalesOrderLineRepository(this.db, this.companyId),
      invoice: new InvoiceRepository(this.db, this.companyId),
      invoiceLine: new InvoiceLineRepository(this.db, this.companyId),
      creditNote: new CreditNoteRepository(this.db, this.companyId),
      creditNoteLine: new CreditNoteLineRepository(this.db, this.companyId),
      payment: new CustomerPaymentRepository(this.db, this.companyId),
      allocation: new PaymentAllocationRepository(this.db, this.companyId),
      wallet: new CustomerWalletRepository(this.db, this.companyId),
      walletTransaction: new WalletTransactionRepository(this.db, this.companyId),
      shipment: new SalesShipmentRepository(this.db, this.companyId),
      shipmentLine: new ShipmentLineRepository(this.db, this.companyId),
      salesReturn: new SalesReturnRepository(this.db, this.companyId),
      returnLine: new ReturnLineRepository(this.db, this.companyId),
      pricingRule: new SalesPricingRuleRepository(this.db, this.companyId),
      creditLimit: new CustomerCreditLimitRepository(this.db, this.companyId),
      integrityLog: new SalesIntegrityLogRepository(this.db, this.companyId),
    }
  }

  get services() {
    return {
      orchestrator: new InventoryOrchestrator(this.db, this.companyId),
      accounting: new SalesAccountingService(this.db, this.companyId),
      integrity: new SalesIntegrityService(this.db, this.companyId),
    }
  }

  get workflows() {
    return {
      sales: new SalesWorkflow(this.db, this.companyId),
    }
  }

  get reports() {
    return {
      generator: new SalesReportGenerator(this.db, this.companyId),
    }
  }

  get ai() {
    return {
      sales: new SalesAIService(this.db, this.companyId),
    }
  }

  get workers() {
    return {
      sales: new SalesWorker(this.db, this.companyId),
    }
  }

  get eventBus() {
    return SalesEventBus.getInstance()
  }

  initialize(): void {
    this._cleanupHandlers = registerDefaultHandlers()
  }

  destroy(): void {
    if (this._cleanupHandlers) {
      this._cleanupHandlers()
      this._cleanupHandlers = null
    }
  }
}
