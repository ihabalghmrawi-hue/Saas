import { createClient } from '@/lib/supabase/server'
import { WalletClient } from './wallet-client'

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id, companies(currency)')
    .eq('user_id', user!.id)
    .single()

  const companyId = membership?.company_id as string
  const currency = (membership?.companies as any)?.currency || 'USD'

  const [{ data: wallets }, { data: recentTxns }] = await Promise.all([
    supabase
      .from('wallets')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('is_default', { ascending: false }),

    supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .order('transaction_date', { ascending: false })
      .limit(10),
  ])

  return (
    <WalletClient
      wallets={wallets || []}
      recentTransactions={recentTxns || []}
      currency={currency}
      companyId={companyId}
    />
  )
}
