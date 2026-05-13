import type { TimelineEntry, ApprovalHistoryEntry, ActivityCorrelation, ActivityStream } from './types'

const arabicNames = [
  { id: 'actor-1', name: 'أحمد محمد' },
  { id: 'actor-2', name: 'سارة خالد' },
  { id: 'actor-3', name: 'محمد علي' },
  { id: 'actor-4', name: 'نورة أحمد' },
  { id: 'actor-5', name: 'فهد العتيبي' },
  { id: 'actor-6', name: 'لينا حسن' },
]

const entityTypes = ['process', 'financial', 'inventory', 'hr', 'workflow'] as const

const categories = [
  'procure_to_pay', 'order_to_cash', 'inventory', 'payroll',
  'financial_close', 'reconciliation', 'system',
] as const

const sources = ['نظام', 'مستخدم', 'تلقائي']

const actionPairs: { type: TimelineEntry['type']; action: string; details: string; entityType: string; entityName: string }[] = [
  { type: 'entity', action: 'تم إنشاء أمر شراء جديد', details: 'تم إنشاء أمر شراء للمورد الرئيسي بقيمة ١٢٥٬٠٠٠ ريال', entityType: 'process', entityName: 'أمر شراء - ١٠٢٣٤' },
  { type: 'entity', action: 'تم تحديث حالة المخزون', details: 'تحديث أرصدة المخزون للصنف أ-٢٠٥ بعد استلام الشحنة', entityType: 'inventory', entityName: 'مخزون - مواد خام' },
  { type: 'entity', action: 'تم إضافة مورد جديد', details: 'إضافة المورد "شركة التقنية المتقدمة" إلى نظام المشتريات', entityType: 'process', entityName: 'الموردون' },
  { type: 'entity', action: 'تم تعديل أمر البيع', details: 'تعديل كمية الصنف ب-٣٠١ في أمر البيع ٢٠٢٤٠٠١', entityType: 'financial', entityName: 'فاتورة مبيعات - ٢٠٢٤٠٠١' },
  { type: 'entity', action: 'تم حذف مستند', details: 'حذف مسودة مستند استلام رقم مس-٢٠٢٤', entityType: 'workflow', entityName: 'مستند استلام' },
  { type: 'workflow', action: 'تم تقديم طلب اعتماد', details: 'تقديم طلب اعتماد أمر الشراء ١٠٢٣٤ للموافقة', entityType: 'workflow', entityName: 'طلب اعتماد - ١٠٢٣٤' },
  { type: 'workflow', action: 'تم اعتماد الطلب', details: 'اعتماد أمر الشراء ١٠٢٣٤ من قبل مدير المشتريات', entityType: 'workflow', entityName: 'أمر شراء - ١٠٢٣٤' },
  { type: 'workflow', action: 'تم رفض الطلب', details: 'رفض طلب زيادة الحد الائتماني لعدم كفاية المستندات', entityType: 'workflow', entityName: 'طلب زيادة حد ائتماني' },
  { type: 'workflow', action: 'تم إعادة توجيه الموافقة', details: 'إعادة توجيه طلب الموافقة إلى المدير المالي', entityType: 'workflow', entityName: 'طلب موافقة - م ١٢٣' },
  { type: 'workflow', action: 'تم تجاوز SLA', details: 'تجاوز وقت معالجة طلب الاعتماد (SLA: ٤ ساعات)', entityType: 'workflow', entityName: 'تنبيه SLA' },
  { type: 'audit', action: 'تم تصدير تقرير الحسابات', details: 'تصدير تقرير الحسابات المدققة للربع الثالث ٢٠٢٤', entityType: 'financial', entityName: 'تقرير حسابات مدققة' },
  { type: 'audit', action: 'تم تدقيق قيد اليومية', details: 'تدقيق قيد اليومية رقم ق-٢٠٢٤/١٢٣ بقيمة ٥٠٠٬٠٠٠ ريال', entityType: 'financial', entityName: 'قيد يومية - ١٢٣' },
  { type: 'audit', action: 'تم مراجعة ميزان المراجعة', details: 'مراجعة ميزان المراجعة لشهر سبتمبر ٢٠٢٤', entityType: 'financial', entityName: 'ميزان مراجعة - سبتمبر' },
  { type: 'audit', action: 'تم التحقق من المستندات', details: 'التحقق من مستندات صرف المطالبة رقم م-٤٥١', entityType: 'workflow', entityName: 'مستندات - م-٤٥١' },
  { type: 'approval', action: 'تمت الموافقة على أمر الشراء', details: 'الموافقة على أمر الشراء ١٠٢٣٤ بقيمة ١٢٥٬٠٠٠ ريال', entityType: 'process', entityName: 'أمر شراء - ١٠٢٣٤' },
  { type: 'approval', action: 'تم رفض فاتورة المبيعات', details: 'رفض فاتورة المبيعات ٢٠٢٤٠٠١ بسبب اختلاف في الأسعار', entityType: 'financial', entityName: 'فاتورة مبيعات - ٢٠٢٤٠٠١' },
  { type: 'approval', action: 'تم اعتماد كشف الراتب', details: 'اعتماد كشف الرواتب لشهر أكتوبر ٢٠٢٤', entityType: 'hr', entityName: 'كشف راتب - أكتوبر' },
  { type: 'approval', action: 'تم تفويض الموافقة', details: 'تفويض صلاحية الموافقة على أوامر الصرف إلى نائب المدير المالي', entityType: 'workflow', entityName: 'تفويض - صلاحيات' },
  { type: 'operation', action: 'تم بدء معالجة الرواتب', details: 'بدء معالجة كشوف رواتب الموظفين لشهر أكتوبر', entityType: 'hr', entityName: 'معالجة رواتب' },
  { type: 'operation', action: 'تم إقفال الفترة المالية', details: 'إقفال الفترة المالية للربع الثالث ٢٠٢٤', entityType: 'financial', entityName: 'إقفال مالي - ر٣' },
  { type: 'operation', action: 'تم تشغيل تقرير نهاية الشهر', details: 'تشغيل تقرير نهاية الشهر لإجمالي المبيعات والمصروفات', entityType: 'financial', entityName: 'تقرير نهاية شهر' },
  { type: 'operation', action: 'تم تحديث بيانات العميل', details: 'تحديث بيانات العميل "شركة السلام" رقم حساب ج-٤٥١٢', entityType: 'process', entityName: 'بيانات عميل - شركة السلام' },
  { type: 'system', action: 'تمت مزامنة البيانات', details: 'مزامنة بيانات العملاء والفواتير مع نظام ERP', entityType: 'system', entityName: 'مزامنة نظام' },
  { type: 'system', action: 'تم إنشاء نسخة احتياطية', details: 'إنشاء نسخة احتياطية لقاعدة البيانات (حجم: ٢٫٥ جيجابايت)', entityType: 'system', entityName: 'نسخ احتياطي' },
  { type: 'system', action: 'تم تحديث النظام', details: 'تحديث نظام المحاسبة إلى الإصدار ٤٫٢', entityType: 'system', entityName: 'تحديث نظام' },
  { type: 'system', action: 'اكتملت معالجة الخلفية', details: 'اكتمال معالجة الخلفية لمطابقة البنوك', entityType: 'system', entityName: 'معالجة خلفية' },
  { type: 'entity', action: 'تم إصدار فاتورة مبيعات', details: 'إصدار فاتورة مبيعات للعميل "مؤسسة النبراس" بقيمة ٣٤٬٥٠٠ ريال', entityType: 'financial', entityName: 'فاتورة مبيعات - ٢٠٢٤٠١٢' },
  { type: 'entity', action: 'تم تسجيل قيد اليومية', details: 'تسجيل قيد اليومية لتسوية البنك الأهلي', entityType: 'financial', entityName: 'قيد يومية - تسوية' },
  { type: 'workflow', action: 'تم بدء إجراءات الموافقة', details: 'بدء إجراءات الموافقة على صرف مبلغ ٧٥٬٠٠٠ ريال', entityType: 'workflow', entityName: 'إجراءات صرف' },
  { type: 'audit', action: 'تم أرشفة المستندات', details: 'أرشفة مستندات الفترة السابقة في مستودع المستندات', entityType: 'process', entityName: 'أرشفة مستندات' },
  { type: 'approval', action: 'تمت الموافقة على التسوية البنكية', details: 'الموافقة على تسوية البنك الأهلي لشهر سبتمبر', entityType: 'financial', entityName: 'تسوية بنكية - سبتمبر' },
  { type: 'operation', action: 'تم تسوية الحسابات البنكية', details: 'تسوية الحسابات البنكية مع كشوف البنوك', entityType: 'financial', entityName: 'تسوية حسابات' },
]

