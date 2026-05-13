import type {
  AccountSummary, TransactionEntry, Invoice, InvoiceLine,
  InventoryItem, PurchaseOrder, PurchaseOrderLine, SalesOrder, SalesOrderLine,
  PayrollRun, PayrollEmployee,
  ValidationMessage, AIInsight, AuditTrailEntry,
  DocumentAttachment, OperationalComment,
} from './types'

const accountNames = [
  'صندوق النقدية', 'البنك الأهلي', 'حساب جاري الراجحي', 'ذمم مدينة - عملاء',
  'مخزون البضاعة', 'أصول ثابتة', 'مباني', 'سيارات',
  'ذمم دائنة - موردين', 'رأس المال', 'إيرادات المبيعات',
  'مصروفات الرواتب', 'مصروفات الإيجار', 'مصروفات الكهرباء', 'ضريبة القيمة المضافة',
]

const accountTypes = [
  'asset', 'asset', 'asset', 'asset', 'asset', 'asset', 'asset', 'asset',
  'liability', 'equity', 'revenue', 'expense', 'expense', 'expense', 'liability',
]

const journalDescriptions = [
  'قيد مقبوضات نقدية', 'تسوية بنكية', 'دفع إيجار', 'صرف رواتب',
  'مبيعات نقدية', 'مشتريات آجلة', 'رد مبيعات', 'مصروفات صيانة',
  'إيرادات استثمار', 'شراء أصول ثابتة', 'تسوية مخزون', 'مصروفات نقل',
  'مصروفات إدارية', 'مقبوضات بنكية', 'مسحوبات شخصية',
]

const vendorCustomerNames = [
  'شركة الراجحي للتجارة', 'مؤسسة السلام للتوريدات', 'شركة الجزيرة للمقاولات',
  'مجموعة الخليج التجارية', 'شركة الواحة للصناعة', 'مؤسسة النور للتجهيزات',
  'شركة الفهد للخدمات', 'الشركة السعودية للتوريدات',
]

const supplierNames = [
  'مؤسسة البناء الحديث', 'شركة التوريدات الصناعية', 'مصنع الرياض للحديد',
  'شركة الخليج للخدمات', 'مجموعة الفهد التجارية', 'مؤسسة الجزيرة للتجارة',
  'شركة الواحة للإمدادات', 'الشركة السعودية للطاقة', 'مصنع الشرق للبلاستيك',
  'شركة البحر الأحمر للتجهيزات',
]

const customerNames = [
  'شركة الأمل للتجارة', 'مؤسسة النور للمقاولات', 'شركة الفيصلية للاستثمار',
  'مجموعة السلام التجارية', 'شركة الوادي الأخضر', 'مؤسسة البحرين للتجارة',
  'شركة الجزيرة للسياحة', 'مصنع الرياض للأغذية', 'شركة القصيم الزراعية',
  'مؤسسة الحرمين للخدمات',
]

const itemNames = [
  'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
  'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
  'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
  'مفاتيح كهربائية', 'محولات طاقة', 'مراوح تهوية', 'أجهزة قياس',
  'دهانات صناعية', 'مواد تنظيف', 'قفازات واقية', 'أحذية سلامة',
  'خوذ أمان', 'نظارات واقية', 'معدات لحام', 'أدوات يدوية', 'معدات قياس',
]

const warehouses = [
  'المستودع الرئيسي', 'مستودع المواد الخام', 'مستودع المواد الكيميائية',
  'مستودع التعبئة', 'مستودع الصيانة',
]

const categories = [
  'مواد خام', 'تعبئة وتغليف', 'قطع غيار', 'كيميائيات',
  'كهربائيات', 'معدات سلامة', 'أدوات قياس', 'معدات صناعية',
]

const employeeNames = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري',
]

const departmentNames = [
  'المالية', 'المشتريات', 'المبيعات', 'الموارد البشرية',
  'تكنولوجيا المعلومات', 'المستودعات', 'الصيانة', 'التسويق',
]

