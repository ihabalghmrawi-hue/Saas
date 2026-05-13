import type { ValidationMessage } from '@/lib/workbench/types'

export function validateJournalEntry(
  debits: { accountId: string; amount: number }[],
  credits: { accountId: string; amount: number }[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!debits || debits.length === 0) {
    messages.push({
      id: 'je-no-debits',
      type: 'error',
      message: 'يجب وجود بند مدين واحد على الأقل في القيد المحاسبي',
      field: 'debits',
    })
  }

  if (!credits || credits.length === 0) {
    messages.push({
      id: 'je-no-credits',
      type: 'error',
      message: 'يجب وجود بند دائن واحد على الأقل في القيد المحاسبي',
      field: 'credits',
    })
  }

  const totalLines = (debits?.length || 0) + (credits?.length || 0)
  if (totalLines > 100) {
    messages.push({
      id: 'je-max-lines',
      type: 'error',
      message: 'تجاوز الحد الأقصى لعدد بنود القيد المحاسبي (100 بند كحد أقصى)',
      field: 'lines',
    })
  }

  if (!debits || !credits) {
    return messages
  }

  for (let i = 0; i < debits.length; i++) {
    const d = debits[i]
    if (d.amount === 0) {
      messages.push({
        id: `je-zero-debit-${i}`,
        type: 'error',
        message: `مبلغ بند المدين في الفهرس ${i} يساوي صفر، يجب إدخال مبلغ صحيح`,
        field: `debits[${i}].amount`,
      })
    }
    if (d.amount < 0) {
      messages.push({
        id: `je-negative-debit-${i}`,
        type: 'error',
        message: `مبلغ بند المدين في الفهرس ${i} سالب (${d.amount})، المبلغ يجب أن يكون موجباً`,
        field: `debits[${i}].amount`,
      })
    }
    if (!d.accountId) {
      messages.push({
        id: `je-no-account-debit-${i}`,
        type: 'error',
        message: `بند المدين في الفهرس ${i} لا يحتوي على معرف حساب`,
        field: `debits[${i}].accountId`,
      })
    }
  }

  for (let i = 0; i < credits.length; i++) {
    const c = credits[i]
    if (c.amount === 0) {
      messages.push({
        id: `je-zero-credit-${i}`,
        type: 'error',
        message: `مبلغ بند الدائن في الفهرس ${i} يساوي صفر، يجب إدخال مبلغ صحيح`,
        field: `credits[${i}].amount`,
      })
    }
    if (c.amount < 0) {
      messages.push({
        id: `je-negative-credit-${i}`,
        type: 'error',
        message: `مبلغ بند الدائن في الفهرس ${i} سالب (${c.amount})، المبلغ يجب أن يكون موجباً`,
        field: `credits[${i}].amount`,
      })
    }
    if (!c.accountId) {
      messages.push({
        id: `je-no-account-credit-${i}`,
        type: 'error',
        message: `بند الدائن في الفهرس ${i} لا يحتوي على معرف حساب`,
        field: `credits[${i}].accountId`,
      })
    }
  }

  const totalDebits = debits.reduce((sum, d) => sum + d.amount, 0)
  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0)

  if (totalLines > 0 && totalDebits !== totalCredits) {
    messages.push({
      id: 'je-unbalanced',
      type: 'error',
      message: `القيد المحاسبي غير متوازن: إجمالي المدين (${totalDebits.toFixed(2)}) لا يساوي إجمالي الدائن (${totalCredits.toFixed(2)})`,
      field: 'amount',
    })
  }

  return messages
}

