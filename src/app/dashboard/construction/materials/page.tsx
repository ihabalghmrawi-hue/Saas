import { createAdminClient } from '@/lib/supabase/admin'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { MaterialsClient } from './materials-client'

export const dynamic = 'force-dynamic'

export default async function MaterialsPage() {
  const admin   = createAdminClient()
  const COMPANY = getCompanyId()
  const CURRENCY = getCurrency()

  const [{ data: materials }, { data: projects }] = await Promise.all([
    admin.from('con_materials').select('*, con_projects(name)').eq('company_id', COMPANY).order('purchase_date', { ascending: false }),
    admin.from('con_projects').select('id, name').eq('company_id', COMPANY).neq('status', 'cancelled').order('name'),
  ])

  return <MaterialsClient materials={materials || []} projects={projects || []} currency={CURRENCY} />
}
