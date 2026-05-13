import { createClient } from '@/lib/supabase/server'
import { MovementsClient } from './movements-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function MovementsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const [{ data: movements }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase
      .from('inventory_movements')
      .select('*, products(name, name_ar), warehouses(name, name_ar)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('products').select('id, name, name_ar').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('warehouses').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <MovementsClient
      movements={movements || []}
      products={products || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