const poDescriptions = [
  'توريد مواد خام للإنتاج', 'شراء مستلزمات تعبئة وتغليف',
  'توريد قطع غيار للصيانة', 'شراء مواد كيميائية للتنظيف',
  'توريد معدات سلامة للموظفين', 'شراء أجهزة قياس للمختبر',
  'توريد أدوات كهربائية', 'شراء معدات يدوية للورشة',
]

const saleItemDescriptions = [
  'منتج نهائي أ', 'منتج نهائي ب', 'كرتون تغليف', 'مواد تعبئة',
  'زيوت تشحيم معبأة', 'مذيبات مخففة', 'فلاتر هواء', 'أحزمة ناقلة',
  'صمامات تحكم', 'وصلات مواسير', 'كوابل طاقة', 'مفاتيح كهربائية',
  'محولات صغيرة', 'مراوح شفط', 'أجهزة قياس حرارة', 'دهانات معبأة',
  'منظفات صناعية', 'قفازات عمل', 'أحذية سلامة', 'خوذ أمان',
  'نظارات صناعية', 'أسلاك لحام', 'مفكات وأدوات', 'متر قياس',
]

const validationMessagesData = [
  { type: 'error' as const, message: 'رصيد الحساب غير كافي للترحيل' },
  { type: 'error' as const, message: 'المبلغ المدين لا يساوي المبلغ الدائن' },
  { type: 'error' as const, message: 'رقم الحساب غير صحيح' },
  { type: 'warning' as const, message: 'الفاتورة متأخرة عن الاستحقاق' },
  { type: 'warning' as const, message: 'المخزون غير كافي لتلبية الطلب' },
  { type: 'error' as const, message: 'الموظف ليس لديه راتب أساسي محدد' },
  { type: 'info' as const, message: 'حقل الوصف مطلوب' },
  { type: 'warning' as const, message: 'تاريخ الفاتورة في المستقبل' },
  { type: 'success' as const, message: 'تم التحقق من جميع الحقول بنجاح' },
  { type: 'info' as const, message: 'سيتم تطبيق ضريبة القيمة المضافة بنسبة 15%' },
]

const aiInsightsData = [
  {
    type: 'anomaly' as const,
    title: 'معاملات غير معتادة',
    description: 'تم اكتشاف 3 معاملات غير معتادة في حساب الموردين هذا الشهر',
    confidence: 92,
  },
  {
    type: 'recommendation' as const,
    title: 'إعادة تقييم حد الائتمان',
    description: 'يوصى بإعادة تقييم حد الائتمان للعميل بناءً على تاريخ الدفع',
    confidence: 85,
  },
  {
    type: 'insight' as const,
    title: 'تباين في المخزون',
    description: 'هناك تباين بنسبة 15% بين السجل والمخزون الفعلي',
    confidence: 78,
  },
  {
    type: 'summary' as const,
    title: 'تحسن وقت الموافقة',
    description: 'متوسط وقت الموافقة أسرع بنسبة 20% من الشهر الماضي',
    confidence: 95,
  },
  {
    type: 'optimization' as const,
    title: 'عمليات مكررة',
    description: 'تم تحديد 5 عمليات مكررة محتملة في حسابات العملاء',
    confidence: 88,
  },
]

const auditActions = [
  { action: 'إنشاء قيد محاسبي', type: 'create' as const },
  { action: 'تحديث بيانات العميل', type: 'update' as const },
  { action: 'اعتماد فاتورة', type: 'approve' as const },
  { action: 'رفض طلب شراء', type: 'reject' as const },
  { action: 'ترحيل قيود اليومية', type: 'post' as const },
  { action: 'تدقيق المخزون', type: 'validate' as const },
  { action: 'تسجيل دخول', type: 'system' as const },
  { action: 'تعديل صلاحيات', type: 'system' as const },
]

