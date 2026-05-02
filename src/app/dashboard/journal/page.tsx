import { createClient } from '@/lib/supabase/server'
import { JournalClient } from './journal-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function JournalPage() {
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
