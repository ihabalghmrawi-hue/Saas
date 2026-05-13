import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { SalesDomain } from '@/domains/sales'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const { id } = await params
  const supabase = createClient()

  const { data, error } = await supabase.from('sales_returns')
    .select('*, return_lines(*)')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (error) return Errors.notFound('المرتجع')
  return ok(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const { id } = await params
  const supabase = createClient()
  const domain = new SalesDomain(supabase, ctx.companyId)

  let body: unknown
  try { body = await req.json() } catch { return Errors.badRequest('طلب غير صالح') }
  const { action, completed_by } = body as Record<string, unknown>

  if (action === 'complete') {
    const result = await domain.engines.return.completeReturn(id, completed_by as string)
    if (!result.ok) return Errors.badRequest(result.error)
    return ok(result.data)
  }
  return Errors.badRequest('إجراء غير صالح. استخدم complete')
}
