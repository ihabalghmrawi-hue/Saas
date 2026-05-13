import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId } from '@/lib/tenant'
import {
  postJournalEntry,
  voidJournalEntry,
  reverseJournalEntry,
} from '@/lib/accounting/index'

// ── GET: single journal entry ─────────────────────────────────
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const supabase = createClient()
  const company_id = _req.headers.get('x-tenant-id') || await getCompanyId()

  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        id, entry_number, date, description, description_ar,
        reference, status, total_debit, total_credit,
        is_balanced, source, source_id, source_document,
        auto_generated, posted_at, approved_by,
        reversal_of, reversal_entry_id,
        fiscal_year_id, period_id, created_at,
        journal_entry_lines(
          id, account_id, debit, credit, description, line_number,
          accounts(id, code, name, name_ar, type, normal_balance)
        )
      `)
      .eq('id', id)
      .eq('company_id', company_id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'القيد غير موجود' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

// ── PATCH: post or void entry ─────────────────────────────────
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const supabase = createAdminClient()
  const company_id = req.headers.get('x-tenant-id') || await getCompanyId()

  try {
    const body = await req.json()
    const { action, approved_by, reason } = body

    if (!action) {
      return NextResponse.json(
        { error: 'الإجراء مطلوب (post | void | reverse)' },
        { status: 400 }
      )
    }

    if (action === 'post') {
      const result = await postJournalEntry(
        supabase,
        id,
        approved_by
      )

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: 422 }
        )
      }

      return NextResponse.json(result)
    }

    if (action === 'void') {
      const result = await voidJournalEntry(supabase, id)

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: 422 }
        )
      }

      return NextResponse.json(result)
    }

    if (action === 'reverse') {
      const result = await reverseJournalEntry(
        supabase,
        id,
        company_id,
        reason
      )

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error },
          { status: 422 }
        )
      }

      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'إجراء غير معروف' },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

// ── DELETE: void draft entry ──────────────────────────────────
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const supabase = createAdminClient()

  try {
    const result = await voidJournalEntry(supabase, id)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}