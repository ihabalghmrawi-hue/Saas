import type {
  AutomationRule, TriggerOption, EscalationLevel, SimulationScenario,
  Condition, ConditionGroup, RuleAction,
} from './types'

export function getTriggerOptions(): TriggerOption[] {
  return [
    { event: 'workflow.created', label: 'إنشاء سير عمل', description: 'عند إنشاء سير عمل جديد', icon: 'FileText', category: 'workflow' },
    { event: 'workflow.stage_changed', label: 'تغيير مرحلة سير العمل', description: 'عند الانتقال بين مراحل سير العمل', icon: 'ArrowRight', category: 'workflow' },
    { event: 'approval.pending', label: 'موافقة معلقة', description: 'عند طلب موافقة جديدة', icon: 'Clock', category: 'approval' },
    { event: 'approval.decided', label: 'تم البت في الموافقة', description: 'عند الموافقة أو الرفض', icon: 'CheckCircle2', category: 'approval' },
    { event: 'approval.escalated', label: 'تصعيد موافقة', description: 'عند تصعيد موافقة', icon: 'AlertTriangle', category: 'approval' },
    { event: 'sla.warning', label: 'تحذير SLA', description: 'عند اقتراب تجاوز SLA', icon: 'Clock', category: 'sla' },
    { event: 'sla.breached', label: 'تجاوز SLA', description: 'عند تجاوز المهلة الزمنية', icon: 'AlertCircle', category: 'sla' },
    { event: 'entity.created', label: 'إنشاء كيان', description: 'عند إنشاء مستند أو سجل جديد', icon: 'Plus', category: 'entity' },
    { event: 'entity.updated', label: 'تحديث كيان', description: 'عند تحديث مستند أو سجل', icon: 'Edit3', category: 'entity' },
    { event: 'schedule.cron', label: 'جدولة زمنية (Cron)', description: 'تشغيل وفق جدول زمني محدد', icon: 'Calendar', category: 'schedule' },
  ]
}

