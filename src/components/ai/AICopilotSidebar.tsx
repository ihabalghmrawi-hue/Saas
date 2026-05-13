'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Bot, X, Sparkles, TrendingUp, AlertTriangle, Lightbulb, BarChart3, Send, Loader2, ChevronLeft } from 'lucide-react'

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: 'تحليل الإيرادات', prompt: 'حلل إيرادات هذا الشهر مقارنة بالشهر الماضي' },
  { icon: AlertTriangle, label: 'حالات شاذة', prompt: 'ما هي الحالات الشاذة في البيانات المالية هذا الأسبوع؟' },
  { icon: Lightbulb, label: 'توصيات', prompt: 'قدم توصيات لتحسين التدفق النقدي' },
  { icon: BarGraph, iconType: BarChart3, label: 'تقارير', prompt: 'أنشئ تقرير ملخص للأداء المالي' },
]

function BarGraph(props: any) { return <BarChart3 {...props} /> }

const SAMPLE_RESPONSES: Record<string, string> = {
  'تحليل': 'بناءً على تحليل البيانات المالية لشهر يناير:\n\n• إجمالي الإيرادات: 3,500,000 ر.س (ارتفاع 12% عن الشهر الماضي)\n• إجمالي المصروفات: 2,970,000 ر.س (انخفاض 3%)\n• صافي الربح: 530,000 ر.س (ارتفاع 35%)\n\nأبرز الملاحظات:\n- ارتفاع المبيعات بنسبة 18% في قطاع التجزئة\n- انخفاض المصروفات الإدارية بنسبة 8%\n- تحسن هامش الربح من 12% إلى 15%',
  'شاذة': 'تم اكتشاف 3 حالات شاذة هذا الأسبوع:\n\n1. 🔴 حرجة: اختلاف في رصيد الصندوق (-5,000 ر.س)\n2. 🟡 عالية: قيد مبيعات مكرر (150,000 ر.س)\n3. 🟡 متوسطة: تجاوز حد ائتماني لعميل\n\nجميع الحالات تتطلب مراجعة فورية.',
  'توصيات': 'توصيات لتحسين التدفق النقدي:\n\n1. 📊 تسريع تحصيل العملاء (متوسط 45 يوم → 30 يوم)\n2. 📦 تحسين دوران المخزون (متوسط 60 يوم → 45 يوم)\n3. 💰 إعادة جدولة الدفعات للموردين\n4. 📈 زيادة هامش الربح عبر تحسين التسعير\n\nالتأثير المتوقع: تحسين التدفق النقدي بمقدار 350,000 ر.س شهرياً',
  'تقارير': 'ملخص الأداء المالي - يناير 2024:\n\n• المبيعات: 3,500,000 ر.س ✅ (+12%)\n• تكلفة المبيعات: 2,100,000 ر.س\n• مجمل الربح: 1,400,000 ر.س (40%)\n• المصروفات: 870,000 ر.س\n• صافي الربح: 530,000 ر.س ✅ (+35%)\n\nالمؤشرات الرئيسية:\n- هامش الربح: 15%\n- نسبة السيولة: 2.1\n- دوران المخزون: 6 مرات',
}

function getAIResponse(input: string): string {
  const key = Object.keys(SAMPLE_RESPONSES).find(k => input.includes(k))
  return key ? SAMPLE_RESPONSES[key] : 'شكراً لسؤالك. بناءً على تحليلي للبيانات، يمكنني تقديم المعلومات التالية:\n\n• المؤشرات المالية الرئيسية ضمن الحدود الطبيعية\n• لا توجد حالات شاذة تستدعي التدخل الفوري\n• الأداء العام مستقر مع إمكانية تحسين كفاءة العمليات\n\nهل تريد معلومات أكثر تفصيلاً عن جانب معين؟'
}

interface AICopilotSidebarProps {
  open: boolean
  onClose: () => void
}

export function AICopilotSidebar({ open, onClose }: AICopilotSidebarProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string }>>([])
  const [loading, setLoading] = useState(false)

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg) return
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    const response = getAIResponse(msg)
    setMessages(prev => [...prev, { role: 'ai', content: response }])
    setLoading(false)
  }

  return (
    <div
      className={cn(
        'fixed inset-y-0 left-0 z-[70] w-[440px] bg-card border-l shadow-2xl flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">المساعد الذكي</h2>
            <p className="text-xs text-muted-foreground">AI Copilot للمحاسبة والمالية</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-primary/50" />
            <h3 className="font-semibold mb-1">مرحباً! كيف يمكنني مساعدتك؟</h3>
            <p className="text-sm text-muted-foreground">اسألني عن التحليلات المالية، التقارير، أو التوصيات</p>
            <div className="grid grid-cols-2 gap-2 mt-6">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs rounded-lg bg-muted/50 hover:bg-accent transition-colors text-right"
                >
                  <q.icon className="h-4 w-4 text-primary shrink-0" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[85%] rounded-xl p-3 text-sm whitespace-pre-line',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 border'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="bg-muted/50 border rounded-xl p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جاري التحليل...
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="اكتب سؤالاً..."
            className="flex-1 h-10 px-3 bg-muted/50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
