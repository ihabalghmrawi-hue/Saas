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

  const type = searchParams.get('type') || 'valuation'
  const from_date = searchParams.get('from_date')
  const to_date = searchParams.get('to_date')

  let result
  if (type === 'valuation') {
    result = await domain.reports.generator.generateStockValuation()
  } else if (type === 'aging') {
    result = await domain.reports.generator.generateAgingReport()
  } else if (type === 'turnover') {
    if (!from_date || !to_date) return Errors.badRequest('from_date و to_date مطلوبان')
    result = await domain.reports.generator.generateTurnoverReport(from_date, to_date)
  } else if (type === 'low-stock') {
    result = await domain.reports.generator.generateLowStockReport()
  } else {
    return Errors.badRequest('نوع تقرير غير صالح')
  }

  if (!result.ok) return Errors.serverError(result.error)
  return ok(result.data)
}
