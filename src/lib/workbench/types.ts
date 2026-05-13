export type WorkbenchView = 'list' | 'detail' | 'split' | 'graph'

export interface WorkbenchAction {
  id: string
  label: string
  icon?: string
  type: 'primary' | 'secondary' | 'danger' | 'ghost'
  shortcut?: string
  handler?: () => void
}

export interface WorkbenchMetric {
  id: string
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down'
  icon?: string
  severity?: 'info' | 'warning' | 'critical' | 'success'
}

export interface InspectorTab {
  id: string
  label: string
  icon: string
  badge?: number
}

export interface ValidationMessage {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  field?: string
  action?: { label: string; handler: () => void }
}

export interface AIInsight {
  id: string
  type: 'anomaly' | 'recommendation' | 'insight' | 'summary' | 'optimization'
  title: string
  description: string
  confidence: number
  actionable: boolean
  action?: { label: string; handler: () => void }
}

export interface CrossModuleLink {
  module: string
  entityId: string
  entityName: string
  route: string
  type: 'financial' | 'inventory' | 'procurement' | 'sales' | 'payroll' | 'workflow'
}

export interface AuditTrailEntry {
  id: string
  action: string
  actor: string
  timestamp: number
  details: string
  type: 'create' | 'update' | 'approve' | 'reject' | 'post' | 'validate' | 'system'
}

export interface DocumentAttachment {
  id: string
  name: string
  type: string
  size: number
  uploadedBy: string
  uploadedAt: number
  url?: string
}

export interface OperationalComment {
  id: string
  text: string
  author: string
  timestamp: number
  attachments?: DocumentAttachment[]
  resolved?: boolean
}

export interface ValidationRule {
  id: string
  field: string
  rule: string
  message: string
  severity: 'error' | 'warning'
  validate: (value: unknown, context: Record<string, unknown>) => boolean
}

export interface AccountSummary {
  id: string
  code: string
  name: string
  type: string
  balance: number
  debitTotal: number
  creditTotal: number
  transactionCount: number
  lastActivity: number
  status: 'active' | 'inactive' | 'frozen'
}

export interface TransactionEntry {
  id: string
  date: number
  reference: string
  description: string
  accountId: string
  accountName: string
  debit: number
  credit: number
  amount: number
  currency: string
  status: 'draft' | 'posted' | 'pending' | 'rejected'
  createdBy: string
  createdAt: number
  approvedBy?: string
  approvedAt?: number
  type: string
  category: string
  validationMessages: ValidationMessage[]
  attachments: DocumentAttachment[]
  comments: OperationalComment[]
}

export interface Invoice {
  id: string
  number: string
  type: 'payable' | 'receivable'
  vendorOrCustomer: string
  date: number
  dueDate: number
  amount: number
  paidAmount: number
  balance: number
  currency: string
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue' | 'cancelled'
  lines: InvoiceLine[]
  validationMessages: ValidationMessage[]
}

export interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  tax: number
  total: number
  accountCode: string
}

export interface PurchaseOrder {
  id: string
  number: string
  supplier: string
  date: number
  expectedDate: number
  amount: number
  status: 'draft' | 'pending' | 'approved' | 'received' | 'closed' | 'cancelled'
  items: PurchaseOrderLine[]
  validationMessages: ValidationMessage[]
}

export interface PurchaseOrderLine {
  id: string
  item: string
  description: string
  quantity: number
  received: number
  unitPrice: number
  amount: number
}

export interface SalesOrder {
  id: string
  number: string
  customer: string
  date: number
  expectedDate: number
  amount: number
  status: 'draft' | 'pending' | 'approved' | 'shipped' | 'invoiced' | 'closed' | 'cancelled'
  items: SalesOrderLine[]
  validationMessages: ValidationMessage[]
}

export interface SalesOrderLine {
  id: string
  item: string
  description: string
  quantity: number
  shipped: number
  unitPrice: number
  amount: number
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: string
  warehouse: string
  bin: string
  onHand: number
  reserved: number
  available: number
  onOrder: number
  unitCost: number
  totalValue: number
  reorderPoint: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'
  lastCounted: number
  validationMessages: ValidationMessage[]
}

export interface PayrollRun {
  id: string
  period: string
  employeeCount: number
  totalAmount: number
  status: 'draft' | 'processing' | 'validated' | 'approved' | 'paid' | 'cancelled'
  startDate: number
  endDate: number
  payDate: number
  validationMessages: ValidationMessage[]
  anomalies: number
}

export interface PayrollEmployee {
  id: string
  employeeId: string
  name: string
  department: string
  basicSalary: number
  allowances: number
  deductions: number
  netPay: number
  bankAccount: string
  status: 'pending' | 'valid' | 'anomaly'
  validationMessages: ValidationMessage[]
}

export interface WorkbenchState {
  selectedId: string | null
  view: WorkbenchView
  inspectorTab: string
  inspectorOpen: boolean
  inspectorPinned: boolean
  filters: Record<string, string>
  searchQuery: string
  sortBy: string
  sortDir: 'asc' | 'desc'
}
