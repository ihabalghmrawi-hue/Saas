import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { SalesDomain } from '@/domains/sales'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const order_id = searchParams.get('order_id')
  const warehouse_id = searchParams.get('warehouse_id')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  let query = supabase.from('sales_shipments')
    .select('*', { count: 'exact' })
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (order_id) query = query.eq('order_id', order_id)
  if (warehouse_id) query = query.eq('warehouse_id', warehouse_id)

  const offset = (page - 1) * limit
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) return Errors.serverError(error.message)
  return ok(data || [], { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) })
}

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new SalesDomain(supabase, ctx.companyId)

  let body: unknown
  try { body = await req.json() } catch { return Errors.badRequest('طلب غير صالح') }

  const result = await domain.engines.fulfillment.createShipment(body as any)
  if (!result.ok) return Errors.badRequest(result.error)
  return ok(result.data, undefined, 201)
}
