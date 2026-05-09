// ============================================================
// Chart of Accounts Engine
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChartOfAccountsEntry, AccountType, NormalBalance, AccountLevel } from './types'

// ── COA seed definition ───────────────────────────────────────
interface COASeed {
  code:           string
  name:           string
  name_ar:        string
  type:           AccountType
  level:          AccountLevel
  is_postable:    boolean
  is_header:      boolean
  normal_balance: NormalBalance
  parent_code?:   string
  account_group:  string
}

export const STANDARD_COA: COASeed[] = [
  // ── ASSETS (Level 1) ─────────────────────────────────────
  {
    code: '1000', name: 'Assets', name_ar: 'الأصول',
    type: 'asset', level: 1, is_postable: false, is_header: true,
    normal_balance: 'debit', account_group: 'Assets',
  },
  // Current Assets (Level 2)
  {
    code: '1100', name: 'Current Assets', name_ar: 'الأصول المتداولة',
    type: 'asset', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '1000', account_group: 'Current Assets',
  },
  // Current Assets detail (Level 3)
  {
    code: '1101', name: 'Cash', name_ar: 'الصندوق',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  {
    code: '1102', name: 'Bank', name_ar: 'البنك',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  {
    code: '1110', name: 'Accounts Receivable', name_ar: 'الذمم المدينة',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  {
    code: '1120', name: 'Inventory', name_ar: 'المخزون',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  {
    code: '1130', name: 'Prepaid Expenses', name_ar: 'مدفوع مقدماً',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  {
    code: '1140', name: 'Input VAT', name_ar: 'ضريبة المدخلات',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1100', account_group: 'Current Assets',
  },
  // Fixed Assets (Level 2)
  {
    code: '1200', name: 'Fixed Assets', name_ar: 'الأصول الثابتة',
    type: 'asset', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '1000', account_group: 'Fixed Assets',
  },
  {
    code: '1201', name: 'Equipment', name_ar: 'المعدات والآلات',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1200', account_group: 'Fixed Assets',
  },
  {
    code: '1202', name: 'Furniture & Fixtures', name_ar: 'الأثاث والتجهيزات',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1200', account_group: 'Fixed Assets',
  },
  {
    code: '1203', name: 'Vehicles', name_ar: 'المركبات',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '1200', account_group: 'Fixed Assets',
  },
  {
    code: '1210', name: 'Accumulated Depreciation', name_ar: 'مجمع الاستهلاك',
    type: 'asset', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '1200', account_group: 'Fixed Assets',
  },

  // ── LIABILITIES (Level 1) ────────────────────────────────
  {
    code: '2000', name: 'Liabilities', name_ar: 'الخصوم',
    type: 'liability', level: 1, is_postable: false, is_header: true,
    normal_balance: 'credit', account_group: 'Liabilities',
  },
  // Current Liabilities (Level 2)
  {
    code: '2100', name: 'Current Liabilities', name_ar: 'الخصوم المتداولة',
    type: 'liability', level: 2, is_postable: false, is_header: true,
    normal_balance: 'credit', parent_code: '2000', account_group: 'Current Liabilities',
  },
  {
    code: '2101', name: 'Accounts Payable', name_ar: 'الذمم الدائنة',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  {
    code: '2102', name: 'Short-term Loans', name_ar: 'قروض قصيرة الأجل',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  {
    code: '2103', name: 'VAT Payable', name_ar: 'ضريبة المخرجات',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  {
    code: '2104', name: 'Accrued Expenses', name_ar: 'مصروفات مستحقة',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  {
    code: '2105', name: 'Customer Deposits', name_ar: 'أمانات العملاء',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  {
    code: '2106', name: 'Salaries Payable', name_ar: 'رواتب مستحقة الدفع',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2100', account_group: 'Current Liabilities',
  },
  // Long-term Liabilities (Level 2)
  {
    code: '2200', name: 'Long-term Liabilities', name_ar: 'الخصوم طويلة الأجل',
    type: 'liability', level: 2, is_postable: false, is_header: true,
    normal_balance: 'credit', parent_code: '2000', account_group: 'Long-term Liabilities',
  },
  {
    code: '2201', name: 'Long-term Loans', name_ar: 'قروض طويلة الأجل',
    type: 'liability', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '2200', account_group: 'Long-term Liabilities',
  },

  // ── EQUITY (Level 1) ─────────────────────────────────────
  {
    code: '3000', name: 'Equity', name_ar: 'حقوق الملكية',
    type: 'equity', level: 1, is_postable: false, is_header: true,
    normal_balance: 'credit', account_group: 'Equity',
  },
  {
    code: '3001', name: 'Capital', name_ar: 'رأس المال',
    type: 'equity', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '3000', account_group: 'Equity',
  },
  {
    code: '3002', name: 'Retained Earnings', name_ar: 'الأرباح المحتجزة',
    type: 'equity', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '3000', account_group: 'Equity',
  },
  {
    code: '3003', name: 'Owner Drawings', name_ar: 'مسحوبات صاحب العمل',
    type: 'equity', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '3000', account_group: 'Equity',
  },
  {
    code: '3099', name: 'Income Summary', name_ar: 'ملخص الدخل',
    type: 'equity', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '3000', account_group: 'Equity',
  },

  // ── REVENUE (Level 1) ────────────────────────────────────
  {
    code: '4000', name: 'Revenue', name_ar: 'الإيرادات',
    type: 'revenue', level: 1, is_postable: false, is_header: true,
    normal_balance: 'credit', account_group: 'Revenue',
  },
  {
    code: '4001', name: 'Sales Revenue', name_ar: 'المبيعات',
    type: 'revenue', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '4000', account_group: 'Revenue',
  },
  {
    code: '4002', name: 'Sales Returns', name_ar: 'مردودات المبيعات',
    type: 'revenue', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '4000', account_group: 'Revenue',
  },
  {
    code: '4003', name: 'Service Revenue', name_ar: 'إيرادات الخدمات',
    type: 'revenue', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '4000', account_group: 'Revenue',
  },
  {
    code: '4004', name: 'Rental Revenue', name_ar: 'إيرادات الإيجار',
    type: 'revenue', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '4000', account_group: 'Revenue',
  },
  {
    code: '4090', name: 'Other Revenue', name_ar: 'إيرادات أخرى',
    type: 'revenue', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '4000', account_group: 'Revenue',
  },

  // ── COGS (Level 1) ───────────────────────────────────────
  {
    code: '5000', name: 'Cost of Goods Sold', name_ar: 'تكلفة البضاعة المباعة',
    type: 'cogs', level: 1, is_postable: false, is_header: true,
    normal_balance: 'debit', account_group: 'COGS',
  },
  {
    code: '5001', name: 'Cost of Goods Sold', name_ar: 'تكلفة البضاعة',
    type: 'cogs', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '5000', account_group: 'COGS',
  },
  {
    code: '5002', name: 'Purchases', name_ar: 'المشتريات',
    type: 'cogs', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '5000', account_group: 'COGS',
  },
  {
    code: '5003', name: 'Purchase Returns', name_ar: 'مردودات المشتريات',
    type: 'cogs', level: 3, is_postable: true, is_header: false,
    normal_balance: 'credit', parent_code: '5000', account_group: 'COGS',
  },
  {
    code: '5004', name: 'Freight In', name_ar: 'مصاريف الشحن الواردة',
    type: 'cogs', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '5000', account_group: 'COGS',
  },

  // ── EXPENSES (Level 1) ───────────────────────────────────
  {
    code: '6000', name: 'Operating Expenses', name_ar: 'المصروفات التشغيلية',
    type: 'expense', level: 1, is_postable: false, is_header: true,
    normal_balance: 'debit', account_group: 'Expenses',
  },
  // Personnel Expenses (Level 2)
  {
    code: '6100', name: 'Personnel Expenses', name_ar: 'مصروفات الموظفين',
    type: 'expense', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '6000', account_group: 'Personnel',
  },
  {
    code: '6101', name: 'Salaries & Wages', name_ar: 'الرواتب والأجور',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6100', account_group: 'Personnel',
  },
  {
    code: '6102', name: 'Employee Benefits', name_ar: 'مزايا الموظفين',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6100', account_group: 'Personnel',
  },
  // Occupancy Expenses (Level 2)
  {
    code: '6200', name: 'Occupancy Expenses', name_ar: 'مصروفات الموقع',
    type: 'expense', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '6000', account_group: 'Occupancy',
  },
  {
    code: '6201', name: 'Rent', name_ar: 'الإيجار',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6200', account_group: 'Occupancy',
  },
  {
    code: '6202', name: 'Utilities', name_ar: 'الكهرباء والماء',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6200', account_group: 'Occupancy',
  },
  {
    code: '6203', name: 'Maintenance & Repairs', name_ar: 'الصيانة والإصلاحات',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6200', account_group: 'Occupancy',
  },
  // Marketing Expenses (Level 2)
  {
    code: '6300', name: 'Marketing Expenses', name_ar: 'مصروفات التسويق',
    type: 'expense', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '6000', account_group: 'Marketing',
  },
  {
    code: '6301', name: 'Advertising & Marketing', name_ar: 'الإعلان والتسويق',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6300', account_group: 'Marketing',
  },
  // Financial Expenses (Level 2)
  {
    code: '6400', name: 'Financial Expenses', name_ar: 'المصروفات المالية',
    type: 'expense', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '6000', account_group: 'Financial',
  },
  {
    code: '6401', name: 'Interest Expense', name_ar: 'مصروفات الفائدة',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6400', account_group: 'Financial',
  },
  {
    code: '6402', name: 'Bank Charges', name_ar: 'عمولات بنكية',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6400', account_group: 'Financial',
  },
  // Miscellaneous Expenses (Level 2)
  {
    code: '6500', name: 'General Expenses', name_ar: 'المصروفات العامة',
    type: 'expense', level: 2, is_postable: false, is_header: true,
    normal_balance: 'debit', parent_code: '6000', account_group: 'General',
  },
  {
    code: '6501', name: 'Miscellaneous Expenses', name_ar: 'مصروفات متنوعة',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6500', account_group: 'General',
  },
  {
    code: '6502', name: 'Inventory Write-off', name_ar: 'هالك مخزون',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6500', account_group: 'General',
  },
  {
    code: '6503', name: 'Depreciation Expense', name_ar: 'مصروف الاستهلاك',
    type: 'expense', level: 3, is_postable: true, is_header: false,
    normal_balance: 'debit', parent_code: '6500', account_group: 'General',
  },
]

// ── ensureCOA ─────────────────────────────────────────────────
export async function ensureCOA(
  supabase:   SupabaseClient,
  company_id: string,
): Promise<{ accounts: Record<string, string>; created: boolean }> {
  // Fetch existing accounts for this company
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', company_id)
    .eq('is_active', true)

  const existingMap: Record<string, string> = {}
  for (const acct of existing || []) {
    existingMap[acct.code] = acct.id
  }

  // Build insertion order: parents first (sort by level, then code)
  const sorted = [...STANDARD_COA].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    return a.code.localeCompare(b.code)
  })

  // We need a two-pass approach: first pass creates, second pass builds map
  // We process level-by-level so parent IDs are available
  let created = false

  for (const acct of sorted) {
    if (existingMap[acct.code]) continue

    // Resolve parent_id
    let parent_id: string | null = null
    if (acct.parent_code) {
      parent_id = existingMap[acct.parent_code] || null
    }

    const { data: newAcct, error } = await supabase
      .from('accounts')
      .insert({
        company_id,
        code:           acct.code,
        name:           acct.name,
        name_ar:        acct.name_ar,
        type:           acct.type,
        level:          acct.level,
        is_postable:    acct.is_postable,
        is_header:      acct.is_header,
        normal_balance: acct.normal_balance,
        account_group:  acct.account_group,
        parent_id,
        current_balance: 0,
        is_active:       true,
        is_system:       true,
      })
      .select('id, code')
      .single()

    if (!error && newAcct) {
      existingMap[newAcct.code] = newAcct.id
      created = true
    }
  }

  return { accounts: existingMap, created }
}

// ── getAccountId ──────────────────────────────────────────────
export async function getAccountId(
  supabase:   SupabaseClient,
  company_id: string,
  code:       string,
): Promise<string | null> {
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', company_id)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  return data?.id ?? null
}

// ── buildAccountTree ──────────────────────────────────────────
export function buildAccountTree(
  accounts: ChartOfAccountsEntry[],
): ChartOfAccountsEntry[] {
  const map: Record<string, ChartOfAccountsEntry> = {}
  const roots: ChartOfAccountsEntry[] = []

  for (const acct of accounts) {
    map[acct.id] = { ...acct, children: [] }
  }

  for (const acct of accounts) {
    if (acct.parent_id && map[acct.parent_id]) {
      map[acct.parent_id].children!.push(map[acct.id])
    } else {
      roots.push(map[acct.id])
    }
  }

  // Sort each level by code
  function sortChildren(nodes: ChartOfAccountsEntry[]): ChartOfAccountsEntry[] {
    nodes.sort((a, b) => a.code.localeCompare(b.code))
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        node.children = sortChildren(node.children)
      }
    }
    return nodes
  }

  return sortChildren(roots)
}