const workflowNames = [
  'أمر شراء - ١٠٢٣٤',
  'فاتورة مبيعات - ٢٠٢٤٠٠١',
  'كشف راتب - أكتوبر',
  'قيد يومية - ١٢٣',
  'تسوية بنكية - سبتمبر',
  'أمر توريد - ٤٥١',
]

const stepNamesByWorkflow: Record<string, string[]> = {
  'أمر شراء - ١٠٢٣٤': ['مراجعة الطلب', 'اعتماد المشتريات', 'اعتماد مالي', 'الصرف'],
  'فاتورة مبيعات - ٢٠٢٤٠٠١': ['مراجعة الفاتورة', 'اعتماد الفاتورة', 'إصدار الفاتورة'],
  'كشف راتب - أكتوبر': ['مراجعة الكشف', 'اعتماد الموارد البشرية', 'اعتماد مالي', 'صرف الرواتب'],
  'قيد يومية - ١٢٣': ['مراجعة القيد', 'اعتماد القيد', 'الترحيل'],
  'تسوية بنكية - سبتمبر': ['مطابقة البيانات', 'مراجعة التسوية', 'اعتماد التسوية'],
  'أمر توريد - ٤٥١': ['إنشاء أمر التوريد', 'مراجعة', 'اعتماد', 'استلام'],
}

