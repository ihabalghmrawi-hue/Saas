import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryReportGenerator } from '../reports/report-generator'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import type { ServiceResult } from '../types'

export interface ReorderSuggestion {
  item_id: string
  code: string
  name: string
  current_qty: number
  suggested_qty: number
  priority: 'high' | 'medium' | 'low'
  reason: string
}

export interface DemandForecast {
  item_id: string
  code: string
  name: string
  historical_avg_monthly: number
  forecast_next_month: number
  confidence: number
}

export interface AnomalyResult {
  item_id: string
  code: string
  name: string
  anomaly_type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  details: Record<string, any>
}

export class AIInventoryService {
  private readonly reportGenerator: InventoryReportGenerator
  private readonly movementRepo: StockMovementRepository
  private readonly itemRepo: InventoryItemRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.reportGenerator = new InventoryReportGenerator(db, companyId)
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
  }

  async generateReorderSuggestions(): Promise<ServiceResult<ReorderSuggestion[]>> {
    try {
      const lowStock = await this.reportGenerator.generateLowStockReport()
      if (!lowStock.ok) return lowStock as any

      const suggestions: ReorderSuggestion[] = lowStock.data.items.map(item => {
        const shortfall = item.shortfall
        const suggestedQty = Math.max(item.reorder_qty, shortfall * 1.5)

        let priority: 'high' | 'medium' | 'low'
        if (item.current_qty <= 0) priority = 'high'
        else if (shortfall > item.reorder_qty) priority = 'high'
        else if (shortfall > 0) priority = 'medium'
        else priority = 'low'

        let reason: string
        if (item.current_qty <= 0) reason = 'نفاد المخزون'
        else if (item.current_qty < item.min_stock) reason = 'أقل من الحد الأدنى'
        else reason = 'أقل من نقطة إعادة الطلب'

        return {
          item_id: item.item_id,
          code: item.code,
          name: item.name,
          current_qty: item.current_qty,
          suggested_qty: Math.ceil(suggestedQty),
          priority,
          reason,
        }
      })

      return { ok: true, data: suggestions }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'REORDER_SUGGESTIONS_FAILED' }
    }
  }

  async detectDeadStock(monthsThreshold = 6): Promise<ServiceResult<AnomalyResult[]>> {
    try {
      const items = await this.itemRepo.findAllActive()
      const anomalies: AnomalyResult[] = []
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - monthsThreshold)

      for (const item of items.filter(i => i.is_tracked)) {
        const recentMovements = await this.movementRepo.findMany({
          filters: { item_id: item.id, direction: 'out' },
          orderBy: 'posted_at',
          orderDir: 'desc',
          limit: 1,
        })

        const currentStock = await this.movementRepo.getCurrentStock(item.id)

        if (currentStock > 0 && recentMovements.length === 0) {
          anomalies.push({
            item_id: item.id,
            code: item.code,
            name: item.name,
            anomaly_type: 'dead_stock',
            severity: 'medium',
            description: `صنف راكد: ${item.name} - الرصيد ${currentStock}، لا توجد حركة صرف منذ ${monthsThreshold} أشهر`,
            details: { current_qty: currentStock, last_movement: null },
          })
        }
      }

      return { ok: true, data: anomalies }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'DEAD_STOCK_FAILED' }
    }
  }

  async analyzeTurnover(): Promise<ServiceResult<AnomalyResult[]>> {
    try {
      const toDate = new Date().toISOString().slice(0, 10)
      const fromDate = new Date()
      fromDate.setMonth(fromDate.getMonth() - 3)
      const fromDateStr = fromDate.toISOString().slice(0, 10)

      const turnover = await this.reportGenerator.generateTurnoverReport(fromDateStr, toDate)
      if (!turnover.ok) return turnover as any

      const anomalies: AnomalyResult[] = []
      const lowTurnover = turnover.data.items.filter(i => i.turnover_ratio < 0.1)

      for (const item of lowTurnover) {
        anomalies.push({
          item_id: item.item_id,
          code: item.item_code,
          name: item.item_name,
          anomaly_type: 'low_turnover',
          severity: 'low',
          description: `معدل دوران منخفض: ${item.item_name} - النسبة ${item.turnover_ratio.toFixed(2)}`,
          details: { turnover_ratio: item.turnover_ratio, avg_stock: item.avg_stock, total_issues: item.total_issues },
        })
      }

      return { ok: true, data: anomalies }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TURNOVER_ANALYSIS_FAILED' }
    }
  }

  async getWarehouseEfficiency(): Promise<ServiceResult<{
    total_items: number
    total_value: number
    low_stock_count: number
    dead_stock_count: number
    negative_stock_count: number
    turnover_avg: number
  }>> {
    try {
      const balances = await this.movementRepo.getWarehouseBalances()
      const lowStockReport = await this.reportGenerator.generateLowStockReport()
      const deadStock = await this.detectDeadStock()

      const totalValue = balances.reduce((s, b) => s + b.total_value, 0)
      const negativeCount = balances.filter(b => b.current_qty < 0).length

      return {
        ok: true,
        data: {
          total_items: balances.length,
          total_value: totalValue,
          low_stock_count: lowStockReport.ok ? lowStockReport.data.items.length : 0,
          dead_stock_count: deadStock.ok ? deadStock.data.length : 0,
          negative_stock_count: negativeCount,
          turnover_avg: 0,
        },
      }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'EFFICIENCY_FAILED' }
    }
  }
}
