import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { ProjectsClient } from './projects-client'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const admin    = createAdminClient()
  const COMPANY  = await getCompanyId()
  const CURRENCY = await getCurrency()

  const { data: projects } = await admin
    .from('con_projects')
    .select('*')
    .eq('company_id', COMPANY)
    .order('created_at', { ascending: false })

  return <ProjectsClient projects={projects || []} currency={CURRENCY} />
}
