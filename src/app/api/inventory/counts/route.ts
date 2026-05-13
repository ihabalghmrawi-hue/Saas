import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { InventoryDomain } from '@/domains/inventory'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  let query = supabase.from('inventory_count_sessions')
    .select('*', { count: 'exact' })
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const offset = (page - 1) * limit
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) return Errors.serverError(error.message)
  return ok(data || [], { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) })
}

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new InventoryDomain(supabase, ctx.companyId)

  let body: unknown
  try { body = await req.json() } catch { return Errors.badRequest('طلب غير صالح') }
  const { action } = body as Record<string, unknown>

  if (action === 'start') {
    const result = await domain.workflows.count.createSession(body as any)
    if (!result.ok) return Errors.badRequest(result.error)
    return ok(result.data, undefined, 201)
  }
  if (action === 'complete') {
    const { session_id, approved_by } = body as Record<string, string>
    if (!session_id) return Errors.badRequest('رقم الجلسة مطلوب')
    const result = await domain.workflows.count.applyAdjustments(session_id, approved_by)
    if (!result.ok) return Errors.badRequest(result.error)
    return ok(result.data)
  }
  return Errors.badRequest('إجراء غير صالح. استخدم start أو complete')
}
