import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from './project-detail-client'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const admin    = createAdminClient()
  const COMPANY  = await getCompanyId()
  const CURRENCY = await getCurrency()

  const [{ data: project }, { data: tasks }, { data: expenses }, { data: materials }, { data: payments }, { data: workers }] = await Promise.all([
    admin.from('con_projects').select('*').eq('id', params.id).eq('company_id', COMPANY).single(),
    admin.from('con_tasks').select('*, con_workers(name)').eq('project_id', params.id).eq('company_id', COMPANY).order('created_at', { ascending: false }),
    admin.from('con_expenses').select('*').eq('project_id', params.id).eq('company_id', COMPANY).order('expense_date', { ascending: false }),
    admin.from('con_materials').select('*').eq('project_id', params.id).eq('company_id', COMPANY).order('purchase_date', { ascending: false }),
    admin.from('con_payments').select('*').eq('project_id', params.id).eq('company_id', COMPANY).order('payment_date', { ascending: false }),
    admin.from('con_workers').select('id, name').eq('company_id', COMPANY).eq('status', 'active').order('name'),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailClient
      project={project}
      tasks={tasks || []}
      expenses={expenses || []}
      materials={materials || []}
      payments={payments || []}
      workers={workers || []}
      currency={CURRENCY}
    />
  )
}