const commentTexts = [
  'يرجى مراجعة المبالغ قبل الاعتماد',
  'تم التأكد من صحة المستندات المرفقة',
  'هناك اختلاف في الكميات الموجهة',
  'تمت الموافقة على الطلب بعد التدقيق',
  'يرجى إرفاق الفاتورة الأصلية للصرف',
  'جاري المتابعة مع المورد لتسليم البضاعة',
  'تم إجراء التسوية البنكية للشهر الحالي',
  'يرجى تحديث بيانات الموظف في النظام',
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): number {
  const now = Date.now()
  const past = now - daysAgo * 24 * 60 * 60 * 1000
  return randomInt(past, now)
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

export function generateMockAccounts(): AccountSummary[] {
  return accountNames.map((name, idx) => {
    const balance = idx < 4 ? randomFloat(50000, 500000) : idx < 8 ? randomFloat(100000, 2000000) : randomFloat(-200000, 800000)
    const debitTotal = balance > 0 ? balance + randomFloat(10000, 100000) : randomFloat(10000, 50000)
    const creditTotal = balance < 0 ? Math.abs(balance) + randomFloat(10000, 100000) : randomFloat(10000, 50000)
    return {
      id: generateId('acc'),
      code: `${idx + 1}`.padStart(4, '0'),
      name,
      type: accountTypes[idx],
      balance,
      debitTotal,
      creditTotal,
      transactionCount: randomInt(5, 150),
      lastActivity: randomDate(30),
      status: randomChoice(['active', 'active', 'active', 'inactive', 'frozen'] as const),
    }
  })
}

export function generateMockJournalEntries(count: number): TransactionEntry[] {
  const accounts = generateMockAccounts()
  return Array.from({ length: count }, () => {
    const debitAccount = randomChoice(accounts)
    let creditAccount = randomChoice(accounts.filter((a) => a.id !== debitAccount.id))
    if (!creditAccount) creditAccount = debitAccount
    const amount = randomFloat(100, 50000)
    const date = randomDate(90)
    const isPosted = Math.random() > 0.2
    return {
      id: generateId('je'),
      date,
      reference: `JE-${randomInt(1000, 9999)}`,
      description: randomChoice(journalDescriptions),
      accountId: debitAccount.id,
      accountName: debitAccount.name,
      debit: amount,
      credit: 0,
      amount,
      currency: 'SAR',
      status: isPosted ? 'posted' : randomChoice(['draft', 'pending', 'rejected'] as const),
      createdBy: randomChoice(employeeNames),
      createdAt: date,
      approvedBy: isPosted ? randomChoice(employeeNames) : undefined,
      approvedAt: isPosted ? date + randomInt(1000, 86400000) : undefined,
      type: randomChoice(['cash', 'bank', 'sales', 'purchase', 'expense']),
      category: randomChoice(['عمليات', 'استثمار', 'تمويل', 'مصروفات']),
      validationMessages: Math.random() > 0.7 ? generateMockValidationMessages('journal') : [],
      attachments: Math.random() > 0.8 ? generateMockDocuments() : [],
      comments: Math.random() > 0.7 ? generateMockOperationalComments() : [],
    }
  })
}

export function generateMockInvoices(count: number, type: 'payable' | 'receivable'): Invoice[] {
  const names = type === 'payable' ? supplierNames : customerNames
  return Array.from({ length: count }, (_, idx) => {
    const amount = randomFloat(1000, 200000)
    const paidAmount = Math.random() > 0.3 ? randomFloat(0, amount) : 0
    const date = randomDate(60)
    const dueDate = date + randomInt(15, 60) * 24 * 60 * 60 * 1000
    const isOverdue = dueDate < Date.now() && paidAmount < amount
    const isPaid = paidAmount >= amount
    let status: Invoice['status']
    if (isPaid) status = 'paid'
    else if (isOverdue) status = 'overdue'
    else status = randomChoice(['draft', 'pending', 'approved', 'cancelled'] as const)

    const numLines = randomInt(1, 5)
    const lines: InvoiceLine[] = Array.from({ length: numLines }, (_, li) => {
      const qty = randomInt(1, 100)
      const price = randomFloat(10, 5000)
      const lineAmount = parseFloat((qty * price).toFixed(2))
      const tax = parseFloat((lineAmount * 0.15).toFixed(2))
      return {
        id: generateId('il'),
        description: `بند ${li + 1} - ${randomChoice(saleItemDescriptions)}`,
        quantity: qty,
        unitPrice: price,
        amount: lineAmount,
        tax,
        total: parseFloat((lineAmount + tax).toFixed(2)),
        accountCode: `${randomInt(1000, 9999)}`,
      }
    })

    return {
      id: generateId('inv'),
      number: `${type === 'payable' ? 'PO' : 'INV'}-${String(idx + 1).padStart(4, '0')}`,
      type,
      vendorOrCustomer: randomChoice(names),
      date,
      dueDate,
      amount,
      paidAmount,
      balance: parseFloat((amount - paidAmount).toFixed(2)),
      currency: 'SAR',
      status,
      lines,
      validationMessages: Math.random() > 0.6 ? generateMockValidationMessages('invoice') : [],
    }
  })
}

export function generateMockReconciliationItems(): any[] {
  return Array.from({ length: 10 }, (_, idx) => {
    const account = randomChoice(accountNames)
    const diff = randomFloat(-5000, 5000)
    return {
      id: generateId('rec'),
      account,
      systemBalance: randomFloat(10000, 500000),
      statementBalance: randomFloat(10000, 500000),
      difference: parseFloat(diff.toFixed(2)),
      date: randomDate(30),
      status: Math.abs(diff) < 100 ? 'مطابقة' : 'غير مطابقة',
      notes: Math.abs(diff) < 100 ? 'مطابقة تلقائية' : 'يوجد فرق قيد المراجعة',
      items: Array.from({ length: randomInt(1, 5) }, () => ({
        date: randomDate(30),
        description: randomChoice(journalDescriptions),
        reference: `REF-${randomInt(1000, 9999)}`,
        debit: randomFloat(0, 10000),
        credit: randomFloat(0, 10000),
      })),
    }
  })
}

export function generateMockInventoryItems(count: number): InventoryItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const onHand = randomInt(0, 500)
    const reserved = randomInt(0, Math.floor(onHand * 0.4))
    const onOrder = randomInt(0, 100)
    const unitCost = randomFloat(5, 500)
    const reorderPoint = randomInt(10, 50)
    let status: InventoryItem['status']
    if (onHand === 0) status = 'out_of_stock'
    else if (onHand <= reorderPoint) status = 'low_stock'
    else if (onHand > reorderPoint * 5) status = 'overstock'
    else status = 'in_stock'

    return {
      id: generateId('inv'),
      sku: `SKU-${String(idx + 1).padStart(4, '0')}`,
      name: itemNames[idx % itemNames.length],
      category: categories[idx % categories.length],
      warehouse: randomChoice(warehouses),
      bin: `BIN-${String(randomInt(1, 50)).padStart(3, '0')}`,
      onHand,
      reserved,
      available: onHand - reserved,
      onOrder,
      unitCost,
      totalValue: parseFloat((onHand * unitCost).toFixed(2)),
      reorderPoint,
      status,
      lastCounted: randomDate(60),
      validationMessages: status === 'out_of_stock' ? generateMockValidationMessages('inventory').slice(0, 1) : [],
    }
  })
}

