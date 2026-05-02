import { createClient } from '@/lib/supabase/server'
import { CategoriesClient } from './categories-client'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: membership } = await supabase
    .from('memberships').select('company_id').eq('user_id', user!.id).single()
  const companyId = membership?.company_id as string
  const { data: categories } = await supabase
    .from('categories').select('*').eq('company_id', companyId).eq('is_active', true).order('sort_order')
  return <CategoriesClient categories={categories || []} companyId={companyId} />
}
