import { createClient } from '@/lib/supabase/server'
import { CustomerDetailClient } from './customer-detail-client'
import { notFound } from 'next/navigation'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const [{ data: customer }, { data: sales }, { data: transactions }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', params.id).eq('company_id', COMPANY_ID).single(),
    supabase.from('sales')
      .select('id, invoice_number, total, paid_amount, due_amount, payment_status, status, sale_date, created_at')
      .eq('customer_id', params.id)
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('customer_transactions')
      .select('*')
      .eq('customer_id', params.id)
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!customer) return notFound()

  return (
    <CustomerDetailClient
      customer={customer}
      sales={sales || []}
      transactions={transactions || []}
      currency={CURRENCY}
      companyId={COMPANY_ID}
    />
  )
}
