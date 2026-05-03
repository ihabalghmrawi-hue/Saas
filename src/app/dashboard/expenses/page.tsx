import { createClient } from '@/lib/supabase/server'
import { ExpensesClient } from './expenses-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function ExpensesPage() {
  const supabase = createClient()
  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase.from('expenses').select('*, expense_categories(name, name_ar, color, icon)').eq('company_id', COMPANY_ID).order('expense_date', { ascending: false }).limit(200),
    supabase.from('expense_categories').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return <ExpensesClient expenses={expenses || []} categories={categories || []} companyId={COMPANY_ID} currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'} />
}
