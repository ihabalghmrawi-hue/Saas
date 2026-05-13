export interface WarehouseEntity extends Record<string, unknown> {
  id: string
  company_id: string
  code: string
  name: string
  name_ar?: string
  type: string
  address?: string
  city?: string
  country?: string
  is_active: boolean
  is_default: boolean
  branch_id?: string
  manager_id?: string
  contact_phone?: string
  contact_email?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WarehouseLocationEntity extends Record<string, unknown> {
  id: string
  warehouse_id: string
  company_id: string
  code: string
  name?: string
  name_ar?: string
  type: string
  is_active: boolean
  is_pickable: boolean
  max_weight?: number
  max_volume?: number
  zone?: string
  aisle?: string
  rack?: string
  shelf?: string
  barcode?: string
  parent_location_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateWarehouseInput {
  code: string
  name: string
  name_ar?: string
  type?: string
  address?: string
  city?: string
  country?: string
  is_default?: boolean
  branch_id?: string
  manager_id?: string
  contact_phone?: string
  contact_email?: string
  metadata?: Record<string, unknown>
}

export interface CreateLocationInput {
  warehouse_id: string
  code: string
  name?: string
  name_ar?: string
  type?: string
  is_pickable?: boolean
  max_weight?: number
  max_volume?: number
  zone?: string
  aisle?: string
  rack?: string
  shelf?: string
  barcode?: string
  parent_location_id?: string
  metadata?: Record<string, unknown>
}

export interface WarehouseTree {
  warehouse: WarehouseEntity
  locations: WarehouseLocationEntity[]
}