export function generateMockStockMovements(count: number): any[] {
  return Array.from({ length: count }, () => ({
    id: generateId('sm'),
    date: randomDate(60),
    item: randomChoice(itemNames),
    type: randomChoice(['استلام', 'صرف', 'تسوية', 'إرجاع', 'تلف']),
    quantity: randomInt(-100, 100),
    reference: `MOV-${randomInt(1000, 9999)}`,
    warehouse: randomChoice(warehouses),
    notes: randomChoice(['إنتاج', 'مبيعات', 'مشتريات', 'تسوية جرد', 'تالف']),
    initiatedBy: randomChoice(employeeNames),
  }))
}

export function generateMockWarehouseTransfers(count: number): any[] {
  return Array.from({ length: count }, () => ({
    id: generateId('wt'),
    date: randomDate(30),
    item: randomChoice(itemNames),
    quantity: randomInt(10, 200),
    fromWarehouse: randomChoice(warehouses),
    toWarehouse: randomChoice(warehouses),
    status: randomChoice(['قيد التنفيذ', 'مكتمل', 'ملغي']),
    requestedBy: randomChoice(employeeNames),
    approvedBy: Math.random() > 0.5 ? randomChoice(employeeNames) : undefined,
    notes: randomChoice(['نقل للإنتاج', 'نقل للتخزين', 'إعادة توزيع']),
  }))
}

