import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId }      from '@/lib/tenant'
import {
  ensureFiscalYear,
  closePeriod,
  generatePeriods,
} from '@/lib/accounting/index'

// ── GET: list fiscal years and periods ────────────────────────
export async function GET(req: NextRequest) {
  const supabase   = createClient()
  const company_id = req.headers.get('x-tenant-id') || getCompanyId()

  try {
    const [fyResult, periodsResult] = await Promise.all([
      supabase
        .from('fiscal_years')
        .select('*')
        .eq('company_id', company_id)
        .order('start_date', { ascending: false }),
      supabase
        .from('accounting_periods')
        .select('*')
        .eq('company_id', company_id)
        .order('start_date', { ascending: false }),
    ])

    return NextResponse.json({
      fiscal_years: fyResult.data  || [],
      periods:      periodsResult.data || [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: create fiscal year OR close period ──────────────────
export async function POST(req: NextRequest) {
  const supabase   = createAdminClient()
  const company_id = req.headers.get('x-tenant-id') || getCompanyId()

  try {
    const body   = await req.json()
    const action = body.action

    if (action === 'ensure_fiscal_year' || !action) {
      const fy = await ensureFiscalYear(supabase, company_id)
      return NextResponse.json(fy)
    }

    if (action === 'close_period') {
      const { period_id } = body
      if (!period_id) {
        return NextResponse.json({ error: 'معرف الفترة مطلوب' }, { status: 400 })
      }
      const result = await closePeriod(supabase, company_id, period_id)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
      return NextResponse.json(result)
    }

    if (action === 'create_fiscal_year') {
      const { name, start_date, end_date } = body

      if (!start_date || !end_date) {
        return NextResponse.json(
          { error: 'تاريخ البداية والنهاية مطلوبان' },
          { status: 400 },
        )
      }

      // Mark existing current year as not current
      await supabase
        .from('fiscal_years')
        .update({ is_current: false })
        .eq('company_id', company_id)
        .eq('is_current', true)

      const { data, error } = await supabase
        .from('fiscal_years')
        .insert({
          company_id,
          name:       name || `السنة المالية ${start_date.slice(0, 4)}`,
          start_date,
          end_date,
          status:     'active',
          is_current: true,
        })
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Generate monthly periods
      await generatePeriods(supabase, company_id, data.id)

      return NextResponse.json(data, { status: 201 })
    }

    if (action === 'generate_periods') {
      const { fiscal_year_id } = body
      if (!fiscal_year_id) {
        return NextResponse.json({ error: 'معرف السنة المالية مطلوب' }, { status: 400 })
      }
      await generatePeriods(supabase, company_id, fiscal_year_id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
