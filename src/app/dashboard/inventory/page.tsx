import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './inventory-client'
import { headers } from 'next/headers'
import { getFeatures } from '@/lib/features'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function InventoryPage() {
  const supabase = createClient()
  const businessType = headers().get('x-business-type') || 'retail'
  const features = getFeatures(businessType)

  const [{ data: products }, { data: categories }, { data: units }, { data: warehouses }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_categories(name, name_ar, color), units(name, name_ar, abbreviation), inventory(quantity, warehouse_id, warehouses(name))')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false }),
    supabase.from('product_categories').select('*').eq('company_id', COMPANY_ID).eq('is_active', true).order('name'),
    supabase.from('units').select('*').eq('company_id', COMPANY_ID).order('name'),
    supabase.from('warehouses').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <InventoryClient
      products={products || []}
      categories={categories || []}
      units={units || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'}
      features={features}
    />
  )
}
