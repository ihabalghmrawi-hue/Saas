import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { InventoryBatchEntity, CreateBatchInput } from '../entities/batch.entity'

export class InventoryBatchRepository extends BaseInventoryRepository<InventoryBatchEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_batches')
  }

  async createBatch(input: CreateBatchInput): Promise<InventoryBatchEntity> {
    const { data, error } = await this.db
      .from('inventory_batches')
      .insert({ company_id: this.companyId, available_qty: input.initial_qty, ...input })
      .select('*')
      .single()
    if (error) throw new RepositoryError(error.message, error.code)
    return data as InventoryBatchEntity
  }

  async findByItem(itemId: string, status?: string): Promise<InventoryBatchEntity[]> {
    const filters: Record<string, any> = { item_id: itemId, is_active: true }
    if (status) filters.status = status
    return this.findMany({ filters, orderBy: 'received_date' })
  }

  async findExpiring(withinDays: number): Promise<InventoryBatchEntity[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + withinDays)

    const { data, error } = await this.db
      .from('inventory_batches')
      .select('*')
      .eq('company_id', this.companyId)
      .eq('is_active', true)
      .lte('expiry_date', cutoff.toISOString().slice(0, 10))
      .gte('expiry_date', new Date().toISOString().slice(0, 10))

    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InventoryBatchEntity[]
  }

  async reduceAvailable(batchId: string, qty: number): Promise<void> {
    const { error } = await this.db.rpc('reduce_batch_qty', {
      p_batch_id: batchId,
      p_qty: qty,
    })

    if (error) {
      await this.db
        .from('inventory_batches')
        .update({
          available_qty: this.db.rpc('get_current_stock from item', {} as any),
        } as any)

      const batch = await this.findById(batchId)
      if (!batch || batch.available_qty < qty) {
        throw new RepositoryError('الكمية غير متوفرة في الدفعة')
      }

      const { error: updateError } = await this.db
        .from('inventory_batches')
        .update({ available_qty: batch.available_qty - qty })
        .eq('id', batchId)

      if (updateError) throw new RepositoryError(updateError.message, updateError.code)
    }
  }
}
