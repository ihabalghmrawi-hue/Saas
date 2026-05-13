import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import { PostingRulesClient } from './posting-rules-client'

export const dynamic = 'force-dynamic'

export default async function PostingRulesPage() {
  const supabase = createClient()
  const company_id = await getCompanyId()

  const { data: rules } = await supabase
    .from('posting_rules')
    .select('*, posting_rule_lines(*)')
    .eq('company_id', company_id)
    .order('priority', { ascending: true })

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .order('code', { ascending: true })

  return (
    <PostingRulesClient
      initialRules={(rules || []) as any[]}
      accounts={accounts || []}
      company_id={company_id}
    />
  )
}