export function validateAccountBalance(
  accountId: string,
  debitChange: number,
  creditChange: number,
  currentBalance: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!accountId) {
    messages.push({
      id: 'bal-no-account',
      type: 'error',
      message: 'معرف الحساب مطلوب للتحقق من الرصيد',
      field: 'accountId',
    })
    return messages
  }

  if (debitChange < 0) {
    messages.push({
      id: 'bal-negative-debit',
      type: 'error',
      message: 'التغيير في المدين لا يمكن أن يكون سالباً',
      field: 'debitChange',
    })
  }

  if (creditChange < 0) {
    messages.push({
      id: 'bal-negative-credit',
      type: 'error',
      message: 'التغيير في الدائن لا يمكن أن يكون سالباً',
      field: 'creditChange',
    })
  }

  const resultingBalance = currentBalance + debitChange - creditChange

  if (resultingBalance < 0) {
    messages.push({
      id: 'bal-negative-result',
      type: 'error',
      message: `الرصيد الناتج سالب (${resultingBalance.toFixed(2)})، حسابات الأصول لا يمكن أن يكون لها رصيد سلبي`,
      field: 'balance',
    })
  }

  const creditLimit = Math.abs(currentBalance) * 2
  if (resultingBalance > creditLimit) {
    messages.push({
      id: 'bal-credit-limit',
      type: 'warning',
      message: `الرصيد الناتج (${resultingBalance.toFixed(2)}) يتجاوز حد الائتمان المسموح به (${creditLimit.toFixed(2)})`,
      field: 'balance',
    })
  }

  return messages
}

export function validateInvoiceMatch(
  poAmount: number,
  receiptAmount: number,
  invoiceAmount: number,
  tolerancePct: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (poAmount < 0) {
    messages.push({
      id: 'inv-po-negative',
      type: 'error',
      message: 'مبلغ أمر الشراء لا يمكن أن يكون سالباً',
      field: 'poAmount',
    })
  }

  if (receiptAmount < 0) {
    messages.push({
      id: 'inv-receipt-negative',
      type: 'error',
      message: 'مبلغ الإيصال لا يمكن أن يكون سالباً',
      field: 'receiptAmount',
    })
  }

  if (invoiceAmount < 0) {
    messages.push({
      id: 'inv-amount-negative',
      type: 'error',
      message: 'مبلغ الفاتورة لا يمكن أن يكون سالباً',
      field: 'invoiceAmount',
    })
  }

  if (tolerancePct < 0 || tolerancePct > 100) {
    messages.push({
      id: 'inv-tolerance-invalid',
      type: 'error',
      message: 'نسبة التسامح يجب أن تكون بين 0 و 100',
      field: 'tolerancePct',
    })
  }

  if (poAmount > 0) {
    const variancePct = Math.abs((invoiceAmount - poAmount) / poAmount) * 100
    if (variancePct > tolerancePct) {
      messages.push({
        id: 'inv-po-variance',
        type: 'warning',
        message: `الفاتورة (${invoiceAmount.toFixed(2)}) لا تتطابق مع أمر الشراء (${poAmount.toFixed(2)}) ضمن نسبة التسامح المسموح بها (${tolerancePct}%)، الفرق الفعلي ${variancePct.toFixed(2)}%`,
        field: 'invoiceAmount',
      })
    }
  }

  if (poAmount > 0 && receiptAmount > 0) {
    const receiptVariance = Math.abs(invoiceAmount - receiptAmount)
    if (receiptVariance > poAmount * (tolerancePct / 100)) {
      messages.push({
        id: 'inv-receipt-variance',
        type: 'warning',
        message: `كمية الفاتورة لا تتطابق مع كمية الإيصال، الفرق ${receiptVariance.toFixed(2)}`,
        field: 'receiptAmount',
      })
    }
  }

  if (poAmount > 0 && receiptAmount > 0 && invoiceAmount > 0) {
    const unitPricePO = poAmount
    const unitPriceInvoice = invoiceAmount
    const unitPriceVariance = Math.abs(unitPriceInvoice - unitPricePO) / unitPricePO * 100
    if (unitPriceVariance > tolerancePct) {
      messages.push({
        id: 'inv-price-variance',
        type: 'warning',
        message: `سعر الوحدة في الفاتورة يختلف عن أمر الشراء بنسبة ${unitPriceVariance.toFixed(2)}% وهي تتجاوز نسبة التسامح المسموح بها`,
        field: 'unitPrice',
      })
    }
  }

  if (poAmount === 0 && invoiceAmount === 0) {
    messages.push({
      id: 'inv-zero-amounts',
      type: 'info',
      message: 'كل من أمر الشراء والفاتورة بمبلغ صفر، يرجى التحقق من صحة البيانات',
      field: 'amount',
    })
  }

  return messages
}

