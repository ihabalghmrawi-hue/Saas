// ─── Entity Registry ──────────────────────────────────────────────────────────
// Single source of truth for every soft-deletable entity in the system.
// Add new modules here — the generic API and Trash UI pick them up automatically.

export type EntityType =
  | 'customer' | 'supplier'
  | 'product' | 'product_category' | 'warehouse'
  | 'sale' | 'purchase' | 'expense' | 'expense_category'
  | 'dress' | 'rental_order'

export interface EntityMeta {
  type:        EntityType
  table:       string         // Supabase table name
  labelAr:     string         // Arabic display name (plural)
  labelArSing: string         // Arabic display name (singular)
  module:      string         // module group for filtering
  nameField:   string         // field to use as display name
  companyField: string        // field that holds company_id for scoping
  // Dependencies: entities that block deletion
  blockedBy?: Array<{
    table:    string
    fk:       string
    labelAr:  string
    activeOnly?: boolean      // only count non-cancelled / non-deleted rows
  }>
  // Cascade soft-delete: child tables to also soft-delete
  cascadeSoftDelete?: Array<{ table: string; fk: string }>
  // Factory reset order (lower = deleted first)
  resetOrder: number
}

export const ENTITY_REGISTRY: Record<EntityType, EntityMeta> = {

  // ── Customers ──────────────────────────────────────────────────────────────
  customer: {
    type: 'customer', table: 'customers', module: 'sales',
    labelAr: 'العملاء', labelArSing: 'عميل', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'sales', fk: 'customer_id', labelAr: 'فواتير مبيعات', activeOnly: true },
    ],
    resetOrder: 50,
  },

  // ── Suppliers ─────────────────────────────────────────────────────────────
  supplier: {
    type: 'supplier', table: 'suppliers', module: 'purchases',
    labelAr: 'الموردون', labelArSing: 'مورد', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'purchases', fk: 'supplier_id', labelAr: 'فواتير مشتريات', activeOnly: true },
    ],
    resetOrder: 50,
  },

  // ── Products ──────────────────────────────────────────────────────────────
  product: {
    type: 'product', table: 'products', module: 'inventory',
    labelAr: 'المنتجات', labelArSing: 'منتج', nameField: 'name', companyField: 'company_id',
    blockedBy: [],
    cascadeSoftDelete: [
      { table: 'inventory', fk: 'product_id' },
    ],
    resetOrder: 40,
  },

  // ── Product Categories ────────────────────────────────────────────────────
  product_category: {
    type: 'product_category', table: 'product_categories', module: 'inventory',
    labelAr: 'فئات المنتجات', labelArSing: 'فئة منتج', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'products', fk: 'category_id', labelAr: 'منتجات', activeOnly: false },
    ],
    resetOrder: 20,
  },

  // ── Warehouses ────────────────────────────────────────────────────────────
  warehouse: {
    type: 'warehouse', table: 'warehouses', module: 'inventory',
    labelAr: 'المستودعات', labelArSing: 'مستودع', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'inventory', fk: 'warehouse_id', labelAr: 'مخزون', activeOnly: false },
    ],
    resetOrder: 30,
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  sale: {
    type: 'sale', table: 'sales', module: 'sales',
    labelAr: 'المبيعات', labelArSing: 'فاتورة مبيعات', nameField: 'invoice_number', companyField: 'company_id',
    blockedBy: [],
    cascadeSoftDelete: [],
    resetOrder: 60,
  },

  // ── Purchases ─────────────────────────────────────────────────────────────
  purchase: {
    type: 'purchase', table: 'purchases', module: 'purchases',
    labelAr: 'المشتريات', labelArSing: 'فاتورة مشتريات', nameField: 'invoice_number', companyField: 'company_id',
    blockedBy: [],
    resetOrder: 60,
  },

  // ── Expenses ──────────────────────────────────────────────────────────────
  expense: {
    type: 'expense', table: 'expenses', module: 'finance',
    labelAr: 'المصروفات', labelArSing: 'مصروف', nameField: 'description', companyField: 'company_id',
    blockedBy: [],
    resetOrder: 60,
  },

  // ── Expense Categories ────────────────────────────────────────────────────
  expense_category: {
    type: 'expense_category', table: 'expense_categories', module: 'finance',
    labelAr: 'فئات المصروفات', labelArSing: 'فئة مصروف', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'expenses', fk: 'category_id', labelAr: 'مصروفات', activeOnly: false },
    ],
    resetOrder: 20,
  },

  // ── Dresses (Rental) ──────────────────────────────────────────────────────
  dress: {
    type: 'dress', table: 'dresses', module: 'rental',
    labelAr: 'الفساتين', labelArSing: 'فستان', nameField: 'name', companyField: 'company_id',
    blockedBy: [
      { table: 'rental_orders', fk: 'dress_id', labelAr: 'حجوزات نشطة', activeOnly: true },
    ],
    resetOrder: 40,
  },

  // ── Rental Orders ─────────────────────────────────────────────────────────
  rental_order: {
    type: 'rental_order', table: 'rental_orders', module: 'rental',
    labelAr: 'الحجوزات', labelArSing: 'حجز', nameField: 'customer_name', companyField: 'company_id',
    blockedBy: [],
    resetOrder: 60,
  },
}

// All unique modules
export const ENTITY_MODULES = [...new Set(Object.values(ENTITY_REGISTRY).map(e => e.module))]

// Factory reset order: sort by resetOrder DESC so children deleted before parents
export const RESET_ORDER: EntityType[] = Object.values(ENTITY_REGISTRY)
  .sort((a, b) => b.resetOrder - a.resetOrder)
  .map(e => e.type)

// Additional tables cleared during factory reset (no soft-delete support)
export const RESET_HARD_TABLES = [
  { table: 'sale_items',         fk: 'company_id', via: 'sales' },
  { table: 'sale_payments',      fk: 'company_id', via: 'sales' },
  { table: 'purchase_items',     fk: 'company_id', via: 'purchases' },
  { table: 'purchase_payments',  fk: 'company_id', via: 'purchases' },
  { table: 'inventory_movements',fk: 'company_id', via: 'inventory' },
  { table: 'inventory',          fk: 'company_id', via: 'inventory' },
  { table: 'rental_returns',     fk: 'company_id', via: 'rental_orders' },
]

export function getEntity(type: string): EntityMeta | null {
  return ENTITY_REGISTRY[type as EntityType] ?? null
}
