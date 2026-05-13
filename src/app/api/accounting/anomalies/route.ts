import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { AIAccountingEngine } from '@/lib/accounting/index'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const engine = new AIAccountingEngine(supabase, ctx.companyId)

  try {
    const anomalies = await engine.detectAnomalies()
    const insights = await engine.generateInsights()
    return ok({ anomalies, insights })
  } catch (err: any) {
    return Errors.serverError(err.message)
  }
}
