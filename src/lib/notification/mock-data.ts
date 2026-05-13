import type { OperationalNotification, NotificationAction, NotificationGroup } from './types'

const sources = ['نظام المشتريات', 'نظام المبيعات', 'الموارد البشرية', 'المالية', 'المخزون'] as const

const entities: Record<string, Array<{ type: string; id: string; name: string }>> = {
  'نظام المشتريات': [
    { type: 'purchase-order', id: 'PO-0042', name: 'أمر شراء #PO-0042' },
    { type: 'purchase-order', id: 'PO-0081', name: 'أمر شراء #PO-0081' },
    { type: 'purchase-order', id: 'PO-0056', name: 'أمر شراء #PO-0056' },
    { type: 'contract', id: 'CT-0012', name: 'عقد صيانة #CT-0012' },
    { type: 'contract', id: 'CT-0023', name: 'عقد توريد #CT-0023' },
  ],
  'نظام المبيعات': [
    { type: 'invoice', id: 'INV-0234', name: 'فاتورة #INV-0234' },
    { type: 'invoice', id: 'INV-0198', name: 'فاتورة #INV-0198' },
    { type: 'order', id: 'ORD-0051', name: 'طلب #ORD-0051' },
    { type: 'quote', id: 'QTE-0017', name: 'عرض سعر #QTE-0017' },
  ],
  'الموارد البشرية': [
    { type: 'payroll', id: 'PR-2024-06', name: 'كشوف رواتب يونيو' },
    { type: 'leave', id: 'LV-0089', name: 'إجازة موظف #LV-0089' },
    { type: 'evaluation', id: 'EV-0045', name: 'تقييم أداء #EV-0045' },
    { type: 'request', id: 'HR-0123', name: 'طلب توظيف #HR-0123' },
  ],
  'المالية': [
    { type: 'payment', id: 'PY-0341', name: 'دفعة #PY-0341' },
    { type: 'budget', id: 'BG-2024-Q2', name: 'ميزانية الربع الثاني' },
    { type: 'report', id: 'RP-0056', name: 'تقرير مالي #RP-0056' },
    { type: 'reconciliation', id: 'RC-0012', name: 'تسوية بنكية #RC-0012' },
  ],
  'المخزون': [
    { type: 'inventory', id: 'MAT-0045', name: 'المواد الخام #MAT-0045' },
    { type: 'inventory', id: 'PROD-0089', name: 'المنتجات النهائية #PROD-0089' },
    { type: 'stock', id: 'STK-0023', name: 'مستودع #STK-0023' },
    { type: 'reorder', id: 'RO-0011', name: 'إعادة توريد #RO-0011' },
  ],
}

const approvalTemplates = [
  { title: 'طلب اعتماد أمر شراء #PO-0042', description: 'يتطلب اعتمادك على أمر الشراء بقيمة 45,000 ريال' },
  { title: 'طلب اعتماد فاتورة #INV-0234', description: 'يرجى اعتماد الفاتورة الصادرة بقيمة 12,800 ريال' },
  { title: 'طلب اعتماد عرض سعر #QTE-0017', description: 'عرض السعر المقدم من المورد أ.للمعدات بقيمة 78,500 ريال' },
  { title: 'طلب موافقة على صرف دفعة #PY-0341', description: 'الدفعة المستحقة للمقاول الرئيسي بقيمة 156,000 ريال' },
  { title: 'طلب اعتماد عقد توريد #CT-0023', description: 'عقد التوريد السنوي للمواد الخام بقيمة 340,000 ريال' },
  { title: 'طلب اعتماد تقييم أداء #EV-0045', description: 'تقييم أداء الموظف أحمد الحربي للربع الثاني' },
  { title: 'طلب موافقة على ميزانية القسم', description: 'ميزانية قسم تقنية المعلومات للعام القادم بقيمة 520,000 ريال' },
  { title: 'طلب اعتماد طلب توظيف #HR-0123', description: 'طلب توظيف مهندس برمجيات بمرتب 15,000 ريال' },
  { title: 'طلب موافقة على تدريب الموظفين', description: 'برنامج تدريبي للموظفين بتكلفة 45,000 ريال' },
  { title: 'طلب اعتماد صرف بدل سفر', description: 'بدل سفر للموظف محمد العلي للمؤتمر في دبي بقيمة 8,500 ريال' },
]

const escalationTemplates = [
  { title: 'تصعيد طلب موافقة - تجاوز SLA', description: 'تم تصعيد طلب الموافقة بعد تجاوز المدة المحددة للموافقة على أمر الشراء #PO-0042' },
  { title: 'تصعيد - طلب اعتماد عقد', description: 'تم تجاوز المهلة الزمنية لاعتماد عقد الصيانة - يرجى التدخل' },
  { title: 'تصعيد عاجل - موافقة ميزانية', description: 'لم يتم البت في طلب الموافقة على ميزانية القسم لمدة 5 أيام عمل' },
  { title: 'تصعيد طلب توظيف', description: 'تجاوز طلب التوظيف المهلة المحددة للموافقة من الإدارة العليا' },
  { title: 'تصعيد - صرف دفعة مقاول', description: 'تأخر صرف الدفعة المستحقة للمقاول لمدة 3 أيام عن التاريخ المتفق عليه' },
]

