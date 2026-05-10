import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { ConstructionDashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function ConstructionPage() {
  const admin     = createAdminClient()
  const COMPANY   = getCompanyId()
  const CURRENCY  = getCurrency()

  const [projects, workers, tasks, payments, expenses] = await Promise.all([
    admin.from('con_projects').select('id, name, status, expected_cost, actual_cost, start_date, end_date').eq('company_id', COMPANY).order('created_at', { ascending: false }),
    admin.from('con_workers').select('id, name, job_type, status, daily_rate').eq('company_id', COMPANY),
    admin.from('con_tasks').select('id, title, status, project_id, due_date, priority').eq('company_id', COMPANY).order('due_date', { ascending: true }).limit(20),
    admin.from('con_payments').select('type, amount, payment_date, project_id').eq('company_id', COMPANY).order('payment_date', { ascending: false }).limit(50),
    admin.from('con_expenses').select('amount, category, expense_date, project_id').eq('company_id', COMPANY).order('expense_date', { ascending: false }).limit(50),
  ])

  return (
    <ConstructionDashboardClient
      projects={projects.data || []}
      workers={workers.data || []}
      tasks={tasks.data || []}
      payments={payments.data || []}
      expenses={expenses.data || []}
      currency={CURRENCY}
    />
  )
}
