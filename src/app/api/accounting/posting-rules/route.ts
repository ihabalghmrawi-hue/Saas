import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl
  const eventType = searchParams.get('event_type')

  let query = supabase
    .from('posting_rules')
    .select('*, posting_rule_lines(*)')
    .eq('company_id', ctx.companyId)
    .order('priority', { ascending: true })

  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query
  if (error) return Errors.serverError(error.message)
  return ok(data || [])
}

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const body = await req.json()
  const { name, name_ar, event_type, description, priority, lines } = body

  if (!name || !event_type) {
    return Errors.badRequest('الاسم ونوع الحدث مطلوبان')
  }

  const { data, error } = await supabase
    .from('posting_rules')
    .insert({
      company_id: ctx.companyId,
      name,
      name_ar: name_ar || name,
      event_type,
      description: description || null,
      priority: priority || 0,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return Errors.serverError(error.message)

  if (lines && Array.isArray(lines)) {
    const { error: linesError } = await supabase
      .from('posting_rule_lines')
      .insert(
        lines.map((l: any, i: number) => ({
          posting_rule_id: data.id,
          sequence: i,
          ...l,
        }))
      )
    if (linesError) return Errors.serverError(linesError.message)
  }

  await logAudit({
    action: 'accounting.rule.created',
    entityType: 'posting_rule',
    entityId: data.id,
    companyId: ctx.companyId,
    metadata: { name, event_type },
  })

  return ok({ id: data.id }, undefined, 201)
}

export async function PATCH(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return Errors.badRequest('معرف القاعدة مطلوب')

  delete updates.company_id

  const { data, error } = await supabase
    .from('posting_rules')
    .update(updates)
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .select('*')
    .single()

  if (error) return Errors.serverError(error.message)
  return ok(data)
}

export async function DELETE(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return Errors.badRequest('معرف القاعدة مطلوب')

  const { error } = await supabase
    .from('posting_rules')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.companyId)

  if (error) return Errors.serverError(error.message)
  return ok({ deleted: true })
}
