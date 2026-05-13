export interface InventoryItemEntity extends Record<string, unknown> {
  id: string
  company_id: string
  code: string
  name: string
  name_ar?: string
  description?: string
  category?: string
  subcategory?: string
  type: string
  unit: string
  cost_method: string
  standard_cost: number
  is_tracked: boolean
  is_active: boolean
  is_serialized: boolean
  is_batch_tracked: boolean
  has_expiry: boolean
  shelf_life_days?: number
  barcode?: string
  sku?: string
  tax_rate_id?: string
  account_revenue_id?: string
  account_cogs_id?: string
  account_inventory_id?: string
  image_url?: string
  weight?: number
  volume?: number
  category_id?: string
  default_warehouse_id?: string
  min_stock: number
  max_stock?: number
  reorder_point: number
  reorder_qty: number
  lead_time_days: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InventoryVariantEntity extends Record<string, unknown> {
  id: string
  item_id: string
  company_id: string
  code: string
  name?: string
  name_ar?: string
  sku?: string
  barcode?: string
  attributes: Record<string, unknown>
  unit: string
  cost_method?: string
  standard_cost: number
  is_active: boolean
  image_url?: string
  weight?: number
  volume?: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateInventoryItemInput {
  code: string
  name: string
  name_ar?: string
  description?: string
  category?: string
  subcategory?: string
  type?: string
  unit?: string
  cost_method?: string
  standard_cost?: number
  is_tracked?: boolean
  is_serialized?: boolean
  is_batch_tracked?: boolean
  has_expiry?: boolean
  shelf_life_days?: number
  barcode?: string
  sku?: string
  tax_rate_id?: string
  account_revenue_id?: string
  account_cogs_id?: string
  account_inventory_id?: string
  default_warehouse_id?: string
  min_stock?: number
  max_stock?: number
  reorder_point?: number
  reorder_qty?: number
  lead_time_days?: number
  metadata?: Record<string, unknown>
}

export interface ItemStockSummary {
  item_id: string
  item_code: string
  item_name: string
  total_qty: number
  available_qty: number
  reserved_qty: number
  incoming_qty: number
  unit_cost: number
  total_value: number
  warehouses: Array<{
    warehouse_id: string
    warehouse_name: string
    qty: number
  }>
}
