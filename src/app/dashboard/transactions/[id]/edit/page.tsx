import { createClient } from '@/lib/supabase/server'
import { TransactionForm } from '@/components/forms/transaction-form'
import { notFound } from 'next/navigation'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function EditTransactionPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', COMPANY_ID)
    .single()

  if (!transaction) notFound()

  const [{ data: categories }, { data: parties }, { data: wallets }] = await Promise.all([
    supabase.from('categories').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('parties').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
    supabase.from('wallets').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">تعديل القيد</h2>
        <p className="text-sm text-muted-foreground">تعديل بيانات المعاملة المالية</p>
      </div>
      <TransactionForm
        companyId={COMPANY_ID}
        currency={CURRENCY}
        categories={categories || []}
        parties={parties || []}
        wallets={wallets || []}
        initialData={transaction as any}
      />
    </div>
  )
}