export function generateMockPurchaseOrders(count: number): PurchaseOrder[] {
  return Array.from({ length: count }, (_, idx) => {
    const numItems = randomInt(1, 6)
    const items: PurchaseOrderLine[] = Array.from({ length: numItems }, (_, li) => {
      const qty = randomInt(10, 500)
      const received = Math.random() > 0.5 ? randomInt(0, qty) : 0
      const price = randomFloat(5, 200)
      return {
        id: generateId('pol'),
        item: randomChoice(itemNames),
        description: randomChoice(saleItemDescriptions),
        quantity: qty,
        received,
        unitPrice: price,
        amount: parseFloat((qty * price).toFixed(2)),
      }
    })
    const totalAmount = parseFloat(items.reduce((sum, i) => sum + i.amount, 0).toFixed(2))
    const isReceived = items.every((i) => i.received >= i.quantity)
    const isCancelled = Math.random() > 0.9
    let status: PurchaseOrder['status']
    if (isCancelled) status = 'cancelled'
    else if (isReceived) status = 'closed'
    else if (Math.random() > 0.5) status = randomChoice(['draft', 'pending', 'approved'] as const)
    else status = 'received'

    return {
      id: generateId('po'),
      number: `PO-${String(idx + 1).padStart(4, '0')}`,
      supplier: randomChoice(supplierNames),
      date: randomDate(45),
      expectedDate: randomDate(-15),
      amount: totalAmount,
      status,
      items,
      validationMessages: Math.random() > 0.7 ? generateMockValidationMessages('procurement') : [],
    }
  })
}

export function generateMockSuppliers(): any[] {
  return supplierNames.map((name) => ({
    id: generateId('sup'),
    name,
    code: `SUP-${randomInt(100, 999)}`,
    contactPerson: randomChoice(employeeNames),
    phone: `05${randomInt(10000000, 99999999)}`,
    email: `info@${name.replace(/\s/g, '')}.com`,
    balance: randomFloat(-50000, 200000),
    paymentTerms: randomChoice(['نقداً', '30 يوم', '60 يوم', '90 يوم']),
    status: randomChoice(['نشط', 'نشط', 'نشط', 'متوقف']),
    category: randomChoice(['مواد خام', 'خدمات', 'معدات', 'صيانة']),
    totalOrders: randomInt(5, 100),
    totalAmount: randomFloat(100000, 5000000),
    lastOrderDate: randomDate(30),
  }))
}

