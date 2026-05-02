import { createClient } from '@/lib/supabase/server'
import { CategoriesClient } from './categories-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function CategoriesPage() {
  const supabase = createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('sort_order')

  return <CategoriesClient categories={categories || []} companyId={COMPANY_ID} />
}
