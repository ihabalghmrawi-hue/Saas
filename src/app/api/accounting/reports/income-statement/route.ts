import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const { searchParams } = req.nextUrl

  const from_date = searchParams.get('from_date')
  const to_date = searchParams.get('to_date')
  const period_id = searchParams.get('period_id')

  if (period_id) {
    const { data, error } = await supabase.rpc('get_income_statement', {
      p_company_id: ctx.companyId,
      p_period_id: period_id,
    })
    if (error) return Errors.serverError(error.message)
    return ok(data)
  }

  if (from_date && to_date) {
    const { data, error } = await supabase.rpc('get_income_statement_range', {
      p_company_id: ctx.companyId,
      p_from_date: from_date,
      p_to_date: to_date,
    })
    if (error) return Errors.serverError(error.message)
    return ok(data)
  }

  const { data, error } = await supabase.from('mv_income_statement')
    .select('*')
    .eq('company_id', ctx.companyId)
    .order('account_code')

  if (error) return Errors.serverError(error.message)
  return ok(data || [])
}