export function generateMockSalesOrders(count: number): SalesOrder[] {
  return Array.from({ length: count }, (_, idx) => {
    const numItems = randomInt(1, 8)
    const items: SalesOrderLine[] = Array.from({ length: numItems }, (_, li) => {
      const qty = randomInt(5, 200)
      const shipped = Math.random() > 0.5 ? randomInt(0, qty) : 0
      const price = randomFloat(10, 500)
      return {
        id: generateId('sol'),
        item: randomChoice(saleItemDescriptions),
        description: randomChoice(saleItemDescriptions),
        quantity: qty,
        shipped,
        unitPrice: price,
        amount: parseFloat((qty * price).toFixed(2)),
      }
    })
    const totalAmount = parseFloat(items.reduce((sum, i) => sum + i.amount, 0).toFixed(2))
    const isShipped = items.every((i) => i.shipped >= i.quantity)
    const isCancelled = Math.random() > 0.9
    let status: SalesOrder['status']
    if (isCancelled) status = 'cancelled'
    else if (isShipped) status = randomChoice(['invoiced', 'closed'] as const)
    else status = randomChoice(['draft', 'pending', 'approved', 'shipped'] as const)

    return {
      id: generateId('so'),
      number: `SO-${String(idx + 1).padStart(4, '0')}`,
      customer: randomChoice(customerNames),
      date: randomDate(45),
      expectedDate: randomDate(-10),
      amount: totalAmount,
      status,
      items,
      validationMessages: Math.random() > 0.7 ? generateMockValidationMessages('sales') : [],
    }
  })
}

export function generateMockCustomers(): any[] {
  return customerNames.map((name) => ({
    id: generateId('cust'),
    name,
    code: `CUST-${randomInt(100, 999)}`,
    contactPerson: randomChoice(employeeNames),
    phone: `05${randomInt(10000000, 99999999)}`,
    email: `info@${name.replace(/\s/g, '')}.com`,
    balance: randomFloat(0, 300000),
    creditLimit: randomFloat(100000, 1000000),
    paymentTerms: randomChoice(['نقداً', '30 يوم', '60 يوم']),
    status: randomChoice(['نشط', 'نشط', 'نشط', 'متوقف']),
    category: randomChoice(['شركة', 'مؤسسة', 'فرد']),
    totalOrders: randomInt(5, 80),
    totalAmount: randomFloat(100000, 3000000),
    lastOrderDate: randomDate(30),
    aging: {
      current: randomFloat(0, 50000),
      '1-30': randomFloat(0, 30000),
      '31-60': randomFloat(0, 20000),
      '61-90': randomFloat(0, 10000),
      '90+': randomFloat(0, 5000),
    },
  }))
}

export function generateMockPayrollRuns(count: number): PayrollRun[] {
  const now = new Date()
  return Array.from({ length: count }, (_, idx) => {
    const month = now.getMonth() - idx
    const year = now.getFullYear() + (month < 0 ? -1 : 0)
    const m = ((month % 12) + 12) % 12
    const startDate = new Date(year, m, 1).getTime()
    const endDate = new Date(year, m + 1, 0).getTime()
    const payDate = endDate + randomInt(1, 5) * 24 * 60 * 60 * 1000
    const empCount = 20 - idx
    const totalAmount = empCount * randomFloat(3000, 8000)
    const anomalies = randomInt(0, 3)

    return {
      id: generateId('pr'),
      period: `${arabicMonths[m]} ${year}`,
      employeeCount: empCount,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: idx === 0 ? randomChoice(['draft', 'processing', 'validated'] as const) : 'paid',
      startDate,
      endDate,
      payDate,
      validationMessages: anomalies > 0 ? generateMockValidationMessages('payroll').slice(0, anomalies) : [],
      anomalies,
    }
  })
}

export function generateMockPayrollEmployees(count: number): PayrollEmployee[] {
  return Array.from({ length: count }, (_, idx) => {
    const basic = randomFloat(3000, 15000)
    const allowances = randomFloat(500, 3000)
    const deductions = randomFloat(0, 1000)
    const netPay = parseFloat((basic + allowances - deductions).toFixed(2))
    const hasAnomaly = Math.random() > 0.85

    return {
      id: generateId('pe'),
      employeeId: `EMP-${String(idx + 1).padStart(3, '0')}`,
      name: randomChoice(employeeNames),
      department: randomChoice(departmentNames),
      basicSalary: parseFloat(basic.toFixed(2)),
      allowances: parseFloat(allowances.toFixed(2)),
      deductions: parseFloat(deductions.toFixed(2)),
      netPay,
      bankAccount: `SA${randomInt(1000000000, 9999999999)}`,
      status: hasAnomaly ? 'anomaly' : randomChoice(['pending', 'valid'] as const),
      validationMessages: hasAnomaly ? generateMockValidationMessages('payroll').slice(0, 1) : [],
    }
  })
}

