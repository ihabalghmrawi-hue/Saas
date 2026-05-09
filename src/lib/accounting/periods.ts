// ============================================================
// Fiscal Period Management
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FiscalYear, AccountingPeriod } from './types'

// ── getCurrentFiscalYear ──────────────────────────────────────
export async function getCurrentFiscalYear(
  supabase:   SupabaseClient,
  company_id: string,
): Promise<FiscalYear | null> {
  const { data } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', company_id)
    .eq('is_current', true)
    .maybeSingle()

  return data as FiscalYear | null
}

// ── getCurrentPeriod ──────────────────────────────────────────
export async function getCurrentPeriod(
  supabase:   SupabaseClient,
  company_id: string,
  date?:      string,
): Promise<AccountingPeriod | null> {
  const targetDate = date || new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('company_id', company_id)
    .eq('status', 'open')
    .lte('start_date', targetDate)
    .gte('end_date', targetDate)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as AccountingPeriod | null
}

// ── ensureFiscalYear ──────────────────────────────────────────
export async function ensureFiscalYear(
  supabase:   SupabaseClient,
  company_id: string,
): Promise<FiscalYear> {
  // Check if current fiscal year exists
  const existing = await getCurrentFiscalYear(supabase, company_id)
  if (existing) return existing

  // Create a new fiscal year for the current calendar year
  const now       = new Date()
  const year      = now.getFullYear()
  const startDate = `${year}-01-01`
  const endDate   = `${year}-12-31`

  // Mark any previous 'active' years as not current
  await supabase
    .from('fiscal_years')
    .update({ is_current: false })
    .eq('company_id', company_id)

  const { data, error } = await supabase
    .from('fiscal_years')
    .insert({
      company_id,
      name:       `السنة المالية ${year}`,
      start_date: startDate,
      end_date:   endDate,
      status:     'active',
      is_current: true,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`فشل إنشاء السنة المالية: ${error?.message}`)
  }

  // Generate 12 monthly periods
  await generatePeriods(supabase, company_id, data.id)

  return data as FiscalYear
}

// ── ensurePeriod ──────────────────────────────────────────────
export async function ensurePeriod(
  supabase:   SupabaseClient,
  company_id: string,
  date:       string,
): Promise<AccountingPeriod> {
  // Try to find an existing period
  const existing = await getCurrentPeriod(supabase, company_id, date)
  if (existing) return existing

  // Ensure fiscal year exists
  const fiscalYear = await ensureFiscalYear(supabase, company_id)

  // Try again after creating fiscal year and periods
  const existingAfter = await getCurrentPeriod(supabase, company_id, date)
  if (existingAfter) return existingAfter

  // Create specific period for this date if still not found
  const d           = new Date(date)
  const year        = d.getFullYear()
  const month       = d.getMonth() + 1
  const startDate   = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay     = new Date(year, month, 0).getDate()
  const endDate     = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const periodNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]

  const { data, error } = await supabase
    .from('accounting_periods')
    .insert({
      company_id,
      fiscal_year_id: fiscalYear.id,
      period_number:  month,
      name:           `${periodNames[month - 1]} ${year}`,
      start_date:     startDate,
      end_date:       endDate,
      status:         'open',
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`فشل إنشاء الفترة المحاسبية: ${error?.message}`)
  }

  return data as AccountingPeriod
}

// ── getOrCreatePeriod ─────────────────────────────────────────
export async function getOrCreatePeriod(
  supabase:   SupabaseClient,
  company_id: string,
  date:       string,
): Promise<{ fiscal_year_id: string; period_id: string }> {
  const period = await ensurePeriod(supabase, company_id, date)

  return {
    fiscal_year_id: period.fiscal_year_id,
    period_id:      period.id,
  }
}

// ── closePeriod ───────────────────────────────────────────────
export async function closePeriod(
  supabase:   SupabaseClient,
  company_id: string,
  period_id:  string,
): Promise<{ ok: boolean; error?: string }> {
  // Verify period belongs to this company
  const { data: period } = await supabase
    .from('accounting_periods')
    .select('id, company_id, status')
    .eq('id', period_id)
    .eq('company_id', company_id)
    .maybeSingle()

  if (!period) {
    return { ok: false, error: 'الفترة المحاسبية غير موجودة' }
  }
  if (period.status === 'closed') {
    return { ok: false, error: 'الفترة المحاسبية مغلقة بالفعل' }
  }

  // Check no draft/pending entries in this period
  const { data: draftEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', company_id)
    .eq('period_id', period_id)
    .in('status', ['draft', 'pending'])
    .limit(1)

  if (draftEntries && draftEntries.length > 0) {
    return { ok: false, error: 'يوجد قيود غير مرحّلة في هذه الفترة. يرجى ترحيلها أو حذفها أولاً' }
  }

  const { error } = await supabase
    .from('accounting_periods')
    .update({ status: 'closed' })
    .eq('id', period_id)

  if (error) {
    return { ok: false, error: `فشل إغلاق الفترة: ${error.message}` }
  }

  return { ok: true }
}

// ── generatePeriods ───────────────────────────────────────────
export async function generatePeriods(
  supabase:       SupabaseClient,
  company_id:     string,
  fiscal_year_id: string,
): Promise<void> {
  // Get fiscal year details
  const { data: fy } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('id', fiscal_year_id)
    .eq('company_id', company_id)
    .single()

  if (!fy) return

  const startDate = new Date(fy.start_date)
  const endDate   = new Date(fy.end_date)

  const periodNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]

  // Check existing periods to avoid duplicates
  const { data: existingPeriods } = await supabase
    .from('accounting_periods')
    .select('period_number')
    .eq('fiscal_year_id', fiscal_year_id)
    .eq('company_id', company_id)

  const existingNumbers = new Set((existingPeriods || []).map((p: any) => p.period_number))

  const periods: any[] = []
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  let periodNum = 1

  while (current <= endDate && periodNum <= 12) {
    const month = current.getMonth() + 1
    const year  = current.getFullYear()

    if (!existingNumbers.has(periodNum)) {
      const lastDay = new Date(year, month, 0).getDate()
      periods.push({
        company_id,
        fiscal_year_id,
        period_number: periodNum,
        name:          `${periodNames[month - 1]} ${year}`,
        start_date:    `${year}-${String(month).padStart(2, '0')}-01`,
        end_date:      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
        status:        'open',
      })
    }

    current.setMonth(current.getMonth() + 1)
    periodNum++
  }

  if (periods.length > 0) {
    await supabase.from('accounting_periods').insert(periods)
  }
}
