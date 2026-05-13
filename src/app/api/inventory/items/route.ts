import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { InventoryDomain } from '@/domains/inventory'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new InventoryDomain(supabase, ctx.companyId)
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search')
  const category_id = searchParams.get('category_id')
  const warehouse_id = searchParams.get('warehouse_id')
  const is_active = searchParams.get('is_active')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  let query = supabase.from('inventory_items')
    .select('*', { count: 'exact' })
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
  if (category_id) query = query.eq('category_id', category_id)
  if (warehouse_id) query = query.eq('warehouse_id', warehouse_id)
  if (is_active === 'true') query = query.eq('is_active', true)
  if (is_active === 'false') query = query.eq('is_active', false)

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

  const result = await domain.repositories.item.create(body as any)
  return ok(result, undefined, 201)
}
