import { createClient } from '@/lib/supabase/server'
import { WalletClient } from './wallet-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function WalletPage() {
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
