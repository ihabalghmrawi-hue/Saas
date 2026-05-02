import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/components/forms/transaction-form'
import { redirect } from 'next/navigation'

export default async function NewTransactionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id, companies(currency)')
    .eq('user_id', user!.id)
    .single()

  const companyId = membership?.company_id as string
  const currency = (membership?.companies as any)?.currency || 'USD'

  const [{ data: categories }, { data: parties }, { data: wallets }] = await Promise.all([
    supabase.from('categories').select('*').eq('company_id', companyId).eq('is_active', true),
    supabase.from('parties').select('*').eq('company_id', companyId).eq('is_active', true),
    supabase.from('wallets').select('*').eq('company_id', companyId).eq('is_active', true),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">قيد مالي جديد</h2>
        <p className="text-sm text-muted-foreground">تسجيل قيد دفع أو قبض أو تسويات</p>
      </div>
      <TransactionForm
        companyId={companyId}
        currency={currency}
        categories={categories || []}
        parties={parties || []}
        wallets={wallets || []}
      />
    </div>
  )
}
