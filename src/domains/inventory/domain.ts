import type { SupabaseClient } from '@supabase/supabase-js'
import { WarehouseEngine } from './warehouses/warehouse-engine'
import { StockMovementEngine } from './movements/movement-engine'
import { ValuationEngine } from './valuations/valuation-engine'
import { ReservationEngine } from './reservations/reservation-engine'
import { TransferEngine } from './transfers/transfer-engine'
import { ReceivingWorkflow, CountWorkflow } from './workflows'
import { InventoryIntegrityService, InventoryAccountingService } from './services'
import { InventoryEventBus } from './events/event-bus'
import { registerDefaultHandlers } from './events/event-handlers'
import { InventoryReportGenerator } from './reports/report-generator'
import { AIInventoryService } from './ai/ai-inventory.service'
import { InventoryWorker } from './workers/inventory.workers'
import { WarehouseRepository, WarehouseLocationRepository } from './repositories/warehouse.repository'
import { InventoryItemRepository, InventoryVariantRepository } from './repositories/item.repository'
import { StockMovementRepository } from './repositories/movement.repository'
import { InventoryBatchRepository } from './repositories/batch.repository'
import { InventoryReservationRepository, InventoryAllocationRepository } from './repositories/reservation.repository'
import { InventoryTransferRepository, TransferLineRepository } from './repositories/transfer.repository'
import { InventoryAdjustmentRepository } from './repositories/adjustment.repository'
import { InventoryValuationLayerRepository, InventorySnapshotRepository, ReorderRuleRepository, InventoryIntegrityLogRepository } from './repositories/valuation.repository'

export class InventoryDomain {
  private _cleanupHandlers: (() => void) | null = null

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {}

  get engines() {
    return {
      movement: new StockMovementEngine(this.db, this.companyId),
      valuation: new ValuationEngine(this.db, this.companyId),
      warehouse: new WarehouseEngine(this.db, this.companyId),
      reservation: new ReservationEngine(this.db, this.companyId),
      transfer: new TransferEngine(this.db, this.companyId),
    }
  }

  get repositories() {
    return {
      warehouse: new WarehouseRepository(this.db, this.companyId),
      location: new WarehouseLocationRepository(this.db, this.companyId),
      item: new InventoryItemRepository(this.db, this.companyId),
      variant: new InventoryVariantRepository(this.db, this.companyId),
      movement: new StockMovementRepository(this.db, this.companyId),
      batch: new InventoryBatchRepository(this.db, this.companyId),
      reservation: new InventoryReservationRepository(this.db, this.companyId),
      allocation: new InventoryAllocationRepository(this.db, this.companyId),
      transfer: new InventoryTransferRepository(this.db, this.companyId),
      transferLine: new TransferLineRepository(this.db, this.companyId),
      adjustment: new InventoryAdjustmentRepository(this.db, this.companyId),
      valuationLayer: new InventoryValuationLayerRepository(this.db, this.companyId),
      snapshot: new InventorySnapshotRepository(this.db, this.companyId),
      reorderRule: new ReorderRuleRepository(this.db, this.companyId),
      integrityLog: new InventoryIntegrityLogRepository(this.db, this.companyId),
    }
  }

  get workflows() {
    return {
      receiving: new ReceivingWorkflow(this.db, this.companyId),
      count: new CountWorkflow(this.db, this.companyId),
    }
  }

  get services() {
    return {
      integrity: new InventoryIntegrityService(this.db, this.companyId),
      accounting: new InventoryAccountingService(this.db, this.companyId),
    }
  }

  get reports() {
    return {
      generator: new InventoryReportGenerator(this.db, this.companyId),
    }
  }

  get ai() {
    return {
      inventory: new AIInventoryService(this.db, this.companyId),
    }
  }

  get workers() {
    return {
      inventory: new InventoryWorker(this.db, this.companyId),
    }
  }

  get eventBus() {
    return InventoryEventBus.getInstance()
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
