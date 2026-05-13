import type { ValidationMessage } from '@/lib/workbench/types'

export function validatePurchaseOrder(
  items: { quantity: number; unitPrice: number }[],
  supplierStatus: string,
  budgetRemaining: number,
  totalAmount: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!items || items.length === 0) {
    messages.push({
      id: 'po-no-items',
      type: 'error',
      message: 'يجب إضافة بند واحد على الأقل إلى أمر الشراء',
      field: 'items',
    })
    return messages
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.quantity === 0) {
      messages.push({
        id: `po-zero-qty-${i}`,
        type: 'error',
        message: `الكمية في البند رقم ${i + 1} تساوي صفر، يجب إدخال كمية صحيحة`,
        field: `items[${i}].quantity`,
      })
    }
    if (item.quantity < 0) {
      messages.push({
        id: `po-negative-qty-${i}`,
        type: 'error',
        message: `الكمية في البند رقم ${i + 1} سالبة (${item.quantity})، الكمية يجب أن تكون موجبة`,
        field: `items[${i}].quantity`,
      })
    }
    if (item.unitPrice < 0) {
      messages.push({
        id: `po-negative-price-${i}`,
        type: 'error',
        message: `سعر الوحدة في البند رقم ${i + 1} سالب (${item.unitPrice})، السعر يجب أن يكون موجباً`,
        field: `items[${i}].unitPrice`,
      })
    }
  }

  if (totalAmount < 0) {
    messages.push({
      id: 'po-negative-total',
      type: 'error',
      message: 'المبلغ الإجمالي لأمر الشراء لا يمكن أن يكون سالباً',
      field: 'totalAmount',
    })
  }

  if (!supplierStatus || supplierStatus !== 'active') {
    messages.push({
      id: 'po-supplier-inactive',
      type: 'error',
      message: `المورد غير نشط (الحالة: ${supplierStatus || 'غير معروف'})، يجب أن يكون المورد نشطاً لإنشاء أمر الشراء`,
      field: 'supplierStatus',
    })
  }

  if (budgetRemaining < 0) {
    messages.push({
      id: 'po-negative-budget',
      type: 'error',
      message: 'الميزانية المتبقية سالبة، لا يمكن إنشاء أمر الشراء',
      field: 'budgetRemaining',
    })
  }

  if (totalAmount > budgetRemaining) {
    messages.push({
      id: 'po-insufficient-budget',
      type: 'error',
      message: `المبلغ الإجمالي (${totalAmount.toFixed(2)}) يتجاوز الميزانية المتبقية (${budgetRemaining.toFixed(2)})، غير كافٍ لتغطية أمر الشراء`,
      field: 'totalAmount',
    })
  }

  const approvalThreshold = 50000
  if (totalAmount > approvalThreshold) {
    messages.push({
      id: 'po-exceeds-threshold',
      type: 'warning',
      message: `المبلغ الإجمالي (${totalAmount.toFixed(2)}) يتجاوز حد الاعتماد المباشر (${approvalThreshold.toFixed(2)})، يتطلب موافقة إدارة أعلى`,
      field: 'totalAmount',
    })
  }

  return messages
}

