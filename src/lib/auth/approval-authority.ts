import type { Permission, Role } from './permissions'

export interface ApprovalAuthority {
  minAmount: number
  maxAmount: number
  requiredRole: Role
  requiresSecondApproval: boolean
  secondApprovalRole?: Role
}

export const APPROVAL_AUTHORITIES: Record<string, ApprovalAuthority> = {
  purchase_order: {
    minAmount: 0, maxAmount: 5000, requiredRole: 'procurement_manager', requiresSecondApproval: false,
  },
  purchase_order_medium: {
    minAmount: 5000, maxAmount: 50000, requiredRole: 'procurement_manager', requiresSecondApproval: true, secondApprovalRole: 'finance_manager',
  },
  purchase_order_large: {
    minAmount: 50000, maxAmount: Infinity, requiredRole: 'finance_manager', requiresSecondApproval: true, secondApprovalRole: 'super_admin',
  },
  invoice_payment: {
    minAmount: 0, maxAmount: 10000, requiredRole: 'accountant', requiresSecondApproval: false,
  },
  invoice_payment_large: {
    minAmount: 10000, maxAmount: Infinity, requiredRole: 'finance_manager', requiresSecondApproval: false,
  },
  journal_entry: {
    minAmount: 0, maxAmount: 100000, requiredRole: 'accountant', requiresSecondApproval: false,
  },
  journal_entry_large: {
    minAmount: 100000, maxAmount: Infinity, requiredRole: 'finance_manager', requiresSecondApproval: false,
  },
  payroll_run: {
    minAmount: 0, maxAmount: Infinity, requiredRole: 'hr_manager', requiresSecondApproval: true, secondApprovalRole: 'finance_manager',
  },
  stock_adjustment: {
    minAmount: 0, maxAmount: 5000, requiredRole: 'inventory_manager', requiresSecondApproval: false,
  },
  stock_adjustment_large: {
    minAmount: 5000, maxAmount: Infinity, requiredRole: 'inventory_manager', requiresSecondApproval: true, secondApprovalRole: 'finance_manager',
  },
}

export function getApprovalAuthority(documentType: string, amount: number): ApprovalAuthority | null {
  const keys = Object.keys(APPROVAL_AUTHORITIES).filter(k => k.startsWith(documentType))
  if (keys.length === 0) return null
  
  let bestMatch: ApprovalAuthority | null = null
  for (const key of keys) {
    const auth = APPROVAL_AUTHORITIES[key]
    if (amount >= auth.minAmount && amount < auth.maxAmount) {
      bestMatch = auth
    }
  }
  return bestMatch
}

export function canApprove(userRole: Role, documentType: string, amount: number): { approved: boolean; requiresSecond?: boolean; secondRole?: Role; reason?: string } {
  const authority = getApprovalAuthority(documentType, amount)
  if (!authority) return { approved: false, reason: 'لا توجد صلاحية اعتماد لهذا النوع' }
  
  const roleHierarchy: Role[] = ['operator', 'payroll_specialist', 'accountant', 'sales_manager', 'procurement_manager', 'hr_manager', 'inventory_manager', 'finance_manager', 'auditor', 'super_admin']
  const userIdx = roleHierarchy.indexOf(userRole)
  const requiredIdx = roleHierarchy.indexOf(authority.requiredRole)
  
  if (userIdx < requiredIdx) {
    return { approved: false, reason: `يتطلب صلاحية ${authority.requiredRole} على الأقل` }
  }
  
  if (authority.requiresSecondApproval) {
    return { approved: true, requiresSecond: true, secondRole: authority.secondApprovalRole }
  }
  
  return { approved: true }
}
