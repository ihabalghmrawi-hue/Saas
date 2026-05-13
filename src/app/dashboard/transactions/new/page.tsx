import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/components/forms/transaction-form'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export default async function NewTransactionPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const [{ data: categories }, { data: parties }, { data: wallets }] = await Promise.all([
    supabase.from('categories').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('parties').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('wallets').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">قيد مالي جديد</h2>
        <p className="text-sm text-muted-foreground">تسجيل قيد دفع أو قبض أو تسويات</p>
      </div>
      <TransactionForm
        companyId={COMPANY_ID}
        currency={CURRENCY}
        categories={categories || []}
        parties={parties || []}
        wallets={wallets || []}
      />
    </div>
  )
}