const approvalTitles = [
  'اعتماد أمر شراء مواد خام',
  'اعتماد فاتورة مبيعات عميل رئيسي',
  'اعتماد كشف رواتب الموظفين',
  'اعتماد قيد يومية تسوية بنكية',
  'اعتماد تسوية بنكية شهرية',
  'اعتماد أمر توريد مستلزمات إنتاج',
]

const arabicComments: Record<string, string[]> = {
  approved: [
    'تمت الموافقة بعد المراجعة',
    'موافق عليه وفقاً للسياسات المالية',
    'تم التحقق من المستندات والموافقة',
    'موافق مع ملاحظة متابعة التنفيذ',
  ],
  rejected: [
    'تم الرفض لعدم اكتمال المستندات',
    'غير مطابق للمواصفات المطلوبة',
    'يرجى إعادة تقديم الطلب بعد التصحيح',
    'تم الرفض بسبب تجاوز الميزانية',
  ],
  delegated: [
    'تم التفويض إلى نائب المدير المالي',
    'تفويض للمدير التنفيذي للاعتماد',
  ],
  escalated: [
    'تصعيد الطلب إلى الإدارة العليا',
    'تصعيد بسبب تجاوز المدة المقررة',
  ],
}

const correlationKeys = [
  'دورة المشتريات', 'سلسلة الموافقات', 'سلسلة المدفوعات', 'دورة الإقفال',
]

function pickRandom<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

export function generateMockTimelineEntries(count: number): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const now = Date.now()
  const fourteenDays = 14 * 24 * 60 * 60 * 1000

  for (let i = 0; i < count; i++) {
    const pair = pickRandom(actionPairs)
    const actor = pickRandom(arabicNames)
    const timestamp = now - Math.floor(Math.random() * fourteenDays)
    const severityWeights = Math.random()
    const severity = severityWeights < 0.6 ? 'info' : severityWeights < 0.85 ? 'warning' : severityWeights < 0.95 ? 'error' : 'success'

    const entry: TimelineEntry = {
      id: randomId('tl'),
      type: pair.type,
      action: pair.action,
      entityType: pair.entityType,
      entityId: `ent-${Math.random().toString(36).substring(2, 8)}`,
      entityName: pair.entityName,
      actor: { ...actor },
      timestamp,
      details: pair.details,
      severity,
      category: pickRandom(categories),
      source: pickRandom(sources),
    }

    if (Math.random() < 0.3) {
      entry.metadata = {
        ipAddress: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
        browser: 'Chrome',
        sessionId: `sess-${randomId('')}`,
      }
    }

    if (Math.random() < 0.15) {
      const relCount = randomInt(1, 3)
      entry.relatedEntities = Array.from({ length: relCount }, () => ({
        type: pickRandom(entityTypes),
        id: `rel-${Math.random().toString(36).substring(2, 8)}`,
        name: `مستند ذو صلة - ${Math.random().toString(36).substring(2, 6)}`,
      }))
    }

    entries.push(entry)
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp)
}

