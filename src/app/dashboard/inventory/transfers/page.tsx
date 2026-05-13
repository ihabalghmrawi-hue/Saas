import { createClient } from '@/lib/supabase/server'
import { TransfersClient } from './transfers-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function TransfersPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const [{ data: transfers }, { data: warehouses }] = await Promise.all([
    supabase.from('inventory_transfers')
      .select('*, from_warehouse:from_warehouse_id(id, name, name_ar), to_warehouse:to_warehouse_id(id, name, name_ar)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('warehouses')
      .select('id, name, name_ar')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),
  ])

  return (
    <TransfersClient
      transfers={transfers || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