export function validateSalesOrder(
  customerCreditLimit: number,
  currentBalance: number,
  orderAmount: number,
  itemsStock: { available: number; requested: number }[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (customerCreditLimit < 0) {
    messages.push({
      id: 'so-negative-credit-limit',
      type: 'error',
      message: 'حد الائتمان للعميل لا يمكن أن يكون سالباً',
      field: 'customerCreditLimit',
    })
  }

  if (currentBalance < 0) {
    messages.push({
      id: 'so-negative-balance',
      type: 'error',
      message: 'الرصيد الحالي للعميل لا يمكن أن يكون سالباً',
      field: 'currentBalance',
    })
  }

  if (orderAmount <= 0) {
    messages.push({
      id: 'so-invalid-amount',
      type: 'error',
      message: 'مبلغ أمر البيع يجب أن يكون أكبر من صفر',
      field: 'orderAmount',
    })
  }

  if (customerCreditLimit > 0) {
    const newBalance = currentBalance + orderAmount
    if (newBalance > customerCreditLimit) {
      messages.push({
        id: 'so-credit-limit-exceeded',
        type: 'error',
        message: `الرصيد الجديد (${newBalance.toFixed(2)}) يتجاوز حد الائتمان المسموح به (${customerCreditLimit.toFixed(2)}) للعميل`,
        field: 'orderAmount',
      })
    }
  }

  const minOrderAmount = 100
  if (orderAmount < minOrderAmount) {
    messages.push({
      id: 'so-below-minimum',
      type: 'warning',
      message: `مبلغ أمر البيع (${orderAmount.toFixed(2)}) أقل من الحد الأدنى المسموح به (${minOrderAmount.toFixed(2)})`,
      field: 'orderAmount',
    })
  }

  if (!itemsStock || itemsStock.length === 0) {
    messages.push({
      id: 'so-no-stock-items',
      type: 'error',
      message: 'لا توجد أصناف في أمر البيع للتحقق من التوفر',
      field: 'itemsStock',
    })
  } else {
    for (let i = 0; i < itemsStock.length; i++) {
      const si = itemsStock[i]
      if (si.requested <= 0) {
        messages.push({
          id: `so-invalid-requested-${i}`,
          type: 'error',
          message: `الكمية المطلوبة للصنف رقم ${i + 1} غير صالحة (${si.requested})`,
          field: `itemsStock[${i}].requested`,
        })
      }
      if (si.available < 0) {
        messages.push({
          id: `so-negative-available-${i}`,
          type: 'error',
          message: `الكمية المتوفرة للصنف رقم ${i + 1} سالبة (${si.available})`,
          field: `itemsStock[${i}].available`,
        })
      }
      if (si.requested > si.available) {
        messages.push({
          id: `so-insufficient-stock-${i}`,
          type: 'error',
          message: `الكمية المطلوبة للصنف رقم ${i + 1} (${si.requested}) تتجاوز الكمية المتوفرة (${si.available})`,
          field: `itemsStock[${i}].requested`,
        })
      }
    }
  }

  return messages
}

export function validateInventoryAdjustment(
  currentStock: number,
  adjustmentQty: number,
  reason: string,
  requiresApproval: boolean
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (currentStock < 0) {
    messages.push({
      id: 'inv-negative-stock',
      type: 'error',
      message: 'المخزون الحالي لا يمكن أن يكون سالباً',
      field: 'currentStock',
    })
  }

  if (adjustmentQty === 0) {
    messages.push({
      id: 'inv-zero-adjustment',
      type: 'warning',
      message: 'كمية التعديل تساوي صفر، هذا الإجراء ليس له تأثير على المخزون',
      field: 'adjustmentQty',
    })
  }

  if (!reason || reason.trim().length === 0) {
    messages.push({
      id: 'inv-no-reason',
      type: 'error',
      message: 'سبب التعديل مطلوب، يرجى إدخال سبب واضح للتعديل على المخزون',
      field: 'reason',
    })
  }

  const newStock = currentStock + adjustmentQty
  const isWriteOff = reason && reason.toLowerCase().includes('شطب')

  if (newStock < 0 && !isWriteOff) {
    messages.push({
      id: 'inv-negative-new-stock',
      type: 'error',
      message: `المخزون الجديد (${newStock}) سالب، التعديل سيؤدي إلى رصيد سلبي في المخزون`,
      field: 'adjustmentQty',
    })
  }

  if (newStock < 0 && isWriteOff) {
    messages.push({
      id: 'inv-writeoff-negative',
      type: 'warning',
      message: `رصيد المخزون بعد عملية الشطب سالب (${newStock})، يرجى التأكد من صحة كمية الشطب`,
      field: 'adjustmentQty',
    })
  }

  if (currentStock > 0) {
    const adjustmentPct = Math.abs(adjustmentQty) / currentStock * 100
    if (adjustmentPct > 10 && requiresApproval) {
      messages.push({
        id: 'inv-large-adjustment',
        type: 'warning',
        message: `نسبة التعديل (${adjustmentPct.toFixed(2)}%) تتجاوز 10% من المخزون الحالي، يتطلب هذا التعديل موافقة إدارية`,
        field: 'adjustmentQty',
      })
    }
  }

  return messages
}

export function validatePayrollRun(
  employees: { baseSalary: number; allowances: number; deductions: number }[],
  totalBudget: number,
  periodEndDate: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!employees || employees.length === 0) {
    messages.push({
      id: 'pr-no-employees',
      type: 'error',
      message: 'لا يوجد موظفون في دورة الرواتب الحالية',
      field: 'employees',
    })
    return messages
  }

  if (totalBudget < 0) {
    messages.push({
      id: 'pr-negative-budget',
      type: 'error',
      message: 'الميزانية الإجمالية للرواتب لا يمكن أن تكون سالبة',
      field: 'totalBudget',
    })
  }

  if (periodEndDate <= 0) {
    messages.push({
      id: 'pr-invalid-period',
      type: 'error',
      message: 'تاريخ انتهاء الفترة غير صالح',
      field: 'periodEndDate',
    })
  }

  let totalNetPay = 0

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i]

    if (emp.baseSalary < 0) {
      messages.push({
        id: `pr-negative-salary-${i}`,
        type: 'error',
        message: `الراتب الأساسي للموظف رقم ${i + 1} سالب (${emp.baseSalary})`,
        field: `employees[${i}].baseSalary`,
      })
    }

    if (emp.allowances < 0) {
      messages.push({
        id: `pr-negative-allowances-${i}`,
        type: 'error',
        message: `البدلات للموظف رقم ${i + 1} سالبة (${emp.allowances})`,
        field: `employees[${i}].allowances`,
      })
    }

    if (emp.deductions < 0) {
      messages.push({
        id: `pr-negative-deductions-${i}`,
        type: 'error',
        message: `الاستقطاعات للموظف رقم ${i + 1} سالبة (${emp.deductions})`,
        field: `employees[${i}].deductions`,
      })
    }

    const netPay = emp.baseSalary + emp.allowances - emp.deductions
    if (netPay < 0) {
      messages.push({
        id: `pr-negative-netpay-${i}`,
        type: 'error',
        message: `صافي الراتب للموظف رقم ${i + 1} سالب (${netPay.toFixed(2)})، الاستقطاعات تتجاوز الراتب الأساسي مضافاً إليه البدلات`,
        field: `employees[${i}].deductions`,
      })
    }

    totalNetPay += netPay
  }

  if (totalNetPay > totalBudget) {
    messages.push({
      id: 'pr-exceeds-budget',
      type: 'error',
      message: `إجمالي الرواتب (${totalNetPay.toFixed(2)}) يتجاوز الميزانية المخصصة (${totalBudget.toFixed(2)})`,
      field: 'totalBudget',
    })
  }

  const seenIds = new Set<string>()
  for (let i = 0; i < employees.length; i++) {
    const empKey = `${employees[i].baseSalary}-${employees[i].allowances}-${employees[i].deductions}`
    if (seenIds.has(empKey)) {
      messages.push({
        id: `pr-duplicate-${i}`,
        type: 'error',
        message: `يوجد موظف مكرر في دورة الرواتب في الفهرس ${i}`,
        field: `employees[${i}]`,
      })
    }
    seenIds.add(empKey)
  }

  const now = Date.now()
  if (periodEndDate > now) {
    messages.push({
      id: 'pr-future-period',
      type: 'warning',
      message: 'تاريخ انتهاء الفترة في المستقبل، يرجى التأكد من صحة تاريخ الفترة',
      field: 'periodEndDate',
    })
  }

  return messages
}

