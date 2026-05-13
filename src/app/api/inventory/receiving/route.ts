import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { InventoryDomain } from '@/domains/inventory'

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new InventoryDomain(supabase, ctx.companyId)

  let body: unknown
  try { body = await req.json() } catch { return Errors.badRequest('طلب غير صالح') }

  const result = await domain.workflows.receiving.receiveWithBatch(body as any)
  if (!result.ok) return Errors.badRequest(result.error)
  return ok(result.data, undefined, 201)
}
