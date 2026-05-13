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

  const item_id = searchParams.get('item_id')
  const cost_method = searchParams.get('cost_method')
  const action = searchParams.get('action') || 'layers'

  if (action === 'snapshot') {
    const snapshots = await domain.engines.valuation.generateSnapshot()
    if (!snapshots.ok) return Errors.serverError(snapshots.error)
    return ok(snapshots.data)
  }

  if (action === 'recalculate') {
    const result = await domain.engines.valuation.recalculateAllValuations()
    if (!result.ok) return Errors.serverError(result.error)
    return ok(result.data)
  }

  let query = supabase.from('inventory_valuation_layers')
    .select('*')
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false })

  if (item_id) query = query.eq('item_id', item_id)
  if (cost_method) query = query.eq('cost_method', cost_method)

  const { data, error } = await query
  if (error) return Errors.serverError(error.message)
  return ok(data || [])
}
