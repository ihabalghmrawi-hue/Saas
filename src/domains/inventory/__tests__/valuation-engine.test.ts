import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ValuationEngine } from '../valuations/valuation-engine'
import { createMockDb, type MockDb } from '../../test-helpers/mock-db'

describe('ValuationEngine', () => {
  let db: MockDb
  let engine: ValuationEngine
  const companyId = 'co-001'

  beforeEach(() => {
    db = createMockDb()
    engine = new ValuationEngine(db as any, companyId)
  })

  describe('getItemValuation', () => {
    it('returns valuation summary with weighted avg cost', async () => {
      const itemRepo = (engine as any).itemRepo
      const layerRepo = (engine as any).layerRepo

      vi.spyOn(itemRepo, 'findById').mockResolvedValue({ id: 'item-1', code: 'ITM-001', name: 'منتج', cost_method: 'weighted_average' })
      vi.spyOn(layerRepo, 'findActiveLayers').mockResolvedValue([
        { qty_remaining: 50, total_cost_remaining: 2500, unit_cost: 50, layer_date: '2024-01-01' },
        { qty_remaining: 30, total_cost_remaining: 1800, unit_cost: 60, layer_date: '2024-02-01' },
      ])

      const r = await engine.getItemValuation('item-1', 'wh-1')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.total_qty).toBe(80)
        expect(r.data.total_value).toBe(4300)
        expect(r.data.weighted_avg_cost).toBe(53.75)
        expect(r.data.cost_method).toBe('weighted_average')
        expect(r.data.layers).toHaveLength(2)
      }
    })

    it('returns error when item not found', async () => {
      const itemRepo = (engine as any).itemRepo
      vi.spyOn(itemRepo, 'findById').mockResolvedValue(null)

      const r = await engine.getItemValuation('item-404', 'wh-1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('ITEM_NOT_FOUND')
    })

    it('handles zero qty (no active layers)', async () => {
      const itemRepo = (engine as any).itemRepo
      const layerRepo = (engine as any).layerRepo

      vi.spyOn(itemRepo, 'findById').mockResolvedValue({ id: 'item-1', code: 'ITM-001', name: 'منتج', cost_method: 'fifo' })
      vi.spyOn(layerRepo, 'findActiveLayers').mockResolvedValue([])

      const r = await engine.getItemValuation('item-1', 'wh-1')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.total_qty).toBe(0)
        expect(r.data.total_value).toBe(0)
        expect(r.data.weighted_avg_cost).toBe(0)
      }
    })
  })

  describe('getWeightedAverageCost', () => {
    it('delegates to layerRepo', async () => {
      const layerRepo = (engine as any).layerRepo
      vi.spyOn(layerRepo, 'getWeightedAverageCost').mockResolvedValue(55)

      const r = await engine.getWeightedAverageCost('item-1', 'wh-1')
      expect(r).toBe(55)
      expect(layerRepo.getWeightedAverageCost).toHaveBeenCalledWith('item-1', 'wh-1')
    })
  })

  describe('getInventoryValue', () => {
    it('returns total inventory value from warehouse balances', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'getWarehouseBalances').mockResolvedValue([
        { item_id: 'item-1', current_qty: 100, total_value: 5000 },
        { item_id: 'item-2', current_qty: 50, total_value: 3000 },
      ])

      const r = await engine.getInventoryValue('wh-1')
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.total_qty).toBe(150)
        expect(r.data.total_value).toBe(8000)
        expect(r.data.items).toHaveLength(2)
      }
    })

    it('handles empty warehouse', async () => {
      const movementRepo = (engine as any).movementRepo
      vi.spyOn(movementRepo, 'getWarehouseBalances').mockResolvedValue([])

      const r = await engine.getInventoryValue()
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.total_qty).toBe(0)
        expect(r.data.total_value).toBe(0)
      }
    })
  })

  describe('generateSnapshot', () => {
    it('generates daily snapshot', async () => {
      const snapshotRepo = (engine as any).snapshotRepo
      vi.spyOn(snapshotRepo, 'generateDailySnapshot').mockResolvedValue(42)

      const r = await engine.generateSnapshot('wh-1')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.data.count).toBe(42)
      expect(snapshotRepo.generateDailySnapshot).toHaveBeenCalledWith('wh-1')
    })

    it('handles snapshot failure', async () => {
      const snapshotRepo = (engine as any).snapshotRepo
      vi.spyOn(snapshotRepo, 'generateDailySnapshot').mockRejectedValue(new Error('DB error'))

      const r = await engine.generateSnapshot()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('SNAPSHOT_FAILED')
    })
  })

  describe('recalculateAllValuations', () => {
    it('recalculates valuations for items with default warehouse', async () => {
      const itemRepo = (engine as any).itemRepo
      const movementRepo = (engine as any).movementRepo
      const layerRepo = (engine as any).layerRepo

      vi.spyOn(itemRepo, 'findAllActive').mockResolvedValue([
        { id: 'item-1', default_warehouse_id: 'wh-1', code: 'ITM-001' },
        { id: 'item-2', default_warehouse_id: null, code: 'ITM-002' },
      ])

      vi.spyOn(movementRepo, 'findMany').mockResolvedValue([
        { direction: 'in', qty: 100, total_cost: 5000, is_reversed: false },
        { direction: 'out', qty: 30, total_cost: 1500, is_reversed: false },
      ])

      vi.spyOn(layerRepo, 'findActiveLayers').mockResolvedValue([])
      vi.spyOn(layerRepo, 'addLayer').mockResolvedValue({} as any)

      const r = await engine.recalculateAllValuations()
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.data.itemsUpdated).toBe(1)
        expect(layerRepo.addLayer).toHaveBeenCalledTimes(1)
        expect(layerRepo.addLayer).toHaveBeenCalledWith(expect.objectContaining({
          item_id: 'item-1',
          qty_remaining: 70,
          unit_cost: 50,
        }))
      }
    })

    it('handles recalculation failure', async () => {
      const itemRepo = (engine as any).itemRepo
      vi.spyOn(itemRepo, 'findAllActive').mockRejectedValue(new Error('DB error'))

      const r = await engine.recalculateAllValuations()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe('RECALC_FAILED')
    })
  })
})
