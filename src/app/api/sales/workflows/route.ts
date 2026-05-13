import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { SalesDomain } from '@/domains/sales'

export async function POST(req: NextRequest) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const supabase = createClient()
  const domain = new SalesDomain(supabase, ctx.companyId)

  let body: unknown
  try { body = await req.json() } catch { return Errors.badRequest('طلب غير صالح') }
  const { workflow, ...payload } = body as Record<string, unknown>

  let result
  if (workflow === 'createOrderAndInvoice') {
    result = await domain.workflows.sales.createOrderAndInvoice(payload as any)
  } else if (workflow === 'postInvoiceWithInventory') {
    const { invoice_id, lines, posted_by } = payload as any
    if (!invoice_id) return Errors.badRequest('معرف الفاتورة مطلوب')
    result = await domain.workflows.sales.postInvoiceWithInventory(invoice_id, lines || [], posted_by as string)
  } else if (workflow === 'processReturnWithCreditNote') {
    result = await domain.workflows.sales.processReturnWithCreditNote(payload as any)
  } else {
    return Errors.badRequest('سير عمل غير صالح')
  }

  if (!result.ok) return Errors.badRequest(result.error)
  return ok(result.data, undefined, 201)
}