const reminderTemplates = [
  { title: 'تذكير: إغلاق الفترة المالية', description: 'متبقي 3 أيام على إغلاق الفترة المالية للربع الثاني' },
  { title: 'تذكير: تسليم تقرير الأداء', description: 'يرجى تسليم تقرير أداء القسم قبل نهاية الأسبوع' },
  { title: 'تذكير: تجديد عقد الصيانة', description: 'ينتهي عقد الصيانة بعد 7 أيام - يرجى اتخاذ اللازم' },
  { title: 'تذكير: مراجعة المخزون الدورية', description: 'موعد الجرد الدوري للمخزون يوم الخميس القادم' },
  { title: 'تذكير: إتمام التقييمات السنوية', description: 'متبقي 10 أيام على إغلاق فترة التقييمات السنوية للموظفين' },
  { title: 'تذكير: تسليم فواتير الشهر', description: 'يرجى تسليم فواتير الشهر الحالي قبل اليوم الخامس من الشهر القادم' },
]

const alertTemplates = [
  { title: 'تنبيه: تجاوز حد المخزون', description: 'وصل مخزون المواد الخام إلى الحد الأدنى - يرجى إعادة التوريد' },
  { title: 'تنبيه: تجاوز الميزانية', description: 'تجاوزت نفقات قسم المشتريات الميزانية المقررة بنسبة 15%' },
  { title: 'تنبيه: تأخر دفع فاتورة', description: 'الفاتورة #INV-0234 متأخرة عن السداد لمدة 10 أيام' },
  { title: 'تنبيه: مخالفة صلاحية', description: 'محاولة دخول غير مصرح بها لنظام الرواتب من حساب غير موثوق' },
  { title: 'تنبيه: انتهاء ترخيص', description: 'رخصة البرنامج المحاسبي ستنتهي بعد 14 يوماً' },
]

const systemTemplates = [
  { title: 'اكتملت معالجة كشوف الرواتب', description: 'تمت معالجة كشوف رواتب شهر يونيو بنجاح وجاهزة للاعتماد' },
  { title: 'تحديث النظام الإصدار 3.2', description: 'تم تحديث النظام المحاسبي إلى الإصدار 3.2 بنجاح' },
  { title: 'نسخ احتياطي', description: 'تم إنشاء نسخة احتياطية كاملة للبيانات بنجاح' },
  { title: 'مزامنة البيانات', description: 'تمت مزامنة البيانات بين الفروع بنجاح' },
  { title: 'تقرير يومي', description: 'تم إنشاء التقرير اليومي للمعاملات المالية' },
]

const workflowTemplates = [
  { title: 'تم تحديث حالة سير العمل', description: 'تم الانتقال إلى المرحلة التالية في دورة المشتريات - مرحلة الموافقة على الدفع' },
  { title: 'سير عمل جديد', description: 'تم بدء سير عمل جديد لطلب شراء المواد المكتبية' },
  { title: 'إعادة توجيه سير عمل', description: 'تم إعادة توجيه سير عمل الموافقة على العقد إلى المدير المالي' },
  { title: 'سير عمل مكتمل', description: 'اكتمل سير عمل الموافقة على صرف المكافآت السنوية' },
  { title: 'تعليق سير عمل', description: 'تم تعليق سير عمل طلب التوظيف لحين استكمال المستندات المطلوبة' },
]

const actionSet: Record<string, NotificationAction[]> = {
  approval: [
    { id: 'approve', label: 'اعتماد', type: 'primary' },
    { id: 'reject', label: 'رفض', type: 'danger' },
    { id: 'view', label: 'عرض التفاصيل', type: 'secondary' },
  ],
  escalation: [
    { id: 'acknowledge', label: 'استلام', type: 'primary' },
    { id: 'escalate', label: 'تصعيد', type: 'danger' },
    { id: 'reassign', label: 'إعادة توجيه', type: 'secondary' },
  ],
  reminder: [
    { id: 'view-task', label: 'عرض المهمة', type: 'primary' },
    { id: 'snooze', label: 'تذكير لاحقاً', type: 'secondary' },
    { id: 'dismiss', label: 'تجاهل', type: 'secondary' },
  ],
  alert: [
    { id: 'acknowledge', label: 'تأكيد', type: 'primary' },
    { id: 'view', label: 'عرض التفاصيل', type: 'secondary' },
    { id: 'dismiss', label: 'تجاهل', type: 'secondary' },
  ],
  system: [
    { id: 'view', label: 'عرض التفاصيل', type: 'primary' },
    { id: 'dismiss', label: 'تجاهل', type: 'secondary' },
  ],
  workflow: [
    { id: 'view', label: 'عرض التفاصيل', type: 'primary' },
    { id: 'confirm', label: 'تأكيد', type: 'secondary' },
    { id: 'reassign', label: 'إعادة توجيه', type: 'secondary' },
  ],
}

