import { createClient } from '@/lib/supabase/server'
import { POSClient } from './pos-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function POSPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase   = createClient()

  const [
    { data: products },
    { data: categories },
    { data: customers },
    { data: warehouses },
    { data: company },
  ] = await Promise.all([
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
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true),
    supabase
      .from('companies')
      .select('name, name_ar, phone, address, tax_number, logo_url')
      .eq('id', COMPANY_ID)
      .single(),
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
      currency={await getCurrency()}
      company={company || null}
    />
  )
}
