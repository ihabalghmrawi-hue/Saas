import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const { searchParams } = req.nextUrl

  const as_of_date = searchParams.get('as_of_date')
  const period_id = searchParams.get('period_id')

  if (period_id) {
    const { data, error } = await supabase.rpc('get_balance_sheet', {
      p_company_id: ctx.companyId,
      p_period_id: period_id,
    })
    if (error) return Errors.serverError(error.message)
    return ok(data)
  }

  if (as_of_date) {
    const { data, error } = await supabase.rpc('get_balance_sheet_as_of', {
      p_company_id: ctx.companyId,
      p_as_of_date: as_of_date,
    })
    if (error) return Errors.serverError(error.message)
    return ok(data)
  }

  const { data, error } = await supabase.from('mv_balance_sheet')
    .select('*')
    .eq('company_id', ctx.companyId)
    .order('account_code')

  if (error) return Errors.serverError(error.message)
  return ok(data || [])
}
