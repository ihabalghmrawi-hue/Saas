import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany, isAuthError } from '@/lib/auth-guard'
import { ok, Errors } from '@/lib/api-response'
import { SalesDomain } from '@/domains/sales'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = requireCompany(req)
  if (isAuthError(ctx)) return ctx
  const { id } = await params
  const supabase = createClient()

  const { data, error } = await supabase.from('quotations')
    .select('*, quotation_lines(*)')
    .eq('id', id)
    .eq('company_id', ctx.companyId)
    .single()

  if (error) return Errors.notFound('عرض السعر')
  return ok(data)
}