export function generateMockValidationMessages(type?: string): ValidationMessage[] {
  const pool = type ? validationMessagesData : validationMessagesData
  const count = randomInt(1, 4)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((v) => ({
    id: generateId('msg'),
    ...v,
    field: randomChoice(['المبلغ', 'التاريخ', 'الحساب', 'الوصف', 'الكمية']),
    action: v.type === 'error'
      ? { label: 'تصحيح', handler: () => {} }
      : v.type === 'warning'
        ? { label: 'مراجعة', handler: () => {} }
        : undefined,
  }))
}

export function generateMockAIInsights(domain?: string): AIInsight[] {
  return aiInsightsData.map((insight) => ({
    id: generateId('ai'),
    ...insight,
    actionable: Math.random() > 0.3,
    action: Math.random() > 0.5
      ? {
          label: randomChoice(['تطبيق', 'مشاهدة التفاصيل', 'تصدير التقرير']),
          handler: () => {},
        }
      : undefined,
  }))
}

export function generateMockAuditTrail(): AuditTrailEntry[] {
  return Array.from({ length: 20 }, (_, idx) => {
    const entry = randomChoice(auditActions)
    return {
      id: generateId('audit'),
      ...entry,
      actor: randomChoice(employeeNames),
      timestamp: randomDate(60),
      details: randomChoice([
        'تم تنفيذ العملية بنجاح',
        'تمت العملية مع تحذيرات',
        'فشلت العملية بسبب خطأ في البيانات',
        'تمت العملية بعد المراجعة والتدقيق',
      ]),
    }
  })
}

