export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

export type WarehouseType = 'physical' | 'virtual' | 'transit' | 'consignment'
export type LocationType = 'receiving' | 'storage' | 'picking' | 'shipping' | 'quarantine' | 'damaged' | 'return'
export type ItemType = 'product' | 'service' | 'raw_material' | 'wip' | 'finished_good' | 'consumable' | 'asset' | 'packaging'
export type CostMethod = 'fifo' | 'weighted_average' | 'standard'
export type MovementType =
  | 'receipt' | 'issue' | 'transfer_out' | 'transfer_in' | 'return'
  | 'adjustment_up' | 'adjustment_down' | 'reservation' | 'unreservation'
  | 'manufacturing_issue' | 'manufacturing_completion' | 'scrap' | 'write_off'
  | 'recount_up' | 'recount_down' | 'initial_balance'
export type MovementDirection = 'in' | 'out' | 'internal'
export type ReservationType = 'soft' | 'hard' | 'backorder'
export type ReservationStatus = 'active' | 'partial' | 'fulfilled' | 'cancelled' | 'expired'
export type AllocationStatus = 'pending' | 'picked' | 'packed' | 'shipped' | 'cancelled'
export type TransferStatus = 'draft' | 'approved' | 'in_transit' | 'received' | 'cancelled' | 'completed'
export type TransferType = 'internal' | 'inter_branch' | 'return' | 'direct'
export type AdjustmentType = 'count' | 'damage' | 'expiry' | 'correction' | 'write_off' | 'write_on' | 'reclassify'
export type BatchStatus = 'active' | 'frozen' | 'expired' | 'depleted' | 'quarantine'
export type CountSessionType = 'full' | 'cycle' | 'spot' | 'annual'
export type CountSessionStatus = 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled'
export type CountLineStatus = 'pending' | 'counted' | 'verified' | 'adjusted' | 'skipped'
export type Severity = 'info' | 'warning' | 'error' | 'critical'
export type IntegrityStatus = 'open' | 'resolved' | 'ignored'

export type InventoryDomainEvent =
  | 'inventory.received'
  | 'inventory.issued'
  | 'inventory.adjusted'
  | 'inventory.transferred'
  | 'inventory.transfer.received'
  | 'inventory.low_stock'
  | 'inventory.reserved'
  | 'inventory.unreserved'
  | 'inventory.allocated'
  | 'inventory.reconciled'
  | 'inventory.snapshot.created'
  | 'inventory.count.completed'
  | 'inventory.reorder.generated'
  | 'inventory.valuation.updated'
  | 'inventory.integrity.failed'
  | 'inventory.integrity.passed'

export interface InventoryEventPayload {
  id: string
  type: string
  companyId: string
  itemId?: string
  warehouseId?: string
  batchId?: string
  movementId?: string
  transferId?: string
  qty: number
  description: string
  reference?: string
  sourceId?: string
  metadata?: Record<string, unknown>
  performedBy?: string
  timestamp: string
}

export type EventHandler = (event: InventoryEventPayload) => Promise<void>
