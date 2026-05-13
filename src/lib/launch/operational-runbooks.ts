export interface RunbookStep {
  order: number
  action: string
  description: string
  expectedOutcome: string
  troubleshooting: string[]
}

export interface Runbook {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  affectedModules: string[]
  steps: RunbookStep[]
  estimatedResolution: string
  lastUpdated: number
}

export function getRunbooks(): Runbook[] {
  return [
    {
      id: 'RB-001',
      title: 'تعطل قاعدة البيانات',
      description: 'إجراءات استعادة قاعدة البيانات بعد انقطاع الخدمة',
      severity: 'critical',
      affectedModules: ['قاعدة البيانات', 'جميع الوحدات'],
      steps: [
        {
          order: 1,
          action: 'فحص حالة قاعدة البيانات',
          description: 'التحقق من اتصال Supabase واستعلام حالة الخدمة',
          expectedOutcome: 'تأكيد حالة قاعدة البيانات (متصل/منقطع)',
          troubleshooting: ['استخدام Dashboard Supabase للتحقق', 'تجربة الاتصال من أداة خارجية'],
        },
        {
          order: 2,
          action: 'التحقق من تجمع الاتصالات',
          description: 'مراجعة استخدام تجمع الاتصالات والحدود القصوى',
          expectedOutcome: 'معرفة نسبة استخدام تجمع الاتصالات',
          troubleshooting: ['زيادة حجم تجمع الاتصالات مؤقتاً', 'إعادة تشغيل التطبيق لتحرير الاتصالات العالقة'],
        },
        {
          order: 3,
          action: 'فحص الأقفال',
          description: 'البحث عن أقفال قاعدة البيانات والمعاملات المعلقة',
          expectedOutcome: 'تحديد أي معاملات محجوبة',
          troubleshooting: ['إنهاء المعاملات المعلقة', 'الاتصال بفريق Supabase إذا لزم الأمر'],
        },
        {
          order: 4,
          action: 'إعادة تشغيل تجمع الاتصالات',
          description: 'إعادة تعيين جميع الاتصالات في تجمع الاتصالات',
          expectedOutcome: 'تحرير جميع الاتصالات وإعادة التوصيل',
          troubleshooting: ['إذا لم تنجح إعادة التشغيل، انتقل إلى خطوة التبديل'],
        },
        {
          order: 5,
          action: 'التبديل إلى قاعدة احتياطية',
          description: 'تفعيل قاعدة البيانات الاحتياطية إذا كانت متوفرة',
          expectedOutcome: 'استعادة الخدمة من قاعدة البيانات الاحتياطية',
          troubleshooting: ['التحقق من مزامنة القاعدة الاحتياطية', 'تحديث DNS إذا لزم الأمر'],
        },
        {
          order: 6,
          action: 'التحقق من النسخ المتماثل',
          description: 'التأكد من سلامة النسخ المتماثل بعد التبديل',
          expectedOutcome: 'تأكيد عمل النسخ المتماثل بشكل صحيح',
          troubleshooting: ['مراجعة سجلات النسخ المتماثل', 'مقارنة عدد السجلات بين القاعدتين'],
        },
      ],
      estimatedResolution: '15-30 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-002',
      title: 'تأخر استجابة النظام',
      description: 'تشخيص وحل مشكلة بطء استجابة النظام',
      severity: 'high',
      affectedModules: ['API', 'قاعدة البيانات', 'الواجهة الأمامية'],
      steps: [
        {
          order: 1,
          action: 'فحص زمن استجابة API',
          description: 'قياس زمن استجابة نقاط API الرئيسية',
          expectedOutcome: 'تحديد نقاط API البطيئة',
          troubleshooting: ['استخدام أدوات مراقبة الأداء', 'فحص سجلات الخادم'],
        },
        {
          order: 2,
          action: 'مراجعة أداء استعلامات DB',
          description: 'تحليل استعلامات قاعدة البيانات البطيئة',
          expectedOutcome: 'تحديد الاستعلامات التي تستهلك موارد كثيرة',
          troubleshooting: ['إضافة فهارس مفقودة', 'تحسين استعلامات SQL'],
        },
        {
          order: 3,
          action: 'فحص تشبع تجمع الاتصالات',
          description: 'مراجعة استخدام تجمع اتصالات قاعدة البيانات',
          expectedOutcome: 'معرفة ما إذا كان تجمع الاتصالات ممتلئاً',
          troubleshooting: ['زيادة حجم تجمع الاتصالات', 'إعادة تشغيل التطبيق'],
        },
        {
          order: 4,
          action: 'مراجعة معدل hits التخزين المؤقت',
          description: 'فحص فعالية التخزين المؤقت للبيانات',
          expectedOutcome: 'معرفة نسبة hits التخزين المؤقت',
          troubleshooting: ['تعديل سياسات التخزين المؤقت', 'إضافة تخزين مؤقت للاستعلامات المتكررة'],
        },
        {
          order: 5,
          action: 'توسعة الموارد',
          description: 'زيادة موارد الخادم إذا لزم الأمر',
          expectedOutcome: 'تحسين أداء النظام',
          troubleshooting: ['توسعة قاعدة البيانات', 'إضافة عقد خادم إضافية'],
        },
      ],
      estimatedResolution: '10-20 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-003',
      title: 'فشل مصادقة المستخدمين',
      description: 'معالجة مشاكل تسجيل الدخول والمصادقة',
      severity: 'critical',
      affectedModules: ['المصادقة', 'إدارة المستخدمين', 'الواجهة الأمامية'],
      steps: [
        {
          order: 1,
          action: 'فحص حالة موفر المصادقة',
          description: 'التحقق من توفر خدمة Supabase Auth',
          expectedOutcome: 'تأكيد عمل خدمة المصادقة',
          troubleshooting: ['مراجعة لوحة تحكم Supabase Auth', 'التحقق من حالة API'],
        },
        {
          order: 2,
          action: 'التحقق من تكوين JWT',
          description: 'مراجعة إعدادات JWT وصلاحية التوقيع',
          expectedOutcome: 'تأكيد صحة تكوين JWT',
          troubleshooting: ['إعادة إنشاء سر JWT', 'التحقق من صلاحية الشهادة'],
        },
        {
          order: 3,
          action: 'فحص مخزن الجلسات',
          description: 'التحقق من مخزن جلسات Redis',
          expectedOutcome: 'تأكيد عمل مخزن الجلسات',
          troubleshooting: ['إعادة تشغيل Redis', 'التحقق من مساحة التخزين'],
        },
        {
          order: 4,
          action: 'مراجعة سجلات المصادقة',
          description: 'تحليل سجلات المصادقة لأخطاء',
          expectedOutcome: 'تحديد سبب فشل المصادقة',
          troubleshooting: ['البحث عن أنماط الفشل المتكررة', 'التحقق من محاولات الاختراق'],
        },
        {
          order: 5,
          action: 'اختبار باستخدام حساب مسؤول',
          description: 'تجربة تسجيل الدخول بحساب مسؤول للتحقق',
          expectedOutcome: 'تأكيد صلاحية حساب المسؤول',
          troubleshooting: ['إعادة تعيين كلمة مرور المسؤول', 'التحقق من صلاحيات الحساب'],
        },
      ],
      estimatedResolution: '10-15 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-004',
      title: 'فشل سير العمل',
      description: 'معالجة فشل في سير عمل عملية ما',
      severity: 'high',
      affectedModules: ['محرك سير العمل', 'سير العمل', 'الكيانات المرتبطة'],
      steps: [
        {
          order: 1,
          action: 'تحديد سير العمل الفاشل',
          description: 'البحث عن سير العمل المتوقف أو الفاشل',
          expectedOutcome: 'تحديد هوية سير العمل الفاشل',
          troubleshooting: ['استخدام شاشة مراقبة سير العمل', 'مراجعة سجلات الحالة'],
        },
        {
          order: 2,
          action: 'فحص تبعيات الخطوات',
          description: 'مراجعة الخطوات السابقة والتبعيات',
          expectedOutcome: 'معرفة أي خطوة تسببت في الفشل',
          troubleshooting: ['التحقق من صحة بيانات الإدخال', 'مراجعة شروط الانتقال بين الخطوات'],
        },
        {
          order: 3,
          action: 'التحقق من حالة الكيان',
          description: 'مراجعة حالة الكيان المرتبط بسير العمل',
          expectedOutcome: 'معرفة ما إذا كان الكيان في حالة صحيحة',
          troubleshooting: ['تصحيح حالة الكيان يدوياً', 'التحقق من القيود'],
        },
        {
          order: 4,
          action: 'إعادة محاولة الخطوة',
          description: 'إعادة تشغيل الخطوة الفاشلة',
          expectedOutcome: 'إكمال سير العمل بنجاح',
          troubleshooting: ['إذا تكرر الفشل، انتقل إلى الخطوة التالية'],
        },
        {
          order: 5,
          action: 'تصعيد إلى المطورين',
          description: 'إبلاغ فريق التطوير إذا استمر الفشل',
          expectedOutcome: 'تحليل السبب الجذري وإصلاحه',
          troubleshooting: ['تزويد المطورين بسجلات الخطأ', 'تصدير حالة سير العمل'],
        },
      ],
      estimatedResolution: '15-30 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-005',
      title: 'تأخر المزامنة',
      description: 'معالجة تأخر مزامنة البيانات في الوقت الفعلي',
      severity: 'medium',
      affectedModules: ['المزامنة', 'الوقت الفعلي', 'WebSocket', 'واجهة المستخدم'],
      steps: [
        {
          order: 1,
          action: 'فحص حالة الاشتراك في الوقت الفعلي',
          description: 'التحقق من اشتراكات Supabase Realtime',
          expectedOutcome: 'تأكيد حالة الاشتراكات',
          troubleshooting: ['مراجعة سجلات Supabase Realtime', 'التحقق من صلاحية المفتاح'],
        },
        {
          order: 2,
          action: 'التحقق من اتصال WebSocket',
          description: 'اختبار اتصال WebSocket مع الخادم',
          expectedOutcome: 'تأكيد عمل WebSocket',
          troubleshooting: ['فحص جدار الحماية', 'التحقق من إعدادات Proxy'],
        },
        {
          order: 3,
          action: 'فحص عمق قائمة الانتظار',
          description: 'مراجعة عدد الرسائل في قائمة انتظار المزامنة',
          expectedOutcome: 'معرفة حجم التأخير في المزامنة',
          troubleshooting: ['معالجة تراكم الرسائل', 'زيادة سرعة معالجة الرسائل'],
        },
        {
          order: 4,
          action: 'إعادة تشغيل الاشتراك',
          description: 'إعادة تعيين اتصال الاشتراك في الوقت الفعلي',
          expectedOutcome: 'استعادة المزامنة في الوقت الفعلي',
          troubleshooting: ['إعادة تحميل الصفحة', 'مسح ذاكرة التخزين المؤقت'],
        },
        {
          order: 5,
          action: 'التحقق من تناسق البيانات',
          description: 'مقارنة البيانات بين المصادر المختلفة',
          expectedOutcome: 'تأكيد تطابق البيانات',
          troubleshooting: ['مزامنة يدوية للبيانات', 'تشغيل فحص التناسق'],
        },
      ],
      estimatedResolution: '5-15 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-006',
      title: 'خطأ في الفوترة',
      description: 'معالجة مشاكل الفوترة والمدفوعات',
      severity: 'high',
      affectedModules: ['الفوترة', 'Stripe', 'الاشتراكات', 'المالية'],
      steps: [
        {
          order: 1,
          action: 'فحص سجلات Stripe Webhook',
          description: 'مراجعة سجلات Webhook من Stripe',
          expectedOutcome: 'تحديد محاولات الفوترة الفاشلة',
          troubleshooting: ['التحقق من توقيع Webhook', 'إعادة إرسال الأحداث الفاشلة'],
        },
        {
          order: 2,
          action: 'التحقق من حالة الاشتراك',
          description: 'مراجعة حالة اشتراك المستخدم',
          expectedOutcome: 'معرفة الحالة الحالية للاشتراك',
          troubleshooting: ['التحقق من صلاحية طريقة الدفع', 'مراجعة تواريخ الفوترة'],
        },
        {
          order: 3,
          action: 'فحص إنشاء الفواتير',
          description: 'مراجعة عملية إنشاء الفاتورة',
          expectedOutcome: 'تحديد سبب فشل إنشاء الفاتورة',
          troubleshooting: ['إعادة إنشاء الفاتورة يدوياً', 'التحقق من صحة البيانات'],
        },
        {
          order: 4,
          action: 'التسوية اليدوية',
          description: 'إجراء تسوية يدوية إذا لزم الأمر',
          expectedOutcome: 'تسوية الفروقات والمبالغ',
          troubleshooting: ['مراجعة كشف حساب Stripe', 'مقارنة مع سجلات النظام'],
        },
        {
          order: 5,
          action: 'الاتصال بدعم Stripe',
          description: 'التواصل مع فريق دعم Stripe إذا استمرت المشكلة',
          expectedOutcome: 'الحصول على مساعدة من Stripe',
          troubleshooting: ['تجهيز معرفات المعاملات', 'وصف المشكلة بالتفصيل'],
        },
      ],
      estimatedResolution: '30-60 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-007',
      title: 'تجاوز حد التخزين',
      description: 'معالجة مشكلة تجاوز سعة التخزين',
      severity: 'medium',
      affectedModules: ['قاعدة البيانات', 'التخزين', 'النظام'],
      steps: [
        {
          order: 1,
          action: 'فحص استخدام التخزين',
          description: 'مراجعة استخدام مساحة التخزين الحالية',
          expectedOutcome: 'معرفة نسبة الاستخدام',
          troubleshooting: ['استخدام أدوات Supabase', 'التحقق من حجم كل جدول'],
        },
        {
          order: 2,
          action: 'تحديد الجداول الكبيرة',
          description: 'البحث عن الجداول التي تستهلك مساحة كبيرة',
          expectedOutcome: 'تحديد مصادر استهلاك المساحة',
          troubleshooting: ['فحص جداول السجلات', 'مراجعة جداول البيانات المؤقتة'],
        },
        {
          order: 3,
          action: 'أرشفة البيانات القديمة',
          description: 'نقل البيانات القديمة إلى نظام الأرشفة',
          expectedOutcome: 'تحرير مساحة تخزين',
          troubleshooting: ['تحديد معايير الأرشفة', 'التحقق من سلامة البيانات المؤرشفة'],
        },
        {
          order: 4,
          action: 'تنظيف البيانات المؤقتة',
          description: 'حذف البيانات المؤقتة وغير الضرورية',
          expectedOutcome: 'زيادة المساحة المتاحة',
          troubleshooting: ['مراجعة صلاحية البيانات', 'التحقق من عدم استخدام البيانات'],
        },
        {
          order: 5,
          action: 'إخطار المسؤول بترقية الخطة',
          description: 'إبلاغ المسؤول بالحاجة لترقية خطة التخزين',
          expectedOutcome: 'ترقية خطة التخزين',
          troubleshooting: ['مقارنة خطط التخزين', 'تقدير الاحتياجات المستقبلية'],
        },
      ],
      estimatedResolution: '20-40 دقيقة',
      lastUpdated: Date.now(),
    },
    {
      id: 'RB-008',
      title: 'فشل الترحيل المحاسبي',
      description: 'معالجة فشل في ترحيل القيود المحاسبية',
      severity: 'high',
      affectedModules: ['المحاسبة', 'دفتر الأستاذ', 'التقارير المالية'],
      steps: [
        {
          order: 1,
          action: 'فحص صحة قيد اليومية',
          description: 'التحقق من توازن القيد وصحة الحسابات',
          expectedOutcome: 'تحديد ما إذا كان القيد متوازناً',
          troubleshooting: ['التحقق من طرفي القيد', 'مراجعة مبالغ القيد'],
        },
        {
          order: 2,
          action: 'التحقق من أرصدة الحسابات',
          description: 'مراجعة أرصدة الحسابات المعنية',
          expectedOutcome: 'معرفة ما إذا كانت الأرصدة كافية',
          troubleshooting: ['التحقق من حركة الحساب', 'مراجعة الترحيلات السابقة'],
        },
        {
          order: 3,
          action: 'فحص حالة الفترة',
          description: 'التحقق من أن الفترة المحاسبية مفتوحة',
          expectedOutcome: 'تأكيد أن الفترة قابلة للترحيل',
          troubleshooting: ['فتح الفترة المغلقة مؤقتاً', 'التحقق من تاريخ القيد'],
        },
        {
          order: 4,
          action: 'التحقق من قواعد الترحيل',
          description: 'مراجعة قواعد الترحيل المحاسبي',
          expectedOutcome: 'التأكد من مطابقة القيد لقواعد الترحيل',
          troubleshooting: ['مراجعة قيود العملة', 'التحقق من حسابات المقابلة'],
        },
        {
          order: 5,
          action: 'التصحيح اليدوي',
          description: 'إجراء تصحيح يدوي للقيد إذا لزم الأمر',
          expectedOutcome: 'ترحيل القيد بنجاح',
          troubleshooting: ['إنشاء قيد تصحيحي', 'الترحيل إلى فترة بديلة'],
        },
      ],
      estimatedResolution: '15-25 دقيقة',
      lastUpdated: Date.now(),
    },
  ]
}
