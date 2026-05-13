import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { ReconciliationEngine } from '@/lib/accounting/index'

export async function GET(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('account_id') || undefined
  const status = searchParams.get('status') || undefined
  const type = searchParams.get('type')

  if (type === 'aged-receivables' || type === 'aged-payables') {
    const { getAgedReceivables, getAgedPayables } = await import('@/lib/accounting/index')
    const asOfDate = searchParams.get('as_of') || undefined
    const report = type === 'aged-receivables'
      ? await getAgedReceivables(supabase, ctx.companyId, asOfDate)
      : await getAgedPayables(supabase, ctx.companyId, asOfDate)
    return ok(report)
  }

  if (type === 'customer-balances') {
    const { getCustomerBalances } = await import('@/lib/accounting/index')
    const balances = await getCustomerBalances(supabase, ctx.companyId)
    return ok(balances)
  }

  if (type === 'supplier-balances') {
    const { getSupplierBalances } = await import('@/lib/accounting/index')
    const balances = await getSupplierBalances(supabase, ctx.companyId)
    return ok(balances)
  }

  const engine = new ReconciliationEngine(supabase, ctx.companyId)
  const reconciliations = await engine.getPendingReconciliations({ account_id: accountId, status })
  return ok(reconciliations)
}

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx

  const supabase = createAdminClient()
  const engine = new ReconciliationEngine(supabase, ctx.companyId)
  const body = await req.json()

  if (body.action === 'create') {
    const result = await engine.createReconciliation(body)
    if (!result.ok) return Errors.badRequest(result.error!)
    return ok(result, undefined, 201)
  }

  if (body.action === 'match-lines') {
    const result = await engine.matchLines(body.reconciliation_id, body.lines)
    if (!result.ok) return Errors.badRequest(result.error!)
    return ok({ matched: true })
  }

  if (body.action === 'auto-match') {
    const result = await engine.autoMatchInvoice(String(body.invoice_id), (body.payment_ids || []) as string[])
    if (!result.ok) return Errors.badRequest(result.error!)
    return ok(result)
  }

  return Errors.badRequest('إجراء غير معروف')
}
