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

  const item_id = searchParams.get('item_id')
  const warehouse_id = searchParams.get('warehouse_id')
  const movement_type = searchParams.get('movement_type')
  const reference_type = searchParams.get('reference_type')
  const date_from = searchParams.get('date_from')
  const date_to = searchParams.get('date_to')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  let query = supabase.from('stock_movements')
    .select('*', { count: 'exact' })
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (item_id) query = query.eq('item_id', item_id)
  if (warehouse_id) query = query.eq('warehouse_id', warehouse_id)
  if (movement_type) query = query.eq('movement_type', movement_type)
  if (reference_type) query = query.eq('reference_type', reference_type)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

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
  const { movement_type, ...input } = body as Record<string, unknown>

  let result
  if (movement_type === 'receive') result = await domain.engines.movement.receive(input as any)
  else if (movement_type === 'issue') result = await domain.engines.movement.issue(input as any)
  else if (movement_type === 'adjust') result = await domain.engines.movement.adjust(input as any)
  else return Errors.badRequest('نوع حركة غير صالح. استخدم receive, issue, أو adjust')

  if (!result.ok) return Errors.badRequest(result.error)
  return ok(result.data, undefined, 201)
}
