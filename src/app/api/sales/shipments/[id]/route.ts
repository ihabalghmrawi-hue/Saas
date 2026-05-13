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

  const { data, error } = await supabase.from('sales_shipments')
    .select('*, shipment_lines(*)')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (error) return Errors.notFound('الشحنة')
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
  const { action, carrier, tracking_no } = body as Record<string, unknown>

  if (action === 'ship') {
    const result = await domain.engines.fulfillment.ship(id, carrier as string, tracking_no as string)
    if (!result.ok) return Errors.badRequest(result.error)
    return ok(result.data)
  }
  if (action === 'deliver') {
    const result = await domain.engines.fulfillment.deliver(id)
    if (!result.ok) return Errors.badRequest(result.error)
    return ok(result.data)
  }
  return Errors.badRequest('إجراء غير صالح. استخدم ship أو deliver')
}