const categories: Array<{ cat: OperationalNotification['category']; weight: number }> = [
  { cat: 'approval', weight: 35 },
  { cat: 'escalation', weight: 15 },
  { cat: 'reminder', weight: 20 },
  { cat: 'alert', weight: 15 },
  { cat: 'system', weight: 10 },
  { cat: 'workflow', weight: 5 },
]

const priorities: Array<{ pri: OperationalNotification['priority']; weight: number }> = [
  { pri: 'critical', weight: 10 },
  { pri: 'high', weight: 25 },
  { pri: 'medium', weight: 40 },
  { pri: 'low', weight: 25 },
]

const statuses: Array<{ st: OperationalNotification['status']; weight: number }> = [
  { st: 'unread', weight: 40 },
  { st: 'read', weight: 50 },
  { st: 'archived', weight: 10 },
]

const groupKeys = [
  { key: 'po-approvals', title: 'موافقات أوامر الشراء' },
  { key: 'payroll', title: 'الرواتب' },
  { key: 'close-process', title: 'إغلاق الفترة' },
  { key: 'contract-renewal', title: 'تجديد العقود' },
  { key: 'budget', title: 'الميزانية' },
  { key: 'evaluation', title: 'التقييمات' },
  { key: 'inventory', title: 'المخزون' },
  { key: 'invoices', title: 'الفواتير' },
]

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[0]
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickActions(category: OperationalNotification['category'], count?: number): NotificationAction[] {
  const available = actionSet[category]
  const n = count ?? randomInt(1, Math.min(3, available.length))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export function generateMockNotifications(count: number = 30): OperationalNotification[] {
  const now = Date.now()
  const sevenDaysMs = 7 * 86400000
  const notifications: OperationalNotification[] = []

  for (let i = 0; i < count; i++) {
    const categoryPick = weightedPick(categories)
    const category = categoryPick.cat
    const priorityPick = weightedPick(priorities)
    const statusPick = weightedPick(statuses)
    const source = pickRandom(sources)
    const relatedEntities = entities[source]
    const relatedEntity = pickRandom(relatedEntities)
    const timestamp = now - randomInt(0, sevenDaysMs)

    let title = ''
    let description = ''
    let slaMinutes: number | undefined
    let expiryDate: number | undefined
    let escalationCount: number | undefined
    const groupKey = pickRandom(groupKeys)

    switch (category) {
      case 'approval': {
        const t = pickRandom(approvalTemplates)
        title = t.title
        description = t.description
        break
      }
      case 'escalation': {
        const t = pickRandom(escalationTemplates)
        title = t.title
        description = t.description
        escalationCount = randomInt(1, 3)
        slaMinutes = randomInt(30, 240)
        break
      }
      case 'reminder': {
        const t = pickRandom(reminderTemplates)
        title = t.title
        description = t.description
        slaMinutes = randomInt(60, 1440)
        expiryDate = now + randomInt(86400000, 7 * 86400000)
        break
      }
      case 'alert': {
        const t = pickRandom(alertTemplates)
        title = t.title
        description = t.description
        break
      }
      case 'system': {
        const t = pickRandom(systemTemplates)
        title = t.title
        description = t.description
        break
      }
      case 'workflow': {
        const t = pickRandom(workflowTemplates)
        title = t.title
        description = t.description
        break
      }
    }

    const actions = pickActions(category)

    notifications.push({
      id: `notif-${i.toString().padStart(4, '0')}`,
      title,
      description,
      category,
      priority: priorityPick.pri,
      status: statusPick.st,
      timestamp,
      source,
      relatedEntity,
      actions,
      slaMinutes,
      expiryDate,
      escalationCount,
      groupKey: groupKey.key,
    })
  }

  return notifications.sort((a, b) => b.timestamp - a.timestamp)
}

export function generateMockNotificationGroups(): NotificationGroup[] {
  const all = generateMockNotifications(30)
  const groupMap = new Map<string, OperationalNotification[]>()

  for (const n of all) {
    if (n.groupKey) {
      const existing = groupMap.get(n.groupKey) ?? []
      existing.push(n)
      groupMap.set(n.groupKey, existing)
    }
  }

  const entries = Array.from(groupMap.entries()).slice(0, randomInt(5, 8))

  return entries.map(([key, notifications]) => ({
    key,
    title: pickRandom(groupKeys.filter(g => g.key === key)).title,
    notifications,
    unread: notifications.filter(n => n.status === 'unread').length,
    expanded: false,
  }))
}
