import { createClient } from '@/lib/supabase/server'
import { JournalClient } from './journal-client'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id, companies(currency)')
    .eq('user_id', user!.id)
    .single()

  const companyId = membership?.company_id as string
  const currency = (membership?.companies as any)?.currency || 'USD'

  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_entry_lines (
        *,
        accounts (code, name, name_ar, type)
      )
    `)
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(50)

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('code')

  return (
    <JournalClient
      entries={entries || []}
      accounts={accounts || []}
      companyId={companyId}
      currency={currency}
    />
  )
}
