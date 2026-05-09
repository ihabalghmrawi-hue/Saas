import { createClient }             from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { buildAccountTree }          from '@/lib/accounting/index'
import { CoaClient }                 from './coa-client'

export const dynamic = 'force-dynamic'

export default async function CoaPage() {
  const supabase   = createClient()
  const company_id = getCompanyId()
  const currency   = getCurrency()

  const { data: accounts } = await supabase
    .from('accounts')
    .select(`
      id, code, name, name_ar, type, subtype,
      parent_id, level, is_postable, is_header,
      normal_balance, current_balance, account_group,
      is_active, is_system, description
    `)
    .eq('company_id', company_id)
    .order('code', { ascending: true })

  const tree  = buildAccountTree((accounts || []) as any)
  const isEmpty = !accounts || accounts.length === 0

  return (
    <CoaClient
      tree={tree}
      flatAccounts={accounts || []}
      isEmpty={isEmpty}
      company_id={company_id}
      currency={currency}
    />
  )
}
