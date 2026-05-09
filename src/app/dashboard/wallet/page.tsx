import { createClient } from '@/lib/supabase/server'
import { WalletClient } from './wallet-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const [{ data: wallets }, { data: recentTxns }] = await Promise.all([
    supabase.from('wallets').select('*').eq('company_id', COMPANY_ID).eq('is_active', true).order('is_default', { ascending: false }),
    supabase.from('transactions').select('*').eq('company_id', COMPANY_ID).eq('status', 'completed').order('transaction_date', { ascending: false }).limit(10),
  ])

  return (
    <WalletClient
      wallets={wallets || []}
      recentTransactions={recentTxns || []}
      currency={CURRENCY}
      companyId={COMPANY_ID}
    />
  )
}
