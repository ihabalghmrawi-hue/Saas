import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementEngine } from '../movements/movement-engine'
import { ValuationEngine } from '../valuations/valuation-engine'
import { InventoryIntegrityService } from '../services/integrity.service'
import { InventoryReportGenerator } from '../reports/report-generator'
import { AIInventoryService } from '../ai/ai-inventory.service'
import { InventoryReservationRepository } from '../repositories/reservation.repository'
import { InventoryEventBus } from '../events/event-bus'

export class InventoryWorker {
  private readonly movementEngine: StockMovementEngine
  private readonly valuationEngine: ValuationEngine
  private readonly integrityService: InventoryIntegrityService
  private readonly reportGenerator: InventoryReportGenerator
  private readonly aiService: AIInventoryService
  private readonly reservationRepo: InventoryReservationRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementEngine = new StockMovementEngine(db, companyId)
    this.valuationEngine = new ValuationEngine(db, companyId)
    this.integrityService = new InventoryIntegrityService(db, companyId)
    this.reportGenerator = new InventoryReportGenerator(db, companyId)
    this.aiService = new AIInventoryService(db, companyId)
    this.reservationRepo = new InventoryReservationRepository(db, companyId)
  }

  async processAllTasks(): Promise<{
    snapshot: number
    integrity: any
    expiredReservations: number
    reorderSuggestions: number
  }> {
    const snapshot = await this.valuationEngine.generateSnapshot()
    const integrity = await this.integrityService.runAllChecks()
    const expiredReservations = await this.reservationRepo.expireOverdue()
    const reorderResult = await this.aiService.generateReorderSuggestions()

    const suggestions = reorderResult.ok ? reorderResult.data.length : 0

    return {
      snapshot: snapshot.ok ? snapshot.data.count : 0,
      integrity: integrity.ok ? integrity.data : [],
      expiredReservations,
      reorderSuggestions: suggestions,
    }
  }

  async runDailyTasks(): Promise<void> {
    const results = await this.processAllTasks()
    const bus = InventoryEventBus.getInstance()

    await bus.emit('inventory.snapshot.created', {
      id: crypto.randomUUID?.() || `${Date.now()}`,
      type: 'daily_snapshot',
      companyId: this.companyId,
      qty: results.snapshot,
      description: `تم إنشاء لقطة مخزون يومية: ${results.snapshot} صنف`,
      timestamp: new Date().toISOString(),
    })

    if (results.integrity?.some((r: any) => r.status === 'failed')) {
      await bus.emit('inventory.integrity.failed', {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        type: 'integrity_failed',
        companyId: this.companyId,
        qty: 0,
        description: 'فشلت فحوصات نزاهة المخزون اليومية',
        metadata: { results: results.integrity },
        timestamp: new Date().toISOString(),
      })
    }

    if (results.expiredReservations > 0) {
      await bus.emit('inventory.unreserved', {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        type: 'expired_reservations',
        companyId: this.companyId,
        qty: results.expiredReservations,
        description: `تم إنهاء ${results.expiredReservations} حجز منتهي`,
        timestamp: new Date().toISOString(),
      })
    }
  }
}