export function generateMockApprovalHistory(count: number): ApprovalHistoryEntry[] {
  const entries: ApprovalHistoryEntry[] = []
  const now = Date.now()
  const fourteenDays = 14 * 24 * 60 * 60 * 1000

  const decisionWeights = [0, 0, 0, 0, 0]
  const decisions: ApprovalHistoryEntry['decision'][] = ['approved', 'rejected', 'pending', 'delegated', 'escalated']
  const weights = [0.5, 0.2, 0.15, 0.1, 0.05]

  for (let i = 0; i < count; i++) {
    const workflowName = pickRandom(workflowNames)
    const steps = stepNamesByWorkflow[workflowName] || ['مراجعة', 'اعتماد']
    const stepName = pickRandom(steps)
    const title = pickRandom(approvalTitles)
    const requester = pickRandom(arabicNames)
    const decisionRandom = Math.random()
    let cumulative = 0
    let decision: ApprovalHistoryEntry['decision'] = 'pending'
    for (let d = 0; d < decisions.length; d++) {
      cumulative += weights[d]
      if (decisionRandom <= cumulative) {
        decision = decisions[d]
        break
      }
    }

    const createdAt = now - Math.floor(Math.random() * fourteenDays)
    const slaMinutes = pickRandom([30, 60, 120, 240, 480])

    const entry: ApprovalHistoryEntry = {
      id: randomId('ah'),
      approvalId: `app-${Math.random().toString(36).substring(2, 8)}`,
      workflowInstanceId: `wi-${Math.random().toString(36).substring(2, 8)}`,
      workflowName,
      stepName,
      title,
      decision,
      requestedBy: { ...requester },
      createdAt,
      slaMinutes,
      priority: pickRandom(['critical', 'high', 'medium', 'low'] as const),
      escalationCount: decision === 'escalated' ? randomInt(1, 3) : 0,
    }

    if (decision !== 'pending') {
      const responder = pickRandom(arabicNames.filter(n => n.id !== requester.id))
      entry.decidedBy = { ...responder }
      entry.respondedAt = createdAt + randomInt(60 * 1000, 24 * 60 * 60 * 1000)
    }

    if (decision === 'approved' || decision === 'rejected' || decision === 'delegated' || decision === 'escalated') {
      const commentPool = arabicComments[decision] || arabicComments.approved
      entry.comments = pickRandom(commentPool)
    }

    entries.push(entry)
  }

  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

export function generateMockCorrelations(count: number): ActivityCorrelation[] {
  const correlations: ActivityCorrelation[] = []

  for (let i = 0; i < count; i++) {
    const chainLength = randomInt(3, 6)
    const entries = generateMockTimelineEntries(chainLength)
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
    const startTime = sorted[0].timestamp
    const endTime = sorted[sorted.length - 1].timestamp

    const correlation: ActivityCorrelation = {
      id: randomId('corr'),
      correlationKey: pickRandom(correlationKeys),
      entries: sorted,
      startTime,
      endTime,
      duration: endTime - startTime,
      type: pickRandom(['procurement_chain', 'approval_chain', 'payment_chain', 'close_chain']),
      status: pickRandom(['in_progress', 'completed', 'failed'] as const),
    }

    correlations.push(correlation)
  }

  return correlations
}

export function generateMockStreams(): ActivityStream[] {
  const streamConfigs = [
    { name: 'طلبات الاعتماد', unreadWeight: 0.3 },
    { name: 'المعاملات المالية', unreadWeight: 0.2 },
    { name: 'عمليات المخزون', unreadWeight: 0.15 },
    { name: 'الرواتب', unreadWeight: 0.1 },
    { name: 'إشعارات النظام', unreadWeight: 0.25 },
    { name: 'تدقيق الحسابات', unreadWeight: 0.1 },
  ]

  return streamConfigs.map((config) => {
    const entryCount = randomInt(3, 8)
    const entries = generateMockTimelineEntries(entryCount)
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)

    return {
      id: randomId('stream'),
      name: config.name,
      entries: sorted,
      unread: Math.floor(entryCount * config.unreadWeight) + 1,
      lastActivity: sorted[0]?.timestamp || Date.now(),
    }
  })
}