export function validateTransfer(
  sourceAvailable: number,
  transferQty: number,
  destinationCapacity: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (sourceAvailable < 0) {
    messages.push({
      id: 'tr-source-negative',
      type: 'error',
      message: 'المخزون المتاح في المصدر سالب، لا يمكن إجراء التحويل',
      field: 'sourceAvailable',
    })
  }

  if (destinationCapacity < 0) {
    messages.push({
      id: 'tr-capacity-negative',
      type: 'error',
      message: 'سعة المستودع الوجهة سالبة، بيانات غير صالحة',
      field: 'destinationCapacity',
    })
  }

  if (transferQty <= 0) {
    messages.push({
      id: 'tr-invalid-qty',
      type: 'error',
      message: `كمية التحويل (${transferQty}) يجب أن تكون أكبر من صفر`,
      field: 'transferQty',
    })
    return messages
  }

  if (transferQty > sourceAvailable) {
    messages.push({
      id: 'tr-insufficient-source',
      type: 'error',
      message: `كمية التحويل (${transferQty}) تتجاوز المخزون المتوفر في المصدر (${sourceAvailable})`,
      field: 'transferQty',
    })
  }

  if (transferQty > destinationCapacity) {
    messages.push({
      id: 'tr-insufficient-capacity',
      type: 'error',
      message: `كمية التحويل (${transferQty}) تتجاوز السعة المتاحة في الوجهة (${destinationCapacity})`,
      field: 'transferQty',
    })
  }

  if (transferQty > 0 && transferQty <= sourceAvailable && transferQty <= destinationCapacity) {
    messages.push({
      id: 'tr-valid',
      type: 'success',
      message: 'عملية التحويل صالحة، الكمية متوفرة والسعة كافية',
      field: 'transferQty',
    })
  }

  return messages
}

