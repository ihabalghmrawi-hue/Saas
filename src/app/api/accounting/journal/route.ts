import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, requireRole, isAuthError } from '@/lib/auth-guard'
import { ok, Errors }        from '@/lib/api-response'
import { createJournalEntry } from '@/lib/accounting/index'
import { logAudit }           from '@/lib/audit'

// ── GET: list journal entries ─────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase    = createClient()
  const company_id  = ctx.companyId
  const { searchParams } = req.nextUrl

  const status    = searchParams.get('status')
  const date_from = searchParams.get('date_from')
  const date_to   = searchParams.get('date_to')
  const source    = searchParams.get('source')
  const search    = searchParams.get('search')
  const page      = Math.max(1, parseInt(searchParams.get('page')  || '1',  10))
  const limit     = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const offset    = (page - 1) * limit

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
    // Sanitise: only allow safe characters in the search term
    const safe = search.replace(/[^a-zA-Z0-9؀-ۿ\s\-_]/g, '').slice(0, 100)
    if (safe) {
      query = query.or(`description.ilike.%${safe}%,entry_number.ilike.%${safe}%,reference.ilike.%${safe}%`)
    }
  }

  const { data, error, count } = await query
  if (error) return Errors.serverError(error.message)

  return ok(data || [], { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) })
}

// ── POST: create manual journal entry ────────────────────────
export async function POST(req: NextRequest) {
  const ctx = requireRole(req, 'admin.settings')
  if (isAuthError(ctx)) return ctx

  const company_id = ctx.companyId
  const supabase   = createAdminClient()

  let body: unknown
  try { body = await req.json() } catch {
    return Errors.badRequest('طلب غير صالح')
  }

  const {
    description, description_ar, reference,
    date, lines, source_document,
  } = body as Record<string, unknown>

  if (!description || typeof description !== 'string' || !description.trim()) {
    return Errors.badRequest('وصف القيد مطلوب')
  }
  if (!Array.isArray(lines) || lines.length < 2) {
    return Errors.badRequest('القيد يجب أن يحتوي على سطرين على الأقل')
  }
  if (lines.length > 50) {
    return Errors.badRequest('القيد لا يمكن أن يحتوي على أكثر من 50 سطر')
  }

  const result = await createJournalEntry(supabase, {
    company_id,
    description:     String(description).slice(0, 500),
    description_ar:  description_ar ? String(description_ar).slice(0, 500) : undefined,
    reference:       reference       ? String(reference).slice(0, 100)     : undefined,
    date:            date            ? String(date)                         : undefined,
    source_document: source_document ? String(source_document).slice(0, 200) : undefined,
    source: 'manual',
    lines,
    auto_generated: false,
  })

  if (!result.ok) {
    return Errors.badRequest(result.error ?? 'فشل إنشاء القيد')
  }

  await logAudit({
    action:     'sale.created',   // reuse closest action — or extend AuditAction
    entityType: 'journal_entry',
    entityId:   result.journal_id,
    companyId:  company_id,
    metadata:   { entry_number: result.entry_number, description },
  })

  return ok(result, undefined, 201)
}
