import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { TasksClient } from './tasks-client'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const admin   = createAdminClient()
  const COMPANY = await getCompanyId()

  const [{ data: tasks }, { data: projects }, { data: workers }] = await Promise.all([
    admin.from('con_tasks').select('*, con_projects(name)').eq('company_id', COMPANY).order('created_at', { ascending: false }),
    admin.from('con_projects').select('id, name').eq('company_id', COMPANY).neq('status', 'cancelled').order('name'),
    admin.from('con_workers').select('id, name').eq('company_id', COMPANY).eq('status', 'active').order('name'),
  ])

  return <TasksClient tasks={tasks || []} projects={projects || []} workers={workers || []} />
}
