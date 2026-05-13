import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StockMovementEngine } from '../movements/movement-engine'
import { createMockDb, mockFromResult, type MockDb } from '../../test-helpers/mock-db'

describe('StockMovementEngine', () => {
  let db: MockDb
  let engine: StockMovementEngine
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    engine = new StockMovementEngine(db as any, companyId)
  })

  describe('receive', () => {
    const validInput = {
      item_id: 'item-1',
      warehouse_id: 'wh-1',
      qty: 100,
      unit_cost: 50,
      source: 'purchase',
      source_id: 'po-001',
      description: 'إستلام مشتريات',
      created_by: 'user-1',
    }

    it('creates movement and valuation layer on receipt', async () => {
      mockFromResult(db, 'stock_movements', { id: 'mov-1', item_id: 'item-1', qty: 100, unit_cost: 50, total_cost: 5000 })
      mockFromResult(db, 'inventory_valuation_layers', null)
      mockFromResult(db, 'inventory_batches', null)
      mockFromResult(db, 'inventory_items', { id: 'item-1', cost_method: 'weighted_average' })

      const r = await engine.receive(validInput)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.movement_id).toBe('mov-1')
        expect(r.data.qty).toBe(100)
        expect(r.data.total_cost).toBe(5000)
      }
    })

    it('rejects qty <= 0', async () => {
      const r = await engine.receive({ ...validInput, qty: 0 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_QTY')
    })

    it('rejects negative qty', async () => {
      const r = await engine.receive({ ...validInput, qty: -5 })
      expect(r.ok).toBe(false)
    })

    it('calculates total_cost from qty * unit_cost when not provided', async () => {
      mockFromResult(db, 'stock_movements', { id: 'mov-2', item_id: 'item-1', qty: 10, unit_cost: 25, total_cost: 250 })
      mockFromResult(db, 'inventory_valuation_layers', null)
      mockFromResult(db, 'inventory_batches', null)
      mockFromResult(db, 'inventory_items', { id: 'item-1', cost_method: 'weighted_average' })

      const r = await engine.receive({ ...validInput, qty: 10, unit_cost: 25, total_cost: undefined })
      expect(r.ok).toBe(true)
    })
  })

  describe('issue', () => {
    const validInput = {
      item_id: 'item-1',
      warehouse_id: 'wh-1',
      qty: 10,
      source: 'sales',
      source_id: 'so-001',
      created_by: 'user-1',
    }

    it('rejects qty <= 0', async () => {
      const r = await engine.issue({ ...validInput, qty: 0 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INVALID_QTY')
    })

    it('rejects when insufficient stock', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'getCurrentStock').mockResolvedValue(5)

      const r = await engine.issue(validInput)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('INSUFFICIENT_STOCK')
    })

    it('issues stock when sufficient', async () => {
      const movementRepo = (engine as any).movementRepo
      const itemRepo = (engine as any).itemRepo
      const valuationRepo = (engine as any).valuationRepo

      vi.spyOn(movementRepo, 'getCurrentStock').mockResolvedValue(100)
      vi.spyOn(itemRepo, 'findById').mockResolvedValue({ id: 'item-1', cost_method: 'weighted_average' })
      vi.spyOn(valuationRepo, 'getWeightedAverageCost').mockResolvedValue(50)
      vi.spyOn(movementRepo, 'createMovement').mockResolvedValue({ id: 'mov-3', item_id: 'item-1', qty: 10, unit_cost: 50, total_cost: 500 } as any)
      vi.spyOn(valuationRepo, 'addLayer').mockResolvedValue({} as any)

      const r = await engine.issue(validInput)
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.movement_id).toBe('mov-3')
        expect(r.data.qty).toBe(10)
      }
    })

    it('uses FIFO costing when item cost_method is fifo', async () => {
      const movementRepo = (engine as any).movementRepo
      const itemRepo = (engine as any).itemRepo
      const valuationRepo = (engine as any).valuationRepo

      vi.spyOn(movementRepo, 'getCurrentStock').mockResolvedValue(100)
      vi.spyOn(itemRepo, 'findById').mockResolvedValue({ id: 'item-1', cost_method: 'fifo' })
      vi.spyOn(valuationRepo, 'consumeFifo').mockResolvedValue({ totalCost: 600 })
      vi.spyOn(movementRepo, 'createMovement').mockResolvedValue({ id: 'mov-4', item_id: 'item-1', qty: 10, unit_cost: 60, total_cost: 600 } as any)

      const r = await engine.issue(validInput)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.unit_cost).toBe(60)
    })
  })

  describe('adjust', () => {
    it('rejects when no change', async () => {
      const r = await engine.adjust({
        item_id: 'item-1', warehouse_id: 'wh-1',
        current_qty: 50, new_qty: 50, reason: 'no change',
        source: 'count', created_by: 'user-1',
      })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('NO_CHANGE')
    })

    it('creates adjustment_up movement for increase', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'createMovement').mockResolvedValue({ id: 'mov-5', item_id: 'item-1', qty: 10, unit_cost: 55, total_cost: 550 } as any)
      const valuationRepo = (engine as any).valuationRepo
      vi.spyOn(valuationRepo, 'addLayer').mockResolvedValue({} as any)

      const r = await engine.adjust({
        item_id: 'item-1', warehouse_id: 'wh-1',
        current_qty: 50, new_qty: 60, unit_cost: 55,
        reason: 'زيادة', source: 'count', created_by: 'user-1',
      })
      expect(r.ok).toBe(true)
    })

    it('creates adjustment_down movement for decrease', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'createMovement').mockResolvedValue({ id: 'mov-6', item_id: 'item-1', qty: 5, unit_cost: 50, total_cost: 250 } as any)
      const valuationRepo = (engine as any).valuationRepo
      vi.spyOn(valuationRepo, 'addLayer').mockResolvedValue({} as any)
      const itemRepo = (engine as any).itemRepo
      vi.spyOn(itemRepo, 'findById').mockResolvedValue({ id: 'item-1', standard_cost: 50 } as any)

      const r = await engine.adjust({
        item_id: 'item-1', warehouse_id: 'wh-1',
        current_qty: 50, new_qty: 45,
        reason: 'نقص', source: 'count', created_by: 'user-1',
      })
      expect(r.ok).toBe(true)
    })
  })

  describe('reverse', () => {
    it('delegates to movementRepo.reverse', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'reverse').mockResolvedValue({ id: 'mov-7', item_id: 'item-1', qty: 10, unit_cost: 50, total_cost: 500 })

      const r = await engine.reverse('mov-1', 'خطأ في الكمية')
      expect(r.ok).toBe(true)
      expect(movementRepo.reverse).toHaveBeenCalledWith('mov-1', 'خطأ في الكمية', undefined)
    })

    it('returns error on reverse failure', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'reverse').mockRejectedValue(new Error('لا يمكن عكس الحركة'))

      const r = await engine.reverse('mov-1', 'خطأ')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('REVERSAL_FAILED')
    })
  })

  describe('getCurrentStock', () => {
    it('returns stock from repository', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'getCurrentStock').mockResolvedValue(250)

      const r = await engine.getCurrentStock('item-1', 'wh-1')
      expect(r).toBe(250)
    })
  })

  describe('getWarehouseBalances', () => {
    it('returns balances from repository', async () => {
      const movementRepo = (engine as any).movementRepo
      const balances = [{ item_id: 'item-1', current_qty: 100, total_value: 5000 }]
      vi.spyOn(movementRepo, 'getWarehouseBalances').mockResolvedValue(balances)

      const r = await engine.getWarehouseBalances('wh-1')
      expect(r).toEqual(balances)
    })
  })
})
