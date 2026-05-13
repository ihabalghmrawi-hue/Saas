import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { JournalClient } from './journal-client'

export const dynamic = 'force-dynamic'

export default async function JournalPage() {
  const supabase   = createClient()
  const company_id = await getCompanyId()
  const currency   = await getCurrency()

  // Fetch initial data: latest 50 journal entries
  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id, entry_number, date, description, description_ar,
      reference, status, total_debit, total_credit,
      is_balanced, source, source_document, auto_generated,
      posted_at, approved_by, reversal_of, reversal_entry_id,
      created_at,
      journal_entry_lines(
        id, account_id, debit, credit, description, line_number,
        accounts(id, code, name, name_ar, type)
      )
    `)
    .eq('company_id', company_id)
    .order('date', { ascending: false })
    .order('entry_number', { ascending: false })
    .limit(50)

  // Fetch accounts for the journal entry form
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type, normal_balance, is_postable')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .eq('is_postable', true)
    .order('code', { ascending: true })

  return (
    <JournalClient
      initialEntries={(entries || []) as any[]}
      accounts={accounts || []}
      company_id={company_id}
      currency={currency}
    />
  )
}
