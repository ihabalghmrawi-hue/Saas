import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { ExpensesClient } from './expenses-client'

export const dynamic = 'force-dynamic'

export default async function ConstructionExpensesPage() {
  const admin   = createAdminClient()
  const COMPANY = await getCompanyId()
  const CURRENCY = await getCurrency()

  const [{ data: expenses }, { data: projects }] = await Promise.all([
    admin.from('con_expenses').select('*, con_projects(name)').eq('company_id', COMPANY).order('expense_date', { ascending: false }),
    admin.from('con_projects').select('id, name').eq('company_id', COMPANY).neq('status', 'cancelled').order('name'),
  ])

  return <ExpensesClient expenses={expenses || []} projects={projects || []} currency={CURRENCY} />
}