export function validateApprovalAction(
  approverRole: string,
  requiredRole: string,
  amount: number,
  limit: number,
  requiresSecondApproval: boolean
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!approverRole || approverRole.trim().length === 0) {
    messages.push({
      id: 'app-no-approver-role',
      type: 'error',
      message: 'دور الموافق غير محدد',
      field: 'approverRole',
    })
  }

  if (!requiredRole || requiredRole.trim().length === 0) {
    messages.push({
      id: 'app-no-required-role',
      type: 'error',
      message: 'الدور المطلوب للموافقة غير محدد',
      field: 'requiredRole',
    })
  }

  if (amount < 0) {
    messages.push({
      id: 'app-negative-amount',
      type: 'error',
      message: 'المبلغ لا يمكن أن يكون سالباً',
      field: 'amount',
    })
  }

  if (limit < 0) {
    messages.push({
      id: 'app-negative-limit',
      type: 'error',
      message: 'حد الموافقة لا يمكن أن يكون سالباً',
      field: 'limit',
    })
  }

  if (approverRole && requiredRole) {
    const roleHierarchy: Record<string, number> = {
      'accountant': 1,
      'procurement_manager': 2,
      'sales_manager': 2,
      'inventory_manager': 2,
      'hr_manager': 3,
      'finance_manager': 4,
      'super_admin': 5,
    }

    const approverLevel = roleHierarchy[approverRole] || 0
    const requiredLevel = roleHierarchy[requiredRole] || 0

    if (approverLevel < requiredLevel) {
      messages.push({
        id: 'app-insufficient-authority',
        type: 'error',
        message: `الموافق بدور "${approverRole}" ليس لديه الصلاحية الكافية، الصلاحية المطلوبة "${requiredRole}"`,
        field: 'approverRole',
      })
    }
  }

  if (amount > limit) {
    messages.push({
      id: 'app-exceeds-limit',
      type: 'error',
      message: `المبلغ (${amount.toFixed(2)}) يتجاوز حد الموافقة المسموح به (${limit.toFixed(2)}) للموافق الحالي`,
      field: 'amount',
    })
  }

  const secondApprovalThreshold = 50000
  if (amount > secondApprovalThreshold && requiresSecondApproval) {
    messages.push({
      id: 'app-requires-second',
      type: 'warning',
      message: `المبلغ (${amount.toFixed(2)}) يتجاوز حد الموافقة الفردية (${secondApprovalThreshold.toFixed(2)})، يتطلب موافقة ثانية`,
      field: 'requiresSecondApproval',
    })
  }

  messages.push({
    id: 'app-self-approval-check',
    type: 'info',
    message: 'يرجى التأكد من أن الموافق ليس هو نفسه مقدم الطلب لتجنب الموافقة الذاتية',
    field: 'approverRole',
  })

  return messages
}
