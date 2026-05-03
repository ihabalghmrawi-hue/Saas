import { createClient } from '@/lib/supabase/server'
import { POSClient } from './pos-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function POSPage() {
  const supabase = createClient()

  const [{ data: products }, { data: categories }, { data: customers }, { data: warehouses }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_categories(name, name_ar, color), inventory(quantity, warehouse_id)')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
      .eq('type', 'product')
      .order('name'),
    supabase
      .from('product_categories')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('customers')
      .select('id, name, name_ar, phone, balance, credit_limit')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),
  ])

  const defaultWarehouse = warehouses?.find(w => w.is_default) || warehouses?.[0]

  return (
    <POSClient
      products={products || []}
      categories={categories || []}
      customers={customers || []}
      warehouses={warehouses || []}
      defaultWarehouseId={defaultWarehouse?.id || null}
      companyId={COMPANY_ID}
      currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'}
    />
  )
}
