import { createClient } from '@/lib/supabase/server'
import { MovementsClient } from './movements-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function MovementsPage() {
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
      currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'}
    />
  )
}
