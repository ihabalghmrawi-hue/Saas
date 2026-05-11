// Accounting event types — every ERP action that must generate a journal entry

export type AccountingEventType =
  | 'sale_cash'           // Cash sale: DR Cash / CR Sales Revenue
  | 'sale_credit'         // Credit sale: DR AR / CR Sales Revenue
  | 'sale_cogs'           // Cost of sale: DR COGS / CR Inventory
  | 'sale_payment'        // Customer pays AR: DR Cash / CR AR
  | 'sale_return_cash'    // Return with cash refund: DR Sales Rev / CR Cash
  | 'sale_return_credit'  // Return on credit: DR Sales Rev / CR AR
  | 'sale_return_cogs'    // COGS reversal: DR Inventory / CR COGS
  | 'purchase_cash'       // Cash purchase: DR Inventory / CR Cash
  | 'purchase_credit'     // Credit purchase: DR Inventory / CR AP
  | 'purchase_payment'    // Pay supplier AP: DR AP / CR Cash
  | 'expense_cash'        // Cash expense: DR Expense / CR Cash
  | 'expense_accrual'     // Accrued expense: DR Expense / CR AP
  | 'treasury_transfer'   // Internal transfer: DR Account-B / CR Account-A
  | 'rental_revenue'      // Rental income: DR Cash / CR Rental Revenue
  | 'inventory_adjustment'// Manual adjustment: DR/CR Inventory Adjustment
  | 'construction_expense'// Project expense: DR Project Expense / CR Cash

export interface AccountingEvent {
  type:        AccountingEventType
  companyId:   string
  amount:      number
  date?:       string       // ISO date, defaults to today
  description: string
  reference:   string       // INV-001, EXP-001, etc.
  sourceId?:   string       // UUID of originating record
  source?:     string       // 'sale' | 'purchase' | 'expense' | 'pos' | ...
  debitAccountCode?:  string  // Override default account mapping
  creditAccountCode?: string  // Override default account mapping
  lines?:      Array<{       // For complex multi-line entries
    accountCode: string
    debit:       number
    credit:      number
    description?: string
  }>
  metadata?:   Record<string, unknown>
}

// Default Chart of Accounts codes used in auto-posting
export const DEFAULT_ACCOUNTS = {
  // Assets
  CASH:               '1110',
  ACCOUNTS_RECEIVABLE:'1120',
  INVENTORY:          '1130',

  // Liabilities
  ACCOUNTS_PAYABLE:   '2110',

  // Revenue
  SALES_REVENUE:      '4001',
  SERVICE_REVENUE:    '4002',
  RENTAL_REVENUE:     '4003',

  // COGS
  COST_OF_GOODS_SOLD: '5001',

  // Expenses
  RENT:               '6001',
  SALARIES:           '6002',
  UTILITIES:          '6003',
  MARKETING:          '6004',
  MAINTENANCE:        '6005',
  SUPPLIES:           '6006',
  TRANSPORTATION:     '6007',
  MISCELLANEOUS:      '6008',
  CONSTRUCTION_LABOR: '6009',
  CONSTRUCTION_MAT:   '6010',

  // Adjustment
  INVENTORY_ADJUSTMENT: '6099',
} as const