export function validateReconciliation(
  statementBalance: number,
  bookBalance: number,
  difference: number,
  threshold: number
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (threshold < 0) {
    messages.push({
      id: 'rec-threshold-negative',
      type: 'error',
      message: 'قيمة الحد المسموح به لا يمكن أن تكون سالبة',
      field: 'threshold',
    })
    return messages
  }

  const absDifference = Math.abs(difference)

  if (absDifference === 0) {
    messages.push({
      id: 'rec-matched',
      type: 'success',
      message: 'تمت المطابقة بنجاح: رصيد كشف الحساب مطابق للرصيد الدفتري',
      field: 'difference',
    })
  } else if (absDifference <= threshold) {
    messages.push({
      id: 'rec-within-threshold',
      type: 'info',
      message: `الفرق (${difference.toFixed(2)}) ضمن الحد المسموح به (${threshold.toFixed(2)})، يوصى بالتحقق من العناصر غير المطابقة`,
      field: 'difference',
    })
  } else {
    messages.push({
      id: 'rec-exceeds-threshold',
      type: 'error',
      message: `الفرق (${difference.toFixed(2)}) يتجاوز الحد المسموح به (${threshold.toFixed(2)})، يجب التحقيق في الفرق وتحديد العناصر غير المطابقة`,
      field: 'difference',
    })
  }

  const expectedFromUnreconciled = Math.abs(statementBalance - bookBalance)
  if (absDifference > 0 && expectedFromUnreconciled > threshold) {
    messages.push({
      id: 'rec-unreconciled-items',
      type: 'warning',
      message: `الفرق (${difference.toFixed(2)}) قد يكون ناتجاً عن عناصر غير مطابقة، يرجى مراجعة كشف الحساب والرصيد الدفتري للعناصر المعلقة`,
      field: 'difference',
    })
  }

  return messages
}

export function validateFinancialClose(
  accounts: { id: string; balance: number; reconciled: boolean }[]
): ValidationMessage[] {
  const messages: ValidationMessage[] = []

  if (!accounts || accounts.length === 0) {
    messages.push({
      id: 'close-no-accounts',
      type: 'error',
      message: 'لا توجد حسابات لإغلاق الفترة المالية',
      field: 'accounts',
    })
    return messages
  }

  const unreconciled = accounts.filter(a => !a.reconciled)
  if (unreconciled.length > 0) {
    messages.push({
      id: 'close-unreconciled',
      type: 'error',
      message: `يوجد ${unreconciled.length} حساب/حسابات غير مطابقة يجب تسويتها قبل إغلاق الفترة: ${unreconciled.map(a => a.id).join('، ')}`,
      field: 'reconciled',
    })
  }

  const openBalances = accounts.filter(a => a.balance !== 0)
  if (openBalances.length > 0) {
    messages.push({
      id: 'close-open-balances',
      type: 'warning',
      message: `يوجد ${openBalances.length} حساب/حسابات بأرصدة مفتوحة غير مصفاة: ${openBalances.map(a => `${a.id} (${a.balance.toFixed(2)})`).join('، ')}`,
      field: 'balance',
    })
  }

  const reconciledCount = accounts.filter(a => a.reconciled).length
  if (reconciledCount === accounts.length) {
    messages.push({
      id: 'close-all-reconciled',
      type: 'success',
      message: 'جميع الحسابات مطابقة وجاهزة لإغلاق الفترة المالية',
      field: 'reconciled',
    })
  }

  messages.push({
    id: 'close-subsidiaries',
    type: 'info',
    message: 'يرجى التأكد من تأكيد جميع الشركات التابعة قبل إتمام عملية الإغلاق',
    field: 'subsidiaries',
  })

  messages.push({
    id: 'close-unposted-entries',
    type: 'info',
    message: 'يرجى التأكد من عدم وجود قيود محاسبية غير مرحلة قبل إغلاق الفترة',
    field: 'entries',
  })

  return messages
}
