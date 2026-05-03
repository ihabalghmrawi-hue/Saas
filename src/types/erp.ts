export interface Product {
  id: string
  company_id: string
  category_id: string | null
  unit_id: string | null
  sku: string | null
  barcode: string | null
  name: string
  name_ar: string | null
  description: string | null
  type: 'product' | 'service' | 'bundle'
  cost_price: number
  sale_price: number
  wholesale_price: number
  tax_rate: number
  has_variants: boolean
  track_inventory: boolean
  min_stock_level: number
  max_stock_level: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  product_categories?: ProductCategory
  units?: Unit
  inventory?: Inventory[]
}

export interface ProductVariant {
  id: string
  product_id: string
  sku: string | null
  barcode: string | null
  name: string
  attributes: Record<string, string>
  cost_price: number | null
  sale_price: number | null
  image_url: string | null
  is_active: boolean
}

export interface ProductCategory {
  id: string
  company_id: string
  name: string
  name_ar: string | null
  parent_id: string | null
  icon: string | null
  color: string
  sort_order: number
  is_active: boolean
}

export interface Unit {
  id: string
  company_id: string
  name: string
  name_ar: string | null
  abbreviation: string | null
}

export interface Warehouse {
  id: string
  company_id: string
  name: string
  name_ar: string | null
  location: string | null
  is_default: boolean
  is_active: boolean
}

export interface Inventory {
  id: string
  product_id: string
  variant_id: string | null
  warehouse_id: string
  company_id: string
  quantity: number
  reserved_quantity: number
  updated_at: string
  warehouses?: Warehouse
}

export interface InventoryMovement {
  id: string
  company_id: string
  product_id: string
  variant_id: string | null
  warehouse_id: string
  type: 'purchase' | 'sale' | 'return_sale' | 'return_purchase' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'opening'
  quantity: number
  quantity_before: number
  quantity_after: number
  unit_cost: number
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
}

export interface Customer {
  id: string
  company_id: string
  code: string | null
  name: string
  name_ar: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  credit_limit: number
  balance: number
  loyalty_points: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  company_id: string
  code: string | null
  name: string
  name_ar: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  balance: number
  payment_terms: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  company_id: string
  invoice_number: string
  customer_id: string | null
  warehouse_id: string | null
  sale_date: string
  subtotal: number
  discount_amount: number
  discount_percent: number
  tax_amount: number
  total: number
  paid_amount: number
  change_amount: number
  due_amount: number
  payment_status: 'paid' | 'partial' | 'unpaid' | 'refunded'
  status: 'draft' | 'completed' | 'cancelled' | 'returned'
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  customers?: Customer
  sale_items?: SaleItem[]
  sale_payments?: SalePayment[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_price: number
  cost_price: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
  line_number: number
  // Joined
  products?: Product
}

export interface SalePayment {
  id: string
  sale_id: string
  company_id: string
  method: 'cash' | 'card' | 'wallet' | 'bank_transfer' | 'credit'
  amount: number
  reference: string | null
  notes: string | null
  created_at: string
}

export interface Purchase {
  id: string
  company_id: string
  invoice_number: string
  supplier_id: string | null
  warehouse_id: string | null
  purchase_date: string
  due_date: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  paid_amount: number
  due_amount: number
  payment_status: 'paid' | 'partial' | 'unpaid'
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  suppliers?: Supplier
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  unit_cost: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
  line_number: number
  products?: Product
}

export interface Expense {
  id: string
  company_id: string
  category_id: string | null
  amount: number
  description: string
  expense_date: string
  payment_method: string
  reference: string | null
  attachment_url: string | null
  created_at: string
  expense_categories?: ExpenseCategory
}

export interface ExpenseCategory {
  id: string
  company_id: string
  name: string
  name_ar: string | null
  icon: string | null
  color: string
}

// POS Cart
export interface CartItem {
  product: Product
  variant?: ProductVariant
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
}

export interface POSCart {
  items: CartItem[]
  customer: Customer | null
  discount_percent: number
  discount_amount: number
  subtotal: number
  tax_amount: number
  total: number
  payments: { method: SalePayment['method']; amount: number }[]
  notes: string
}

// Dashboard Stats
export interface ERPDashboardStats {
  todaySales: number
  todayTransactions: number
  weekSales: number
  monthSales: number
  monthProfit: number
  lowStockCount: number
  pendingPayments: number
  totalCustomers: number
  totalProducts: number
}
