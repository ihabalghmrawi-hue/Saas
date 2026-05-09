import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId }      from '@/lib/tenant'
import { createJournalEntry } from '@/lib/accounting/index'

// ── GET: list journal entries ─────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase   = createClient()
  const company_id = req.headers.get('x-tenant-id') || getCompanyId()
  const { searchParams } = req.nextUrl

  const status    = searchParams.get('status')
  const date_from = searchParams.get('date_from')
  const date_to   = searchParams.get('date_to')
  const source    = searchParams.get('source')
  const search    = searchParams.get('search')
  const page      = parseInt(searchParams.get('page') || '1', 10)
  const limit     = parseInt(searchParams.get('limit') || '50', 10)
  const offset    = (page - 1) * limit

  try {
    let query = supabase
      .from('journal_entries')
      .select(`
        id, entry_number, date, description, description_ar,
        reference, status, total_debit, total_credit,
        is_balanced, source, source_document, auto_generated,
        posted_at, approved_by, reversal_of, reversal_entry_id,
        fiscal_year_id, period_id, created_at,
        journal_entry_lines(
          id, account_id, debit, credit, description, line_number,
          accounts(id, code, name, name_ar, type)
        )
      `, { count: 'exact' })
      .eq('company_id', company_id)
      .order('date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)    query = query.eq('status', status)
    if (date_from) query = query.gte('date', date_from)
    if (date_to)   query = query.lte('date', date_to)
    if (source === 'auto')   query = query.eq('auto_generated', true)
    if (source === 'manual') query = query.eq('auto_generated', false)
    if (source && source !== 'auto' && source !== 'manual') {
      query = query.eq('source', source)
    }
    if (search) {
      query = query.or(`description.ilike.%${search}%,entry_number.ilike.%${search}%,reference.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      data:  data || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST: create manual journal entry ────────────────────────
export async function POST(req: NextRequest) {
  const supabase   = createAdminClient()
  const company_id = req.headers.get('x-tenant-id') || getCompanyId()

  try {
    const body = await req.json()
    const {
      description, description_ar, reference,
      date, lines, source_document,
    } = body

    if (!description) {
      return NextResponse.json({ error: 'وصف القيد مطلوب' }, { status: 400 })
    }
    if (!lines || lines.length < 2) {
      return NextResponse.json({ error: 'القيد يجب أن يحتوي على سطرين على الأقل' }, { status: 400 })
    }

    const result = await createJournalEntry(supabase, {
      company_id,
      description,
      description_ar,
      reference,
      date,
      source_document,
      source: 'manual',
      lines,
      auto_generated: false,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
