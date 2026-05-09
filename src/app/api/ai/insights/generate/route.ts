import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMetrics, generateRuleBasedInsights, type InsightItem } from '@/lib/insights-engine'
import { getCompanyId } from '@/lib/tenant'

const OPENAI_KEY = process.env.OPENAI_API_KEY

async function enhanceWithAI(metrics: any, ruleInsights: InsightItem[]): Promise<InsightItem[]> {
  if (!OPENAI_KEY) return ruleInsights

  const prompt = `أنت محلل بيانات لنظام ERP تجاري. بناءً على المقاييس التالية، قدّم 3-5 رؤى تجارية مفيدة وقابلة للتنفيذ باللغة العربية.

المقاييس:
${JSON.stringify(metrics, null, 2)}

الرؤى الحالية القاعدية:
${ruleInsights.map(i => `- ${i.title}: ${i.message}`).join('\n')}

أضف رؤى إضافية غير موجودة أعلاه أو حسّن الموجودة بلغة أكثر طبيعية وتفصيلاً.

أجب بـ JSON فقط بهذا الشكل:
[
  {
    "category": "sales|inventory|customers|profit|general",
    "severity": "info|success|warning|danger",
    "title": "عنوان قصير",
    "message": "رسالة تفصيلية وقابلة للتنفيذ"
  }
]`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!res.ok) return ruleInsights

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) return ruleInsights

    const parsed = JSON.parse(content)
    const aiInsights: InsightItem[] = Array.isArray(parsed) ? parsed : parsed.insights || []
    // Merge: AI insights take priority, keep rule-based ones not duplicated
    return [...aiInsights.slice(0, 5), ...ruleInsights.slice(0, 3)]
  } catch {
    return ruleInsights
  }
}

export async function POST() {
  try {
    const COMPANY_ID = getCompanyId()
    const supabase = createClient()

    // Compute metrics
    const metrics = await computeMetrics()

    // Generate rule-based insights
    const ruleInsights = generateRuleBasedInsights(metrics)

    // Enhance with AI if key is available
    const insights = await enhanceWithAI(metrics, ruleInsights)

    // Clear old insights for this company
    await supabase.from('ai_insights').delete().eq('company_id', COMPANY_ID)

    // Store new insights
    if (insights.length > 0) {
      await supabase.from('ai_insights').insert(
        insights.map(ins => ({
          company_id: COMPANY_ID,
          category: ins.category,
          severity: ins.severity,
          title: ins.title,
          message: ins.message,
          metric: ins.metric || null,
          is_read: false,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }))
      )
    }

    return NextResponse.json({ success: true, count: insights.length, hasAI: !!OPENAI_KEY })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .gte('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
  return NextResponse.json(data || [])
}
