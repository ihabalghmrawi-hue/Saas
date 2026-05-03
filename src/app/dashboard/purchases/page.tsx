import { createClient } from '@/lib/supabase/server'
import { PurchasesClient } from './purchases-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function PurchasesPage() {
  const supabase = createClient()

  const [{ data: purchases }, { data: suppliers }, { data: products }, { data: warehouses }] = await Promise.all([
    supabase.from('purchases').select('*, suppliers(name), purchase_items(id)').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(100),
    supabase.from('suppliers').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('products').select('id, name, name_ar, cost_price, barcode').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('warehouses').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <PurchasesClient
      purchases={purchases || []}
      suppliers={suppliers || []}
      products={products || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={CURRENCY}
    />
  )
}
