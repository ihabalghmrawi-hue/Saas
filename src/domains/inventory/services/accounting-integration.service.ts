import type { SupabaseClient } from '@supabase/supabase-js'
import { StockMovementRepository } from '../repositories/movement.repository'
import { InventoryItemRepository } from '../repositories/item.repository'
import type { ServiceResult } from '../types'
import { AccountingDomain } from '../../accounting/domain'

export class InventoryAccountingService {
  private readonly movementRepo: StockMovementRepository
  private readonly itemRepo: InventoryItemRepository

  constructor(
    private readonly db: SupabaseClient,
    private readonly companyId: string,
  ) {
    this.movementRepo = new StockMovementRepository(db, companyId)
    this.itemRepo = new InventoryItemRepository(db, companyId)
  }

  async postInventoryReceipt(input: {
    movement_id: string
    item_id: string
    warehouse_id: string
    qty: number
    unit_cost: number
    total_cost: number
    description: string
    reference?: string
    source_id?: string
    created_by?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const item = await this.itemRepo.findById(input.item_id)
      if (!item) return { ok: false, error: 'الصنف غير موجود', code: 'ITEM_NOT_FOUND' }
      if (!item.account_inventory_id) return { ok: false, error: 'حساب المخزون غير محدد للصنف', code: 'MISSING_ACCOUNT' }

      const accounting = new AccountingDomain(this.db, this.companyId)

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `إستلام مخزون: ${input.description}`,
        reference: input.reference,
        source: 'inventory_receipt',
        source_id: input.source_id || input.movement_id,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: [
          {
            account_id: item.account_inventory_id,
            debit: input.total_cost,
            credit: 0,
            description: `زيادة المخزون - ${item.name}`,
          },
          {
            account_id: item.account_inventory_id,
            debit: 0,
            credit: input.total_cost,
            description: `مقابل إستلام مخزون - ${item.name}`,
          },
        ],
        created_by_id: input.created_by,
      })

      if (!result.ok) return result

      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'INV_RECEIPT_POST_FAILED' }
    }
  }

  async postCOGS(input: {
    movement_id: string
    item_id: string
    warehouse_id: string
    qty: number
    unit_cost: number
    total_cost: number
    description: string
    reference?: string
    source_id?: string
    created_by?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const item = await this.itemRepo.findById(input.item_id)
      if (!item) return { ok: false, error: 'الصنف غير موجود', code: 'ITEM_NOT_FOUND' }
      if (!item.account_cogs_id || !item.account_inventory_id) {
        return { ok: false, error: 'حسابات التكلفة أو المخزون غير محددة', code: 'MISSING_ACCOUNTS' }
      }

      const accounting = new AccountingDomain(this.db, this.companyId)

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `تكلفة البضاعة المباعة: ${input.description}`,
        reference: input.reference,
        source: 'cogs',
        source_id: input.source_id || input.movement_id,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: [
          {
            account_id: item.account_cogs_id,
            debit: input.total_cost,
            credit: 0,
            description: `COGS - ${item.name} (${input.qty} x ${input.unit_cost})`,
          },
          {
            account_id: item.account_inventory_id,
            debit: 0,
            credit: input.total_cost,
            description: `مخزون - ${item.name}`,
          },
        ],
        created_by_id: input.created_by,
      })

      if (!result.ok) return result

      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'COGS_POST_FAILED' }
    }
  }

  async postAdjustment(input: {
    movement_id: string
    item_id: string
    warehouse_id: string
    qty: number
    unit_cost: number
    total_cost: number
    adjustment_type: string
    description: string
    reference?: string
    source_id?: string
    created_by?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const item = await this.itemRepo.findById(input.item_id)
      if (!item) return { ok: false, error: 'الصنف غير موجود', code: 'ITEM_NOT_FOUND' }
      if (!item.account_inventory_id) return { ok: false, error: 'حساب المخزون غير محدد', code: 'MISSING_ACCOUNT' }

      const isIncrease = input.adjustment_type === 'adjustment_up' || input.adjustment_type === 'recount_up'
      const accounting = new AccountingDomain(this.db, this.companyId)

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `تسوية مخزون: ${input.description}`,
        reference: input.reference,
        source: 'inventory_adjustment',
        source_id: input.source_id || input.movement_id,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: isIncrease
          ? [
              {
                account_id: item.account_inventory_id,
                debit: input.total_cost,
                credit: 0,
                description: `زيادة تسوية - ${item.name}`,
              },
              {
                account_id: item.account_inventory_id,
                debit: 0,
                credit: input.total_cost,
                description: `مقابل تسوية مخزون - ${item.name}`,
              },
            ]
          : [
              {
                account_id: item.account_inventory_id,
                debit: 0,
                credit: input.total_cost,
                description: `نقصان تسوية - ${item.name}`,
              },
              {
                account_id: item.account_inventory_id,
                debit: input.total_cost,
                credit: 0,
                description: `مقابل تسوية مخزون - ${item.name}`,
              },
            ],
        created_by_id: input.created_by,
      })

      if (!result.ok) return result

      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'ADJUSTMENT_POST_FAILED' }
    }
  }

  async postTransfer(input: {
    from_warehouse_id: string
    to_warehouse_id: string
    total_cost: number
    transfer_no: string
    description: string
    created_by?: string
  }): Promise<ServiceResult<{ journal_entry_id: string }>> {
    try {
      const accounting = new AccountingDomain(this.db, this.companyId)

      const result = await accounting.services.journalEngine.create({
        company_id: this.companyId,
        description: `تحويل مخزون: ${input.description}`,
        reference: input.transfer_no,
        source: 'inventory_transfer',
        source_id: input.transfer_no,
        date: new Date().toISOString().slice(0, 10),
        currency: 'SAR',
        lines: [
          {
            account_id: '',
            debit: 0,
            credit: input.total_cost,
            description: `تحويل من مستودع ${input.from_warehouse_id}`,
          },
          {
            account_id: '',
            debit: input.total_cost,
            credit: 0,
            description: `تحويل إلى مستودع ${input.to_warehouse_id}`,
          },
        ],
        created_by_id: input.created_by,
      })

      if (!result.ok) return result

      return { ok: true, data: { journal_entry_id: result.data.journal_id } }
    } catch (e: any) {
      return { ok: false, error: e.message, code: 'TRANSFER_POST_FAILED' }
    }
  }
}
