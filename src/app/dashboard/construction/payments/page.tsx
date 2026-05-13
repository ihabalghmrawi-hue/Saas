import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { PaymentsClient } from './payments-client'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const admin   = createAdminClient()
  const COMPANY = await getCompanyId()
  const CURRENCY = await getCurrency()

  const [{ data: payments }, { data: projects }] = await Promise.all([
    admin.from('con_payments').select('*, con_projects(name)').eq('company_id', COMPANY).order('payment_date', { ascending: false }),
    admin.from('con_projects').select('id, name').eq('company_id', COMPANY).neq('status', 'cancelled').order('name'),
  ])

  return <PaymentsClient payments={payments || []} projects={projects || []} currency={CURRENCY} />
}
