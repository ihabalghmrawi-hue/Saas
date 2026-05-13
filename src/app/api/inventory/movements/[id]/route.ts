import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const { id } = await params
  const supabase = createClient()

  const { data, error } = await supabase.from('stock_movements')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (error) return Errors.notFound('الحركة')
  return ok(data)
}
