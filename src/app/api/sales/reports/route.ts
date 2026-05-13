import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { SalesDomain } from '@/domains/sales'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new SalesDomain(supabase, ctx.companyId)
  const { searchParams } = req.nextUrl

  const type = searchParams.get('type') || 'summary'
  const from_date = searchParams.get('from_date')
  const to_date = searchParams.get('to_date')
  const as_of_date = searchParams.get('as_of_date')

  let result
  if (type === 'summary') {
    if (!from_date || !to_date) return Errors.badRequest('from_date و to_date مطلوبان')
    result = await domain.reports.generator.generateSalesSummary(from_date, to_date)
  } else if (type === 'aging') {
    result = await domain.reports.generator.generateCustomerAging(as_of_date || undefined)
  } else if (type === 'profitability') {
    if (!from_date || !to_date) return Errors.badRequest('from_date و to_date مطلوبان')
    result = await domain.reports.generator.generateProductProfitability(from_date, to_date)
  } else {
    return Errors.badRequest('نوع تقرير غير صالح')
  }

  if (!result.ok) return Errors.serverError(result.error)
  return ok(result.data)
}
