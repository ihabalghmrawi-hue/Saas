import { createClient } from '@/lib/supabase/server'
import { TransactionsClient } from './transactions-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { type?: string; page?: string; search?: string; category?: string }
}) {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const page = parseInt(searchParams.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  let query = supabase
    .from('transactions')
    .select('*, categories(name, name_ar, color, icon), parties(name)', { count: 'exact' })
    .eq('company_id', COMPANY_ID)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (searchParams.type && searchParams.type !== 'all') {
    query = query.eq('type', searchParams.type)
  }

  if (searchParams.category) {
    query = query.eq('category_id', searchParams.category)
  }

  if (searchParams.search) {
    query = query.or(`description.ilike.%${searchParams.search}%,description_ar.ilike.%${searchParams.search}%`)
  }

  const { data: transactions, count } = await query

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)

  return (
    <TransactionsClient
      transactions={transactions || []}
      categories={categories || []}
      currency={CURRENCY}
      companyId={COMPANY_ID}
      totalCount={count || 0}
      currentPage={page}
      limit={limit}
    />
  )
}
