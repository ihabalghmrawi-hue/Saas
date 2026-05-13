import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { getAgedReceivables, getAgedPayables } from '@/lib/accounting/index'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') || 'receivables'
  const asOfDate = searchParams.get('as_of') || undefined

  try {
    const report = type === 'payables'
      ? await getAgedPayables(supabase, ctx.companyId, asOfDate)
      : await getAgedReceivables(supabase, ctx.companyId, asOfDate)
    return ok(report)
  } catch (err: any) {
    return Errors.serverError(err.message)
  }
}