export function generateMockRules(): AutomationRule[] {
  const now = Date.now()
  return [
    {
      id: 'rule-1', name: 'اعتماد تلقائي للمشتريات الصغيرة', description: 'اعتماد أوامر الشراء التي تقل قيمتها عن 5,000 ريال تلقائياً',
      trigger: 'approval.pending', triggerConfig: { type: 'purchase_order' },
      conditions: [
        {
          id: 'cg-1', logic: 'and', label: 'شروط الاعتماد التلقائي',
          conditions: [
            { id: 'cond-1', field: 'amount', operator: 'less_than', value: '5000', label: 'قيمة أقل من 5,000 ريال' },
            { id: 'cond-2', field: 'category', operator: 'equals', value: 'operational', label: 'تصنيف تشغيلي' },
          ],
        },
      ],
      actions: [
        { id: 'act-1', type: 'approve_auto', config: {}, label: 'اعتماد تلقائي', enabled: true },
        { id: 'act-2', type: 'send_notification', config: { to: 'requester', message: 'تم اعتماد طلبك تلقائياً' }, label: 'إشعار مقدم الطلب', enabled: true },
      ],
      enabled: true, priority: 1, category: 'المشتريات', createdAt: now - 86400000 * 30, updatedAt: now - 86400000 * 2, executionCount: 47,
    },
    {
      id: 'rule-2', name: 'تصعيد الموافقات المتأخرة', description: 'تصعيد الموافقات التي تتجاوز 4 ساعات إلى مدير الإدارة',
      trigger: 'sla.warning', triggerConfig: { threshold: '80' },
      conditions: [
        {
          id: 'cg-2', logic: 'and', label: 'شروط التصعيد',
          conditions: [
            { id: 'cond-3', field: 'sla_elapsed', operator: 'greater_than', value: '80', label: 'استهلك أكثر من 80% من SLA' },
            { id: 'cond-4', field: 'priority', operator: 'in', value: 'high,critical', label: 'أولوية عالية أو حرجة' },
          ],
        },
      ],
      actions: [
        { id: 'act-3', type: 'escalate', config: { level: 'manager' }, label: 'تصعيد إلى مدير الإدارة', enabled: true },
        { id: 'act-4', type: 'send_notification', config: { to: 'approval_manager' }, label: 'إشعار المدير', enabled: true },
      ],
      enabled: true, priority: 2, category: 'الموافقات', createdAt: now - 86400000 * 25, updatedAt: now - 86400000 * 5, executionCount: 128,
    },
    {
      id: 'rule-3', name: 'إشعار تجاوز المخزون', description: 'إرسال تنبيه عند وصول المخزون إلى الحد الأدنى',
      trigger: 'entity.updated', triggerConfig: { entity: 'inventory_item' },
      conditions: [
        {
          id: 'cg-3', logic: 'and', label: 'شروط المخزون',
          conditions: [
            { id: 'cond-5', field: 'current_stock', operator: 'less_than', value: 'reorder_point', label: 'المخزون أقل من نقطة إعادة الطلب' },
          ],
        },
      ],
      actions: [
        { id: 'act-5', type: 'send_notification', config: { to: 'procurement_team' }, label: 'إشعار فريق المشتريات', enabled: true },
        { id: 'act-6', type: 'transition', config: { to_stage: 'reorder_point' }, label: 'تنشيط نقطة إعادة الطلب', enabled: true },
      ],
      enabled: true, priority: 3, category: 'المخزون', createdAt: now - 86400000 * 20, updatedAt: now - 86400000 * 10, executionCount: 89,
    },
    {
      id: 'rule-4', name: 'إقفال تلقائي لنهاية الشهر', description: 'تشغيل إجراءات إقفال نهاية الشهر تلقائياً في تاريخ محدد',
      trigger: 'schedule.cron', triggerConfig: { cron: '0 0 1 * *', timezone: 'Asia/Riyadh' },
      conditions: [
        {
          id: 'cg-4', logic: 'and', label: 'شروط الإقفال',
          conditions: [
            { id: 'cond-6', field: 'month_end', operator: 'equals', value: 'true', label: 'نهاية الشهر المالي' },
          ],
        },
      ],
      actions: [
        { id: 'act-7', type: 'transition', config: { to_stage: 'close_preparation' }, label: 'بدء تحضير الإقفال', enabled: true },
        { id: 'act-8', type: 'send_notification', config: { to: 'finance_team' }, label: 'إشعار الفريق المالي', enabled: true },
      ],
      enabled: true, priority: 4, category: 'المالية', createdAt: now - 86400000 * 15, updatedAt: now - 86400000 * 3, executionCount: 5,
    },
    {
      id: 'rule-5', name: 'رفض طلبات الشراء غير المكتملة', description: 'رفض أوامر الشراء التي تنقصها مستندات أساسية',
      trigger: 'workflow.created', triggerConfig: { workflow: 'procure_to_pay' },
      conditions: [
        {
          id: 'cg-5', logic: 'or', label: 'شروط النقص',
          conditions: [
            { id: 'cond-7', field: 'has_quotation', operator: 'equals', value: 'false', label: 'لا يوجد عرض سعر' },
            { id: 'cond-8', field: 'has_budget_approval', operator: 'equals', value: 'false', label: 'لا يوجد موافقة ميزانية' },
          ],
        },
      ],
      actions: [
        { id: 'act-9', type: 'reject_auto', config: { reason: 'مستندات ناقصة' }, label: 'رفض تلقائي', enabled: true },
        { id: 'act-10', type: 'send_notification', config: { to: 'requester' }, label: 'إشعار مقدم الطلب', enabled: true },
      ],
      enabled: false, priority: 5, category: 'المشتريات', createdAt: now - 86400000 * 10, updatedAt: now - 86400000 * 1, executionCount: 12,
    },
    {
      id: 'rule-6', name: 'إعادة توجيه الموافقات في الإجازات', description: 'إعادة توجيه الموافقات تلقائياً عند غياب الموظف',
      trigger: 'approval.pending', triggerConfig: { type: 'any' },
      conditions: [
        {
          id: 'cg-6', logic: 'and', label: 'شروط الغياب',
          conditions: [
            { id: 'cond-9', field: 'assignee_status', operator: 'equals', value: 'on_leave', label: 'المسؤول في إجازة' },
          ],
        },
      ],
      actions: [
        { id: 'act-11', type: 'assign', config: { to: 'delegate' }, label: 'تعيين بديل', enabled: true },
        { id: 'act-12', type: 'send_notification', config: { to: 'delegate' }, label: 'إشعار البديل', enabled: true },
      ],
      enabled: true, priority: 6, category: 'الموافقات', createdAt: now - 86400000 * 5, updatedAt: now - 86400000 * 1, executionCount: 34,
    },
  ]
}

export function getDefaultEscalationLevels(): EscalationLevel[] {
  return [
    { level: 1, afterMinutes: 120, action: 'notify', target: 'المشرف المباشر', notifyChannels: ['in_app'] },
    { level: 2, afterMinutes: 360, action: 'reassign', target: 'مدير الإدارة', notifyChannels: ['in_app', 'email'] },
    { level: 3, afterMinutes: 720, action: 'escalate_to_director', target: 'الإدارة العليا', notifyChannels: ['in_app', 'email'] },
  ]
}

export function generateMockSimulationScenarios(): SimulationScenario[] {
  const rules = generateMockRules()
  return rules.slice(0, 3).map((rule, i) => ({
    id: `sim-${i}`,
    name: `محاكاة: ${rule.name}`,
    description: `محاكاة تنفيذ القاعدة "${rule.name}"`,
    rule,
    result: {
      triggered: i !== 2,
      conditionsMet: i !== 1,
      executionPath: [
        `✓ تم اكتشاف الحدث: ${rule.trigger}`,
        ...(i !== 1 ? ['✓ تم استيفاء جميع الشروط'] : ['✗ لم تستوفِ الشروط: مبلغ الطلب يتجاوز الحد المسموح']),
        ...(i !== 1 && i !== 2 ? ['✓ تم تنفيذ الإجراء: اعتماد تلقائي', '✓ تم إرسال إشعار'] : []),
        ...(i === 2 ? ['✗ لم يتم تفعيل القاعدة (معطلة)'] : []),
      ],
      duration: i === 0 ? 245 : i === 1 ? 0 : 0,
      actionsExecuted: i === 0 ? ['اعتماد تلقائي', 'إشعار مقدم الطلب'] : [],
    },
  }))
}
