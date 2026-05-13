import { createClient } from '@/lib/supabase/server'
import { JournalClient } from './journal-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`*, journal_entry_lines (*, accounts (code, name, name_ar, type))`)
    .eq('company_id', COMPANY_ID)
    .order('date', { ascending: false })
    .limit(50)

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('code')

  return (
    <JournalClient
      entries={entries || []}
      accounts={accounts || []}
      companyId={COMPANY_ID}
      currency={CURRENCY}
    />
  )
}