export function generateMockInspectorData(entityType: string): Record<string, unknown> {
  switch (entityType) {
    case 'customer':
      return {
        name: randomChoice(customerNames),
        code: `CUST-${randomInt(100, 999)}`,
        balance: randomFloat(0, 300000),
        creditLimit: randomFloat(100000, 1000000),
        totalOrders: randomInt(5, 80),
        lastOrder: new Date(randomDate(30)).toLocaleDateString('ar-SA'),
        aging: {
          current: randomFloat(0, 50000),
          '1-30': randomFloat(0, 30000),
          '31-60': randomFloat(0, 20000),
          '61-90': randomFloat(0, 10000),
          '90+': randomFloat(0, 5000),
        },
      }
    case 'supplier':
      return {
        name: randomChoice(supplierNames),
        code: `SUP-${randomInt(100, 999)}`,
        balance: randomFloat(-50000, 200000),
        paymentTerms: randomChoice(['نقداً', '30 يوم', '60 يوم']),
        totalOrders: randomInt(5, 100),
        lastPurchase: new Date(randomDate(30)).toLocaleDateString('ar-SA'),
      }
    case 'inventory':
      return {
        name: randomChoice(itemNames),
        warehouse: randomChoice(warehouses),
        onHand: randomInt(0, 500),
        reserved: randomInt(0, 100),
        available: randomInt(0, 400),
        reorderPoint: randomInt(10, 50),
        unitCost: randomFloat(5, 500),
        totalValue: randomFloat(1000, 50000),
        movements: Array.from({ length: 5 }, () => ({
          date: new Date(randomDate(30)).toLocaleDateString('ar-SA'),
          type: randomChoice(['استلام', 'صرف', 'تسوية']),
          quantity: randomInt(-50, 50),
        })),
      }
    case 'journal':
      return {
        reference: `JE-${randomInt(1000, 9999)}`,
        date: new Date(randomDate(30)).toLocaleDateString('ar-SA'),
        description: randomChoice(journalDescriptions),
        totalDebit: randomFloat(1000, 50000),
        totalCredit: randomFloat(1000, 50000),
        accountsAffected: randomInt(2, 6),
        status: randomChoice(['مسجل', 'مرحل', 'معلق']),
      }
    case 'payroll':
      return {
        period: `شهر ${randomChoice(['يناير', 'فبراير', 'مارس', 'أبريل'])}`,
        employeeCount: randomInt(15, 25),
        totalAmount: randomFloat(50000, 150000),
        anomalies: randomInt(0, 3),
        status: randomChoice(['مسودة', 'قيد المعالجة', 'معتمد', 'مدفوع']),
        bankTransferDate: new Date(randomDate(10)).toLocaleDateString('ar-SA'),
      }
    case 'approval':
      return {
        requestType: randomChoice(['فاتورة', 'أمر شراء', 'أمر صرف', 'إجازة']),
        requestedBy: randomChoice(employeeNames),
        amount: randomFloat(1000, 100000),
        submittedAt: new Date(randomDate(10)).toLocaleDateString('ar-SA'),
        slaRemaining: randomChoice(['ساعتان', 'يوم واحد', 'متبقي 3 أيام']),
        currentApprover: randomChoice(employeeNames),
        requiredApprovers: randomInt(1, 3),
        history: Array.from({ length: 3 }, () => ({
          action: randomChoice(['اعتماد', 'رفض', 'إعادة توجيه']),
          by: randomChoice(employeeNames),
          at: new Date(randomDate(5)).toLocaleDateString('ar-SA'),
          comment: randomChoice(commentTexts),
        })),
      }
    case 'workflow':
      return {
        name: randomChoice(['سير عمل الموافقات', 'سير عمل المشتريات', 'سير عمل الصرف']),
        currentStage: randomInt(1, 5),
        totalStages: 5,
        status: randomChoice(['قيد التنفيذ', 'مكتمل', 'معلق']),
        initiatedBy: randomChoice(employeeNames),
        startedAt: new Date(randomDate(20)).toLocaleDateString('ar-SA'),
        stages: Array.from({ length: 5 }, (_, i) => ({
          name: `المرحلة ${i + 1}`,
          status: i < 3 ? 'مكتملة' : i === 3 ? 'قيد التنفيذ' : 'قادمة',
          assignee: randomChoice(employeeNames),
          completedAt: i < 3 ? new Date(randomDate(10)).toLocaleDateString('ar-SA') : undefined,
        })),
      }
    default:
      return { name: 'غير معروف', type: entityType }
  }
}

export function generateMockDocuments(): DocumentAttachment[] {
  return Array.from({ length: randomInt(1, 4) }, () => ({
    id: generateId('doc'),
    name: randomChoice([
      'فاتورة المورد.pdf',
      'أمر الشراء.pdf',
      'إيصال الدفع.pdf',
      'عقد الخدمة.pdf',
      'تقرير التدقيق.pdf',
      'صورة شيك.jpg',
      'مرفق العقد.docx',
    ]),
    type: randomChoice(['pdf', 'image', 'docx', 'xlsx']),
    size: randomInt(10000, 5000000),
    uploadedBy: randomChoice(employeeNames),
    uploadedAt: randomDate(30),
    url: '#',
  }))
}

export function generateMockOperationalComments(): OperationalComment[] {
  const count = randomInt(2, 5)
  return Array.from({ length: count }, (_, idx) => ({
    id: generateId('comment'),
    text: commentTexts[idx % commentTexts.length],
    author: randomChoice(employeeNames),
    timestamp: randomDate(10) - idx * 3600000,
    attachments: Math.random() > 0.6 ? generateMockDocuments().slice(0, 1) : undefined,
    resolved: Math.random() > 0.6 ? false : undefined,
  }))
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
