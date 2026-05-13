import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { ReconciliationClient } from './reconciliation-client'

export const dynamic = 'force-dynamic'

export default async function ReconciliationPage() {
  const supabase = createClient()
  const company_id = await getCompanyId()
  const currency = await getCurrency()

  const { data: reconciliations } = await supabase
    .from('reconciliations')
    .select('*, reconciliation_lines(*)')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name_ar')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .in('type', ['asset', 'liability'])
    .order('code')

  return (
    <ReconciliationClient
      initialReconciliations={(reconciliations || []) as any[]}
      accounts={accounts || []}
      company_id={company_id}
      currency={currency}
    />
  )
}
