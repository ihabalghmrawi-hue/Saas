import type { SupabaseClient } from '@supabase/supabase-js'
import { BaseInventoryRepository, RepositoryError } from './base'
import type { InventoryTransferEntity, TransferLineEntity } from '../entities/transfer.entity'

export class InventoryTransferRepository extends BaseInventoryRepository<InventoryTransferEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'inventory_transfers')
  }

  async findByStatus(status: string): Promise<InventoryTransferEntity[]> {
    return this.findMany({ filters: { status }, orderBy: 'created_at', orderDir: 'desc' })
  }

  async findByWarehouse(warehouseId: string): Promise<InventoryTransferEntity[]> {
    const { data, error } = await this.db
      .from('inventory_transfers')
      .select('*')
      .eq('company_id', this.companyId)
      .or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`)
      .order('created_at', { ascending: false })

    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as InventoryTransferEntity[]
  }

  async generateTransferNo(): Promise<string> {
    const { count } = await this.db
      .from('inventory_transfers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)

    const nextNum = (count || 0) + 1
    return `TR-${String(nextNum).padStart(6, '0')}`
  }
}

export class TransferLineRepository extends BaseInventoryRepository<TransferLineEntity> {
  constructor(db: SupabaseClient, companyId: string) {
    super(db, companyId, 'transfer_lines')
  }

  async findByTransfer(transferId: string): Promise<TransferLineEntity[]> {
    return this.findMany({ filters: { transfer_id: transferId } })
  }

  async createBatch(lines: Array<Omit<TransferLineEntity, 'id' | 'company_id' | 'created_at' | 'updated_at'>>): Promise<TransferLineEntity[]> {
    const rows = lines.map(l => ({ company_id: this.companyId, ...l }))
    const { data, error } = await this.db
      .from('transfer_lines')
      .insert(rows)
      .select('*')
    if (error) throw new RepositoryError(error.message, error.code)
    return (data || []) as TransferLineEntity[]
  }
}
