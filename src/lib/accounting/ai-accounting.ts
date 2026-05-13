// ============================================================
// AI Accounting Engine — Suggestions, Anomaly Detection, Auto-Categorization
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  JournalSuggestion,
  AnomalyResult,
  AutoCategorizationResult,
} from './enterprise-types'

interface AIContext {
  companyId: string
  description?: string
  amount?: number
  source?: string
}

export class AIAccountingEngine {
  private supabase: SupabaseClient
  private companyId: string

  constructor(supabase: SupabaseClient, companyId: string) {
    this.supabase = supabase
    this.companyId = companyId
  }

  // ── Journal Suggestions ──────────────────────────────────────
  async suggestJournalEntry(description: string, amount?: number): Promise<JournalSuggestion[]> {
    const suggestions: JournalSuggestion[] = []
    const lower = description.toLowerCase()

    // Revenue patterns
    if (this.matchAny(lower, ['بيع', 'مبيعات', 'فاتورة', 'sale', 'invoice', 'customer'])) {
      suggestions.push({
        confidence: 0.85,
        description: `تسجيل إيراد: ${description}`,
        lines: [
          { account_code: '1101', debit: amount || 0, credit: 0, description: 'الصندوق' },
          { account_code: '4001', debit: 0, credit: amount || 0, description: 'إيراد المبيعات' },
        ],
        reason: 'نمط فاتورة مبيعات',
      })
    }

    // Expense patterns
    if (this.matchAny(lower, ['مصروف', 'expense', 'دفع', 'payment', 'شراء', 'purchase'])) {
      suggestions.push({
        confidence: 0.8,
        description: `تسجيل مصروف: ${description}`,
        lines: [
          { account_code: '6501', debit: amount || 0, credit: 0, description },
          { account_code: '1101', debit: 0, credit: amount || 0, description: 'الصندوق' },
        ],
        reason: 'نمط مصروف عام',
      })
    }

    // Purchase patterns
    if (this.matchAny(lower, ['مشتريات', 'شراء', 'purchase', 'مخزون', 'inventory'])) {
      suggestions.push({
        confidence: 0.85,
        description: `تسجيل مشتريات: ${description}`,
        lines: [
          { account_code: '1120', debit: amount || 0, credit: 0, description: 'المخزون' },
          { account_code: '2101', debit: 0, credit: amount || 0, description: 'ذمم دائنة' },
        ],
        reason: 'نمط فاتورة مشتريات',
      })
    }

    // Payroll patterns
    if (this.matchAny(lower, ['راتب', 'مرتب', 'salary', 'payroll', 'أجور', 'wages'])) {
      suggestions.push({
        confidence: 0.9,
        description: `تسجيل رواتب: ${description}`,
        lines: [
          { account_code: '6101', debit: amount || 0, credit: 0, description: 'الرواتب والأجور' },
          { account_code: '2106', debit: 0, credit: amount || 0, description: 'رواتب مستحقة' },
        ],
        reason: 'نمط كشف رواتب',
      })
    }

    // Rent patterns
    if (this.matchAny(lower, ['إيجار', 'rent', 'ايجار'])) {
      suggestions.push({
        confidence: 0.92,
        description: `تسجيل إيجار: ${description}`,
        lines: [
          { account_code: '6201', debit: amount || 0, credit: 0, description: 'مصروف الإيجار' },
          { account_code: '1101', debit: 0, credit: amount || 0, description: 'الصندوق' },
        ],
        reason: 'نمط دفعة إيجار',
      })
    }

    // Customer payment patterns
    if (this.matchAny(lower, ['تحصيل', 'collection', 'قبض', 'receipt', 'دفعة عميل'])) {
      suggestions.push({
        confidence: 0.88,
        description: `تسجيل تحصيل: ${description}`,
        lines: [
          { account_code: '1101', debit: amount || 0, credit: 0, description: 'الصندوق' },
          { account_code: '1110', debit: 0, credit: amount || 0, description: 'ذمم مدينة' },
        ],
        reason: 'نمط تحصيل من عميل',
      })
    }

    // Supplier payment patterns
    if (this.matchAny(lower, ['دفع', 'payment', 'سداد', 'pay', 'مورد', 'supplier'])) {
      suggestions.push({
        confidence: 0.88,
        description: `تسجيل دفعة لمورد: ${description}`,
        lines: [
          { account_code: '2101', debit: amount || 0, credit: 0, description: 'ذمم دائنة' },
          { account_code: '1101', debit: 0, credit: amount || 0, description: 'الصندوق' },
        ],
        reason: 'نمط دفعة لمورد',
      })
    }

    // Default suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        confidence: 0.5,
        description: `تسجيل يدوي: ${description}`,
        lines: [
          { account_code: '6501', debit: amount || 0, credit: 0, description },
          { account_code: '1101', debit: 0, credit: amount || 0, description: 'مقابل' },
        ],
        reason: 'توصية عامة - يرجى المراجعة',
      })
    }

    return suggestions
  }

  // ── Anomaly Detection ────────────────────────────────────────
  async detectAnomalies(): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = []
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    // 1. Unusually large journal entries
    const { data: entries } = await this.supabase
      .from('journal_entries')
      .select('id, entry_number, description, total_debit, date, company_id')
      .eq('company_id', this.companyId)
      .gte('date', thirtyDaysAgo)
      .order('total_debit', { ascending: false })
      .limit(5)

    const avgResult = await this.supabase
      .from('journal_entries')
      .select('total_debit')
      .eq('company_id', this.companyId)
      .gte('date', thirtyDaysAgo)

    const allAmounts = (avgResult.data || []).map((r: any) => Number(r.total_debit))
    const avgAmount = allAmounts.length > 0
      ? allAmounts.reduce((s, v) => s + v, 0) / allAmounts.length
      : 0
    const threshold = avgAmount * 3

    for (const entry of (entries || []) as any[]) {
      if (Number(entry.total_debit) > threshold && threshold > 1000) {
        anomalies.push({
          type: 'unusual_amount',
          severity: 'medium',
          message: `قيد غير معتاد: ${entry.entry_number} بقيمة ${entry.total_debit}`,
          details: { entry_id: entry.id, amount: entry.total_debit, avg: avgAmount },
          suggestion: 'يرجى مراجعة هذا القيد للتأكد من صحته',
        })
      }
    }

    // 2. Unbalanced entries
    const { data: unbalanced } = await this.supabase
      .from('journal_entries')
      .select('id, entry_number, total_debit, total_credit')
      .eq('company_id', this.companyId)
      .eq('status', 'posted')

    for (const entry of (unbalanced || []) as any[]) {
      const diff = Math.abs(Number(entry.total_debit) - Number(entry.total_credit))
      if (diff > 0.01) {
        anomalies.push({
          type: 'broken_balance',
          severity: 'high',
          message: `قيد غير متوازن: ${entry.entry_number} (الفرق: ${diff})`,
          details: { entry_id: entry.id, debit: entry.total_debit, credit: entry.total_credit, diff },
          suggestion: 'يجب تصحيح القيد فوراً لضمان Integrity البيانات',
        })
      }
    }

    // 3. Unusual account usage
    const { data: recentLines } = await this.supabase
      .from('journal_entry_lines')
      .select(`
        account_id, debit, credit,
        accounts!inner(code, name_ar, type),
        journal_entries!inner(date, company_id)
      `)
      .eq('journal_entries.company_id', this.companyId)
      .gte('journal_entries.date', thirtyDaysAgo)

    const accountUsage: Record<string, number> = {}
    for (const line of (recentLines || []) as any[]) {
      if (line.accounts?.code) {
        accountUsage[line.accounts.code] = (accountUsage[line.accounts.code] || 0) + 1
      }
    }

    return anomalies
  }

  // ── Recurring Transaction Detection ──────────────────────────
  async detectRecurringTransactions(): Promise<JournalSuggestion[]> {
    const suggestions: JournalSuggestion[] = []
    const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

    const { data: entries } = await this.supabase
      .from('journal_entries')
      .select('id, description, total_debit, total_credit, date')
      .eq('company_id', this.companyId)
      .gte('date', threeMonthsAgo)
      .order('date', { ascending: true })

    if (!entries || entries.length < 3) return suggestions

    const byDescription: Record<string, Array<{ date: string; amount: number }>> = {}
    for (const entry of entries as any[]) {
      const desc = (entry.description || '').trim()
      if (!desc) continue
      if (!byDescription[desc]) byDescription[desc] = []
      byDescription[desc].push({
        date: entry.date,
        amount: Number(entry.total_debit),
      })
    }

    for (const [desc, occurrences] of Object.entries(byDescription)) {
      if (occurrences.length >= 3) {
        const intervals: number[] = []
        for (let i = 1; i < occurrences.length; i++) {
          const diff = Math.abs(
            new Date(occurrences[i].date).getTime() - new Date(occurrences[i - 1].date).getTime()
          )
          intervals.push(diff / (1000 * 60 * 60 * 24))
        }

        const avgInterval = intervals.length > 0
          ? intervals.reduce((s, v) => s + v, 0) / intervals.length
          : 0

        if (avgInterval > 0 && intervals.every(i => Math.abs(i - avgInterval) / avgInterval <= 0.2)) {
          const amounts = occurrences.map(o => o.amount)
          const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length

          suggestions.push({
            confidence: 0.8,
            description: `قيد متكرر مكتشف: ${desc}`,
            lines: [],
            reason: `ظهر ${occurrences.length} مرات بمتوسط فاصل ${Math.round(avgInterval)} يوم ومتوسط قيمة ${avgAmount.toFixed(2)}`,
          })
        }
      }
    }

    return suggestions
  }

  // ── Auto-Categorization ──────────────────────────────────────
  async autoCategorize(description: string): Promise<AutoCategorizationResult> {
    const lower = description.toLowerCase()

    if (this.matchAny(lower, ['رجال', 'نسائي', 'ملابس', 'فساتين', 'dress', 'clothing', 'robe'])) {
      return {
        confidence: 0.9,
        suggested_code: '4001',
        suggested_name: 'إيرادات المبيعات',
        reason: 'وصف المنتج يتوافق مع إيرادات المبيعات',
      }
    }
    if (this.matchAny(lower, ['كهرباء', 'ماء', 'electricity', 'water', 'utility'])) {
      return {
        confidence: 0.95,
        suggested_code: '6202',
        suggested_name: 'الكهرباء والماء',
        reason: 'مصروف خدمي',
      }
    }
    if (this.matchAny(lower, ['إيجار', 'rent', 'ايجار'])) {
      return {
        confidence: 0.95,
        suggested_code: '6201',
        suggested_name: 'الإيجار',
        reason: 'مصروف إيجار',
      }
    }
    if (this.matchAny(lower, ['مواصلات', 'نقل', 'transport', 'fuel', 'وقود', 'بنزين'])) {
      return {
        confidence: 0.9,
        suggested_code: '6501',
        suggested_name: 'مصروفات نقل',
        reason: 'مصروف مواصلات',
      }
    }
    if (this.matchAny(lower, ['سفر', 'تذاكر', 'طيران', 'travel', 'flight', 'hotel', 'فندق'])) {
      return {
        confidence: 0.85,
        suggested_code: '6501',
        suggested_name: 'مصروفات سفر',
        reason: 'مصروف سفر',
      }
    }
    if (this.matchAny(lower, ['دعاية', 'إعلان', 'advert', 'marketing', 'تسويق', 'اعلان'])) {
      return {
        confidence: 0.92,
        suggested_code: '6301',
        suggested_name: 'الإعلان والتسويق',
        reason: 'مصروف تسويق',
      }
    }
    if (this.matchAny(lower, ['صيانة', 'maintenance', 'تصليح', 'repair'])) {
      return {
        confidence: 0.9,
        suggested_code: '6203',
        suggested_name: 'الصيانة والإصلاحات',
        reason: 'مصروف صيانة',
      }
    }
    if (this.matchAny(lower, ['عمولة', 'commission', 'بنك', 'bank', 'تحويل'])) {
      return {
        confidence: 0.88,
        suggested_code: '6402',
        suggested_name: 'عمولات بنكية',
        reason: 'مصروف بنكي',
      }
    }

    return {
      confidence: 0.5,
      suggested_code: '6501',
      suggested_name: 'مصروفات متنوعة',
      reason: 'لم يتم التعرف على النمط — استخدام الحساب الافتراضي',
    }
  }

  // ── Financial Insights ───────────────────────────────────────
  async generateInsights(): Promise<Array<{ type: string; message: string; severity: string; action_url?: string }>> {
    const insights: Array<{ type: string; message: string; severity: string; action_url?: string }> = []
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'

    // Revenue vs Expense comparison
    const { data: revenueLines } = await this.supabase
      .from('journal_entry_lines')
      .select('credit, debit')
      .gte('journal_entries(date)', monthStart)
      .lte('journal_entries(date)', today)
      .eq('journal_entries.company_id', this.companyId)
      .eq('journal_entries.status', 'posted')
      .eq('accounts.type', 'revenue')

    const { data: expenseLines } = await this.supabase
      .from('journal_entry_lines')
      .select('debit, credit')
      .gte('journal_entries(date)', monthStart)
      .lte('journal_entries(date)', today)
      .eq('journal_entries.company_id', this.companyId)
      .eq('journal_entries.status', 'posted')
      .in('accounts.type', ['expense', 'cogs'])

    const revenue = (revenueLines || []).reduce((s, r: any) => s + Number(r.credit || 0) - Number(r.debit || 0), 0)
    const expenses = (expenseLines || []).reduce((s, r: any) => s + Number(r.debit || 0) - Number(r.credit || 0), 0)

    if (revenue > 0 && expenses > 0) {
      const ratio = revenue / expenses
      if (ratio < 1.1) {
        insights.push({
          type: 'profit_warning',
          message: `نسبة الإيرادات إلى المصروفات هذا الشهر منخفضة (${ratio.toFixed(2)})`,
          severity: 'warning',
          action_url: '/dashboard/accounting/statements?type=income',
        })
      } else if (ratio > 3) {
        insights.push({
          type: 'high_margin',
          message: `هامش الربح ممتاز هذا الشهر (${((1 - 1/ratio) * 100).toFixed(0)}%)`,
          severity: 'positive',
        })
      }
    }

    // Unreconciled items
    const { count: unmatchedCount } = await this.supabase
      .from('reconciliations')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .neq('status', 'matched')

    if (unmatchedCount && unmatchedCount > 5) {
      insights.push({
        type: 'unreconciled',
        message: `هناك ${unmatchedCount} عملية غير مطابقة تحتاج للتسوية`,
        severity: 'warning',
        action_url: '/dashboard/accounting/reconciliation',
      })
    }

    // Draft entries
    const { count: draftCount } = await this.supabase
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', this.companyId)
      .eq('status', 'draft')

    if (draftCount && draftCount > 0) {
      insights.push({
        type: 'draft_entries',
        message: `هناك ${draftCount} قيود في حالة المسودة تحتاج للمراجعة`,
        severity: 'info',
        action_url: '/dashboard/accounting/journal?status=draft',
      })
    }

    return insights
  }

  // ── Reconciliation Suggestions ────────────────────────────
  async suggestReconciliation(): Promise<Array<{
    invoice_id: string
    invoice_ref: string
    invoice_amount: number
    payment_ids: string[]
    total_paid: number
    confidence: number
  }>> {
    const suggestions: Array<{
      invoice_id: string
      invoice_ref: string
      invoice_amount: number
      payment_ids: string[]
      total_paid: number
      confidence: number
    }> = []

    const { data: invoices } = await this.supabase
      .from('journal_entries')
      .select('id, reference, total_debit, date')
      .eq('company_id', this.companyId)
      .eq('status', 'posted')
      .eq('source', 'pos')
      .order('date', { ascending: false })
      .limit(50)

    const { data: payments } = await this.supabase
      .from('journal_entries')
      .select('id, reference, total_credit, date')
      .eq('company_id', this.companyId)
      .eq('status', 'posted')
      .eq('source', 'customer_payment')
      .order('date', { ascending: false })
      .limit(50)

    if (!invoices || !payments) return suggestions

    for (const inv of invoices as any[]) {
      const invAmount = Number(inv.total_debit)
      let remaining = invAmount
      const matchedPayments: string[] = []

      for (const pmt of (payments || []) as any[]) {
        const pmtAmount = Number(pmt.total_credit)
        if (matchedPayments.includes(pmt.id)) continue

        if (new Date(pmt.date) >= new Date(inv.date) && remaining > 0) {
          matchedPayments.push(pmt.id)
          remaining -= pmtAmount
          if (remaining <= 0) break
        }
      }

      if (matchedPayments.length > 0) {
        const totalPaid = invAmount - Math.max(0, remaining)
        suggestions.push({
          invoice_id: inv.id,
          invoice_ref: inv.reference || inv.id.slice(0, 8),
          invoice_amount: invAmount,
          payment_ids: matchedPayments,
          total_paid: totalPaid,
          confidence: Math.abs(totalPaid - invAmount) < 0.01 ? 0.95 : 0.7,
        })
      }
    }

    return suggestions
  }

  private matchAny(text: string, patterns: string[]): boolean {
    return patterns.some(p => text.includes(p))
  }
}
