import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryCountSessionRepository, InventoryCountLineRepository } from '../repositories/adjustment.repository'
import { StockMovementEngine } from '../movements/movement-engine'
import type { InventoryCountSessionEntity, InventoryCountLineEntity } from '../entities/adjustment.entity'
import type { ServiceResult } from '../types'

export class CountWorkflow {
  private readonly sessionRepo: InventoryCountSessionRepository
  private readonly lineRepo: InventoryCountLineRepository
  private readonly movementEngine: StockMovementEngine

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.sessionRepo = new InventoryCountSessionRepository(db, companyId)
    this.lineRepo = new InventoryCountLineRepository(db, companyId)
    this.movementEngine = new StockMovementEngine(db, companyId)
  }

  async createSession(input: {
    warehouse_id: string
    type?: string
    scheduled_date?: string
    started_by?: string
    notes?: string
    metadata?: Record<string, unknown>
  }): Promise<ServiceResult<InventoryCountSessionEntity>> {
    try {
      const sessionNo = await this.sessionRepo.generateSessionNo()
      const session = await this.sessionRepo.create({
        session_no: sessionNo,
        warehouse_id: input.warehouse_id,
        type: input.type || 'cycle',
        status: 'draft',
        scheduled_date: input.scheduled_date,
        started_by: input.started_by,
        notes: input.notes,
        metadata: input.metadata,
      } as any)
      return { ok: true, data: session }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'SESSION_CREATE_FAILED' }
    }
  }

  async recordCount(sessionId: string, lines: Array<{
    item_id: string
    variant_id?: string
    batch_id?: string
    location_id?: string
    expected_qty: number
    counted_qty: number
    unit_cost?: number
    counted_by?: string
    notes?: string
  }>): Promise<ServiceResult<{ adjusted: number; no_change: number }>> {
    try {
      let adjusted = 0
      let noChange = 0

      for (const line of lines) {
        const existing = await this.lineRepo.create({
          session_id: sessionId,
          company_id: this.companyId,
          item_id: line.item_id,
          variant_id: line.variant_id,
          batch_id: line.batch_id,
          location_id: line.location_id,
          expected_qty: line.expected_qty,
          counted_qty: line.counted_qty,
          unit_cost: line.unit_cost || 0,
          status: 'counted',
          counted_by: line.counted_by,
          notes: line.notes,
        } as any)

        if (line.counted_qty !== line.expected_qty) {
          adjusted++
        } else {
          noChange++
          await this.lineRepo.update(existing.id, { status: 'verified' } as any)
        }
      }

      return { ok: true, data: { adjusted, no_change: noChange } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'RECORD_COUNT_FAILED' }
    }
  }

  async applyAdjustments(sessionId: string, approvedBy?: string): Promise<ServiceResult<{ adjustments: number }>> {
    try {
      const lines = await this.lineRepo.findBySession(sessionId)
      const varianceLines = lines.filter(l => l.variance_qty !== 0)
      let adjustments = 0

      for (const line of varianceLines) {
        const diff = (line.counted_qty || 0) - line.expected_qty

        await this.movementEngine.adjust({
          item_id: line.item_id,
          variant_id: line.variant_id,
          warehouse_id: '', // Filled from session
          current_qty: line.expected_qty,
          new_qty: line.counted_qty || 0,
          unit_cost: line.unit_cost || 0,
          reason: `تسوية جرد: ${line.notes || 'فروقات الجرد'}`,
          reference_type: 'count_session',
          reference_id: sessionId,
          source: 'count',
          source_id: sessionId,
          created_by: approvedBy,
        })

        await this.lineRepo.update(line.id, { status: 'adjusted' } as any)
        adjustments++
      }

      await this.sessionRepo.update(sessionId, {
        status: 'completed',
        completed_by: approvedBy,
        completed_at: new Date().toISOString(),
      } as any)

      return { ok: true, data: { adjustments } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'APPLY_ADJUSTMENTS_FAILED' }
    }
  }
}
