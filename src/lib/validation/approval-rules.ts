import type { ValidationMessage } from '@/lib/workbench/types'

export interface ApprovalRoute {
  minAmount: number
  maxAmount: number
  requiredRoles: string[]
  requiresSecondApproval: boolean
  secondApprovalRoles?: string[]
  slaMinutes: number
  escalationLevels: { afterMinutes: number; action: string; targetRole: string }[]
}

const approvalRoutes: Record<string, ApprovalRoute[]> = {
  purchase_order: [
    {
      minAmount: 0,
      maxAmount: 4999.99,
      requiredRoles: ['procurement_manager'],
      requiresSecondApproval: false,
      slaMinutes: 120,
      escalationLevels: [
        { afterMinutes: 90, action: 'remind', targetRole: 'procurement_manager' },
        { afterMinutes: 120, action: 'escalate', targetRole: 'finance_manager' },
      ],
    },
    {
      minAmount: 5000,
      maxAmount: 50000,
      requiredRoles: ['procurement_manager', 'finance_manager'],
      requiresSecondApproval: true,
      secondApprovalRoles: ['finance_manager'],
      slaMinutes: 240,
      escalationLevels: [
        { afterMinutes: 180, action: 'remind', targetRole: 'procurement_manager' },
        { afterMinutes: 240, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
    {
      minAmount: 50000.01,
      maxAmount: Infinity,
      requiredRoles: ['finance_manager', 'super_admin'],
      requiresSecondApproval: true,
      secondApprovalRoles: ['super_admin'],
      slaMinutes: 480,
      escalationLevels: [
        { afterMinutes: 360, action: 'remind', targetRole: 'finance_manager' },
        { afterMinutes: 480, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
  invoice_payment: [
    {
      minAmount: 0,
      maxAmount: 9999.99,
      requiredRoles: ['accountant'],
      requiresSecondApproval: false,
      slaMinutes: 60,
      escalationLevels: [
        { afterMinutes: 45, action: 'remind', targetRole: 'accountant' },
        { afterMinutes: 60, action: 'escalate', targetRole: 'finance_manager' },
      ],
    },
    {
      minAmount: 10000,
      maxAmount: Infinity,
      requiredRoles: ['finance_manager'],
      requiresSecondApproval: false,
      slaMinutes: 120,
      escalationLevels: [
        { afterMinutes: 90, action: 'remind', targetRole: 'finance_manager' },
        { afterMinutes: 120, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
  journal_entry: [
    {
      minAmount: 0,
      maxAmount: 99999.99,
      requiredRoles: ['accountant'],
      requiresSecondApproval: false,
      slaMinutes: 120,
      escalationLevels: [
        { afterMinutes: 90, action: 'remind', targetRole: 'accountant' },
        { afterMinutes: 120, action: 'escalate', targetRole: 'finance_manager' },
      ],
    },
    {
      minAmount: 100000,
      maxAmount: Infinity,
      requiredRoles: ['finance_manager'],
      requiresSecondApproval: false,
      slaMinutes: 240,
      escalationLevels: [
        { afterMinutes: 180, action: 'remind', targetRole: 'finance_manager' },
        { afterMinutes: 240, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
  payroll_run: [
    {
      minAmount: 0,
      maxAmount: Infinity,
      requiredRoles: ['hr_manager', 'finance_manager'],
      requiresSecondApproval: true,
      secondApprovalRoles: ['finance_manager'],
      slaMinutes: 720,
      escalationLevels: [
        { afterMinutes: 540, action: 'remind', targetRole: 'hr_manager' },
        { afterMinutes: 720, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
  stock_adjustment: [
    {
      minAmount: 0,
      maxAmount: 4999.99,
      requiredRoles: ['inventory_manager'],
      requiresSecondApproval: false,
      slaMinutes: 60,
      escalationLevels: [
        { afterMinutes: 45, action: 'remind', targetRole: 'inventory_manager' },
        { afterMinutes: 60, action: 'escalate', targetRole: 'finance_manager' },
      ],
    },
    {
      minAmount: 5000,
      maxAmount: Infinity,
      requiredRoles: ['inventory_manager', 'finance_manager'],
      requiresSecondApproval: true,
      secondApprovalRoles: ['finance_manager'],
      slaMinutes: 120,
      escalationLevels: [
        { afterMinutes: 90, action: 'remind', targetRole: 'inventory_manager' },
        { afterMinutes: 120, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
  sales_order: [
    {
      minAmount: 0,
      maxAmount: 19999.99,
      requiredRoles: ['sales_manager'],
      requiresSecondApproval: false,
      slaMinutes: 120,
      escalationLevels: [
        { afterMinutes: 90, action: 'remind', targetRole: 'sales_manager' },
        { afterMinutes: 120, action: 'escalate', targetRole: 'finance_manager' },
      ],
    },
    {
      minAmount: 20000,
      maxAmount: Infinity,
      requiredRoles: ['sales_manager', 'finance_manager'],
      requiresSecondApproval: true,
      secondApprovalRoles: ['finance_manager'],
      slaMinutes: 240,
      escalationLevels: [
        { afterMinutes: 180, action: 'remind', targetRole: 'sales_manager' },
        { afterMinutes: 240, action: 'escalate', targetRole: 'super_admin' },
      ],
    },
  ],
}

function matchRoute(
  routes: ApprovalRoute[],
  amount: number
): ApprovalRoute | undefined {
  return routes.find(
    r => amount >= r.minAmount && amount <= r.maxAmount
  )
}

export function getApprovalRoute(
  documentType: string,
  amount: number,
  department: string
): ApprovalRoute {
  const numericAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const routes = approvalRoutes[documentType]

  if (!routes || routes.length === 0) {
    return {
      minAmount: 0,
      maxAmount: Infinity,
      requiredRoles: ['finance_manager'],
      requiresSecondApproval: false,
      slaMinutes: 240,
      escalationLevels: [
        { afterMinutes: 180, action: 'remind', targetRole: 'finance_manager' },
        { afterMinutes: 240, action: 'escalate', targetRole: 'super_admin' },
      ],
    }
  }

  const matched = matchRoute(routes, numericAmount)
  if (matched) {
    return matched
  }

  return routes[routes.length - 1]
}

export function generateApprovalChain(
  documentType: string,
  amount: number,
  department: string,
  requesterId: string
): { levels: { role: string; order: number; slaMinutes: number; escalationAfter: number }[] } {
  const route = getApprovalRoute(documentType, amount, department)
  const levels: { role: string; order: number; slaMinutes: number; escalationAfter: number }[] = []

  let order = 1
  const slaPerLevel = route.slaMinutes / route.requiredRoles.length

  for (const role of route.requiredRoles) {
    const slaForRole = role === 'inventory_manager' && documentType === 'stock_adjustment'
      ? 60
      : slaPerLevel

    levels.push({
      role,
      order,
      slaMinutes: Math.round(slaForRole),
      escalationAfter: route.escalationLevels.length > 0
        ? route.escalationLevels[Math.min(order - 1, route.escalationLevels.length - 1)].afterMinutes
        : Math.round(slaForRole * 0.75),
    })
    order++
  }

  if (
    route.requiresSecondApproval &&
    route.secondApprovalRoles &&
    !route.requiredRoles.some(r => route.secondApprovalRoles!.includes(r))
  ) {
    for (const role of route.secondApprovalRoles) {
      levels.push({
        role,
        order,
        slaMinutes: Math.round(slaPerLevel),
        escalationAfter: route.escalationLevels.length > 0
          ? route.escalationLevels[route.escalationLevels.length - 1].afterMinutes
          : Math.round(slaPerLevel * 0.75),
      })
      order++
    }
  }

  return { levels }
}

export function validateApprovalCompletion(
  chain: { role: string; approved: boolean; timestamp?: number }[],
  slaMinutes: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!chain || chain.length === 0) {
    messages.push({
      id: 'ac-empty-chain',
      type: 'error',
      message: 'سلسلة الموافقات فارغة، لا توجد مستويات للموافقة',
      field: 'chain',
    })
    return messages
  }

  const now = Date.now()
  let allApproved = true
  let pendingCount = 0
  let rejectedCount = 0

  for (let i = 0; i < chain.length; i++) {
    const level = chain[i]

    if (!level.approved) {
      allApproved = false
      pendingCount++

      if (level.timestamp) {
        const elapsed = now - level.timestamp
        const slaMs = slaMinutes * 60 * 1000

        if (elapsed > slaMs) {
          messages.push({
            id: `ac-sla-exceeded-${i}`,
            type: 'error',
            message: `انتهى وقت مستوى الموافقة "${level.role}" (يتجاوز ${slaMinutes} دقيقة)، يجب التصعيد`,
            field: `chain[${i}].timestamp`,
          })
        } else {
          const remaining = Math.ceil((slaMs - elapsed) / 60000)
          messages.push({
            id: `ac-pending-${i}`,
            type: 'warning',
            message: `في انتظار موافقة "${level.role}"، الوقت المتبقي ${remaining} دقيقة`,
            field: `chain[${i}]`,
          })
        }
      } else {
        messages.push({
          id: `ac-not-started-${i}`,
          type: 'warning',
          message: `لم تبدأ بعد عملية الموافقة للمستوى "${level.role}"`,
          field: `chain[${i}]`,
        })
      }
    }
  }

  if (allApproved) {
    messages.push({
      id: 'ac-complete',
      type: 'success',
      message: 'جميع مستويات الموافقة مكتملة بنجاح',
      field: 'chain',
    })
  }

  return messages
}
