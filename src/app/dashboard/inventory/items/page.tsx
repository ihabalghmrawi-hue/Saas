import { createClient } from '@/lib/supabase/server'
import { ItemsClient } from './items-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ItemsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const [{ data: items }, { data: warehouses }] = await Promise.all([
    supabase.from('inventory_items')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('warehouses')
      .select('id, name, name_ar')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),
  ])

  return (
    <ItemsClient
      items={items || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
