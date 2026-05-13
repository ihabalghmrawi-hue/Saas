import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { RecurringJournalEngine } from '@/lib/accounting/index'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const withLogs = searchParams.get('logs') === 'true'

  let query = supabase
    .from('recurring_journals')
    .select(withLogs ? '*, recurring_journal_log(*)': '*')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Errors.serverError(error.message)
  return ok(data || [])
}

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const engine = new RecurringJournalEngine(supabase, ctx.companyId)
  const body = await req.json()

  if (body.action === 'create') {
    const result = await engine.createTemplate(body)
    if (!result.ok) return Errors.badRequest(result.error!)
    await logAudit({
      action: 'accounting.recurring.created',
      entityType: 'recurring_journal',
      entityId: result.id!,
      companyId: ctx.companyId,
      metadata: { name: body.name },
    })
    return ok(result, undefined, 201)
  }

  if (body.action === 'process') {
    const results = await engine.processDueJournals()
    return ok({ processed: results.length, results })
  }

  if (body.action === 'update') {
    delete body.action
    const { id, ...updates } = body
    if (!id) return Errors.badRequest('معرف القالب مطلوب')
    delete updates.company_id

    const { data, error } = await supabase
      .from('recurring_journals')
      .update(updates)
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .select('*')
      .single()

    if (error) return Errors.serverError(error.message)
    return ok(data)
  }

  if (body.action === 'delete') {
    const { id } = body
    if (!id) return Errors.badRequest('معرف القالب مطلوب')
    const { error } = await supabase
      .from('recurring_journals')
      .delete()
      .eq('id', id)
      .eq('company_id', ctx.companyId)
    if (error) return Errors.serverError(error.message)
    return ok({ deleted: true })
  }

  return Errors.badRequest('إجراء غير معروف')
}
