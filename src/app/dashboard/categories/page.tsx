import { createClient } from '@/lib/supabase/server'
import { CategoriesClient } from './categories-client'
import { getCompanyId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('sort_order')

  return <CategoriesClient categories={categories || []} companyId={COMPANY_ID} />
}
